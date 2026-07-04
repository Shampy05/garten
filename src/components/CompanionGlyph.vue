<template>
  <svg viewBox="0 0 16 16" :width="size" :height="size">
    <g v-if="kind === 'ladybird'">
      <circle cx="8" cy="8.5" r="5" fill="#c0392b" />
      <line x1="8" y1="3.6" x2="8" y2="13.4" stroke="#3a2a20" stroke-width="0.8" />
      <circle cx="8" cy="4.6" r="1.7" fill="#3a2a20" />
      <circle cx="6.2" cy="7.5" r="0.8" fill="#3a2a20" />
      <circle cx="10" cy="9.3" r="0.8" fill="#3a2a20" />
    </g>
    <g v-else-if="kind === 'bee'">
      <ellipse cx="8" cy="8" rx="5" ry="3.6" fill="#e0a83e" />
      <rect x="4.2" y="5.6" width="1.4" height="4.8" fill="#3a2a20" />
      <rect x="7.3" y="5.6" width="1.4" height="4.8" fill="#3a2a20" />
      <rect x="10.4" y="5.6" width="1.4" height="4.8" fill="#3a2a20" />
      <ellipse cx="4" cy="5.8" rx="2.6" ry="1.8" fill="#fdfaf3" opacity="0.85" />
    </g>
    <g v-else-if="kind === 'butterfly'">
      <ellipse cx="5.5" cy="6.5" rx="3.4" ry="2.6" fill="#8568b4" transform="rotate(-15 5.5 6.5)" />
      <ellipse cx="10.5" cy="6.5" rx="3.4" ry="2.6" fill="#8568b4" transform="rotate(15 10.5 6.5)" />
      <ellipse cx="6" cy="10.5" rx="2.4" ry="1.8" fill="#bfa8dc" transform="rotate(-15 6 10.5)" />
      <ellipse cx="10" cy="10.5" rx="2.4" ry="1.8" fill="#bfa8dc" transform="rotate(15 10 10.5)" />
      <line x1="8" y1="4" x2="8" y2="12" stroke="#3a2a20" stroke-width="0.8" />
    </g>
    <g v-else-if="kind === 'snail'">
      <path
        d="M4 12.5 Q3 8.5 7 8 Q10.5 7.5 10 4.7 Q9.7 3.1 7.8 3.7 Q6.6 4.1 6.9 5.5"
        fill="none" stroke="#8a6a4a" stroke-width="1.4" stroke-linecap="round"
      />
      <ellipse cx="6" cy="12.5" rx="5" ry="1.6" fill="#7a9a6a" />
      <circle cx="10.5" cy="10.8" r="1.2" fill="#7a9a6a" />
      <line x1="10.3" y1="9.8" x2="9.7" y2="8.5" stroke="#7a9a6a" stroke-width="0.6" />
      <line x1="11.1" y1="9.9" x2="11.6" y2="8.5" stroke="#7a9a6a" stroke-width="0.6" />
    </g>
  </svg>
</template>

<script setup>
// The four bloom-companion glyphs. Kept as their own component so they can
// render both standalone (the picker swatches) and nested inside
// BloomAvatar's SVG (nested <svg> honours x/y/width/height positioning).
defineProps({
  kind: { type: String, default: '' },
  size: { type: Number, default: 16 },
})
</script>
