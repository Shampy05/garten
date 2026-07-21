// Camera word mining — prepares a photographed page for the OCR edge
// function: downscale to a sane long edge, orient per EXIF, and encode as
// base64 JPEG. Mirrors the canvas idiom in portrait.js (draw → canvas →
// blob), but downscaling a photo instead of rasterizing an SVG.
//
// Critical invariant: the caller must display the SAME blob it uploads
// (via URL.createObjectURL) so the OCR word quads — reported in the
// downscaled image's pixel space — line up with what's on screen with no
// coordinate remapping.

// Fit (width, height) within maxEdge on the long side, preserving aspect
// ratio. Never upscales — a photo already smaller than maxEdge is left
// alone. Pure, unit-tested.
export function fitWithin(width, height, maxEdge) {
  const longEdge = Math.max(width, height)
  if (!longEdge || longEdge <= maxEdge) {
    return { width, height, scale: 1 }
  }
  const scale = maxEdge / longEdge
  return { width: Math.round(width * scale), height: Math.round(height * scale), scale }
}

async function loadOrientedBitmap(file) {
  // createImageBitmap with imageOrientation: 'from-image' applies EXIF
  // rotation for us, so the canvas we draw to is already upright.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Fall through to the <img> path (older Safari lacks the option).
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('Image decode failed'))
      img.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function sourceSize(source) {
  return {
    width: source.naturalWidth ?? source.width,
    height: source.naturalHeight ?? source.height,
  }
}

// Downscale a photographed page to ~maxEdge on the long side and encode as
// JPEG. Returns { base64 (no "data:" prefix), mime, blob, width, height } —
// width/height are the OUTPUT canvas dimensions, matching the blob the
// caller displays.
export async function prepareImageForOcr(file, { maxEdge = 1600, quality = 0.8 } = {}) {
  const source = await loadOrientedBitmap(file)
  const { width: srcWidth, height: srcHeight } = sourceSize(source)
  const { width, height } = fitWithin(srcWidth, srcHeight, maxEdge)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No 2d context')
  ctx.drawImage(source, 0, 0, width, height)

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob produced null'))), 'image/jpeg', quality)
  })

  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(new Error('Failed to read image data'))
    reader.readAsDataURL(blob)
  })

  return { base64, mime: 'image/jpeg', blob, width, height }
}
