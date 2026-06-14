# Agent Guidelines for Garten

## Project Context

This is a Vue 3 + Vite SPA deployed to GitHub Pages. It uses localStorage for data persistence and follows a component-based architecture.

## Tech Stack Rules

- **Vue 3 Composition API** with `<script setup>` syntax
- **Tailwind CSS** for all styling
- **No external charting libraries** — the heatmap is built with custom CSS grid
- **localStorage** via composable (`useStorage.js`) for all data persistence

## Component Patterns

- Components live in `src/components/`
- Composables live in `src/composables/`
- One component per file, PascalCase naming
- Props down, events up (standard Vue pattern)

## Data Model

All data operations must go through the `useStorage` composable:
- `languages`: Array of { id, name, color, types[] }
- `entries`: Array of { id, date, languageId, type, hours, minutes }

## Color Scheme

- Combined view: Green scale (`#f3f4f6` → `#14532d`)
- Language-specific: Use language.color with 4 intensity levels
- Empty cells: `#f3f4f6`

## UI Patterns

- Log form: Always visible at top, search-box style
- Filters: Horizontal chip bar, multi-select for types
- Stats: Cards beside heatmap on desktop, stacked on mobile

## Deployment

- Build output goes to `dist/`
- Configure base path in `vite.config.js` for GitHub Pages
- Never commit `dist/` to git (add to .gitignore)
