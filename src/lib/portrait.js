// SVG → PNG "garden portrait" rasterizer.
//
// Snapshot the live <svg> as a deterministic PNG download. The scene is built
// from pure shapes (no remote hrefs), so the canvas can't taint and the
// image always rasterizes successfully. Cloning detaches the live DOM so the
// original keeps animating while the user sees a frozen portrait frame.

import { downloadFile } from './export.js'
import { localDateStr } from './date.js'

// "garten-garden-2026-07-04.png"
export function portraitFilename(now = new Date()) {
  return `garten-garden-${localDateStr(now)}.png`
}

// Turn a live <svg> element into a PNG Blob. Strips the gs-live animation
// gate (belt-and-braces — the rasterized copy can't reach the stylesheet
// anyway) and the gs-* animation classes that won't apply inside the <img>.
// Caller supplies the viewport size and scale; the output canvas is exactly
// (width * scale) × (height * scale) pixels.
export function svgToPngBlob(svgEl, { scale = 2, background = '#f6f7f2', width = 1200, height = 320 } = {}) {
  return new Promise((resolve, reject) => {
    if (!svgEl) {
      reject(new Error('No svg element'))
      return
    }
    const clone = svgEl.cloneNode(true)
    clone.classList.remove('gs-live')
    // Drop any class that carries an animation — the frozen frame must be
    // the base pose. Visual properties (fill, opacity, transform) live on
    // the elements as attributes or inline styles, so they're preserved.
    clone.querySelectorAll('[class*="gs-"]').forEach((el) => {
      el.classList.remove('gs-firefly')
      el.classList.remove('gs-drift')
      el.classList.remove('gs-sway')
      el.classList.remove('gs-wander-air')
      el.classList.remove('gs-wander-ground')
      el.classList.remove('gs-wander-slow')
      el.classList.remove('gs-bob')
      el.classList.remove('gs-cloud')
      el.classList.remove('gs-sun-rays')
      el.classList.remove('gs-bee-fly')
    })
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', String(width))
    clone.setAttribute('height', String(height))

    const xml = new XMLSerializer().serializeToString(clone)
    const uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)

    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(width * scale)
        canvas.height = Math.round(height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('No 2d context'))
          return
        }
        if (background) {
          ctx.fillStyle = background
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('toBlob produced null'))
            return
          }
          resolve(blob)
        }, 'image/png')
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = (e) => reject(new Error('SVG image load failed'))
    img.src = uri
  })
}

// One-shot helper: rasterize + download. Catches errors and rethrows so the
// caller (GardenScene.vue) can toast.
export async function downloadGardenPortrait(svgEl, { scale = 2 } = {}) {
  const blob = await svgToPngBlob(svgEl, { scale })
  downloadFile(portraitFilename(), blob, 'image/png')
}
