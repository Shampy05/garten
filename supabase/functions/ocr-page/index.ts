// OCR proxy: photographed book page → word-level bounding boxes.
//
// The client never talks to Google Cloud Vision directly — the API key is a
// billable secret and this app has no other server-side surface (GitHub
// Pages SPA). This function is that surface: it verifies the caller is a
// real signed-in Garten user, forwards the image to Vision's
// DOCUMENT_TEXT_DETECTION (built for dense printed pages, unlike the plain
// TEXT_DETECTION feature), and returns only the compact shape the client
// needs (see normalize.ts) — never Vision's raw response or the key.
//
// Deploy:
//   supabase secrets set GOOGLE_VISION_API_KEY=<key>
//   supabase functions deploy ocr-page
// `verify_jwt = true` in supabase/config.toml is the first auth layer; the
// second (below) rejects anything but a real authenticated user — verify_jwt
// alone would accept the anon key, which is itself a valid JWT.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { normalizeVisionResponse } from './normalize.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ~3 MB decoded (base64 is ~4/3 the byte size), well above the client's
// downscaled ~200-500 KB uploads — this guards against a misbehaving client
// or a raw unresized photo, not normal traffic.
const MAX_BASE64_CHARS = 4_000_000

function errorResponse(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return errorResponse(400, 'bad_request', 'Expected a POST request.')
  }

  // ── Auth: require a real signed-in user, not just any valid project JWT ──
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return errorResponse(401, 'unauthorized', 'Missing Authorization header.')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const supa = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return errorResponse(401, 'unauthorized', 'Please sign in again.')

  // ── Request body ──────────────────────────────────────────────────────
  let body: { image?: unknown; mime?: unknown; languageHints?: unknown }
  try {
    body = await req.json()
  } catch {
    return errorResponse(400, 'bad_request', 'Expected a JSON body.')
  }

  const image = body.image
  if (typeof image !== 'string' || !image) {
    return errorResponse(400, 'bad_request', 'Missing "image" (base64 string).')
  }
  if (image.length > MAX_BASE64_CHARS) {
    return errorResponse(413, 'too_large', 'That photo is too large.')
  }
  const mime = typeof body.mime === 'string' ? body.mime : 'image/jpeg'
  void mime // Vision auto-detects format from the bytes; kept for future use/logging.
  const languageHints = Array.isArray(body.languageHints)
    ? body.languageHints.filter((h): h is string => typeof h === 'string')
    : []

  // ── Vision call ───────────────────────────────────────────────────────
  const visionKey = Deno.env.get('GOOGLE_VISION_API_KEY')
  if (!visionKey) return errorResponse(502, 'vision_error', 'OCR is not configured.')

  let visionRes: Response
  try {
    visionRes = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: image },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            imageContext: languageHints.length ? { languageHints } : undefined,
          },
        ],
      }),
    })
  } catch (e) {
    return errorResponse(502, 'vision_error', `Couldn't reach the OCR service: ${(e as Error)?.message || 'network error'}`)
  }

  if (!visionRes.ok) {
    return errorResponse(502, 'vision_error', `OCR service error (${visionRes.status}).`)
  }

  let visionJson: unknown
  try {
    visionJson = await visionRes.json()
  } catch {
    return errorResponse(502, 'vision_error', 'OCR service returned an unreadable response.')
  }

  const visionErr = (visionJson as { responses?: Array<{ error?: { message?: string } }> })?.responses?.[0]?.error
  if (visionErr) {
    return errorResponse(502, 'vision_error', visionErr.message || 'OCR service error.')
  }

  const normalized = normalizeVisionResponse(visionJson)
  if (!normalized || normalized.words.length === 0) {
    return errorResponse(422, 'no_text', 'No words found on this page.')
  }

  return new Response(JSON.stringify(normalized), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
})
