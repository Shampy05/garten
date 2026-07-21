// Google Cloud Vision → compact OCR payload. Pure, dependency-free (no Deno
// imports) so it can be unit-tested under vitest exactly like the rest of
// this repo's pure lib functions, while also running unmodified inside the
// Deno edge function at request time.
//
// We deliberately don't relay Vision's full verbose response (confidence
// scores, per-symbol breaks, detected languages, etc.) — the client only
// needs enough to draw tappable boxes and read the words back.

export type OcrWord = {
  text: string
  // 4-vertex quad, clockwise from top-left, in image pixel space:
  // [x0, y0, x1, y1, x2, y2, x3, y3]. Quads, not rects — phone photos of
  // book pages are essentially always slightly rotated/skewed, and Vision
  // reports the true (rotated) quadrilateral per word.
  quad: [number, number, number, number, number, number, number, number]
}

export type OcrPayload = {
  width: number
  height: number
  words: OcrWord[]
}

function vertexCoord(v: unknown, key: 'x' | 'y'): number {
  // Vision omits x/y entirely when the value is 0, so a missing key is a
  // real coordinate (0), not missing data.
  const n = (v as Record<string, unknown> | undefined)?.[key]
  return typeof n === 'number' ? n : 0
}

function wordQuad(boundingBox: unknown): OcrWord['quad'] {
  const vertices = (boundingBox as { vertices?: unknown[] } | undefined)?.vertices || []
  const pts: number[] = []
  for (let i = 0; i < 4; i++) {
    const v = vertices[i]
    pts.push(vertexCoord(v, 'x'), vertexCoord(v, 'y'))
  }
  return pts as OcrWord['quad']
}

function wordText(word: unknown): string {
  const symbols = (word as { symbols?: unknown[] } | undefined)?.symbols || []
  let out = ''
  for (const s of symbols) {
    const text = (s as { text?: unknown } | undefined)?.text
    if (typeof text === 'string') out += text
  }
  return out
}

// Walks the Vision DOCUMENT_TEXT_DETECTION response shape:
//   responses[0].fullTextAnnotation.pages[0].blocks[].paragraphs[].words[]
// Returns null when there's no fullTextAnnotation at all (blank page / no
// text found) — the caller maps that to a `no_text` error.
export function normalizeVisionResponse(visionJson: unknown): OcrPayload | null {
  const responses = (visionJson as { responses?: unknown[] } | undefined)?.responses
  const first = Array.isArray(responses) ? responses[0] : undefined
  const annotation = (first as { fullTextAnnotation?: unknown } | undefined)?.fullTextAnnotation
  if (!annotation) return null

  const pages = (annotation as { pages?: unknown[] }).pages || []
  const page = pages[0] as { width?: unknown; height?: unknown; blocks?: unknown[] } | undefined
  if (!page) return null

  const width = typeof page.width === 'number' ? page.width : 0
  const height = typeof page.height === 'number' ? page.height : 0

  const words: OcrWord[] = []
  for (const block of page.blocks || []) {
    const paragraphs = (block as { paragraphs?: unknown[] } | undefined)?.paragraphs || []
    for (const paragraph of paragraphs) {
      const paraWords = (paragraph as { words?: unknown[] } | undefined)?.words || []
      for (const word of paraWords) {
        const text = wordText(word)
        if (!text) continue
        const quad = wordQuad((word as { boundingBox?: unknown }).boundingBox)
        words.push({ text, quad })
      }
    }
  }

  return { width, height, words }
}
