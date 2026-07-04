// Bloom-tinted favicon — a tiny 5-petal flower SVG in the gardener's chosen
// bloom colours, encoded as a data URI so it can replace the static
// /sprout_icon.svg link at runtime with no network request.

export function bloomFaviconDataUri(petal, center) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<circle cx="16" cy="16" r="15.25" fill="#f0f8f1" stroke="#dcefde" stroke-width="1.5"/>` +
    [0, 72, 144, 216, 288]
      .map((angle) => `<ellipse cx="16" cy="9" rx="3.4" ry="5.4" fill="${petal}" transform="rotate(${angle} 16 16)"/>`)
      .join('') +
    `<circle cx="16" cy="16" r="3.2" fill="${center}"/>` +
    `</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
