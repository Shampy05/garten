# Agent Guidelines for Garten

## Project Context

This is a Vue 3 + Vite SPA deployed to GitHub Pages. It uses Supabase (PostgreSQL) for data persistence and follows a component-based architecture.

## Tech Stack Rules

- **Vue 3 Composition API** with `<script setup>` syntax
- **Tailwind CSS** for all styling
- **No external charting libraries** — the heatmap is built with custom CSS grid
- **Supabase** via `@supabase/supabase-js` for all data persistence
- Components are responsive: `p-3 sm:p-6` pattern on cards, `flex-wrap` on mobile

## Component Patterns

- Components live in `src/components/`
- Composables live in `src/composables/`
- One component per file, PascalCase naming
- Props down, events up (standard Vue pattern)

## Data Model

All data operations go through the `useStorage` composable which maps between JS camelCase and DB snake_case:
- `languages`: Array of { id, name, color, types[] } — stored as-is in Supabase
- `entries`: Array of { id, date, languageId, type, hours, minutes } — `languageId` maps to `language_id` in DB

## Color Scheme

- Combined view (mosaic): Dominant language color(s) with intensity based on total minutes. Up to 3 languages shown as multi-stop diagonals.
- Language-specific: Use language.color with 4 intensity levels
- Empty cells: `#f3f4f6`

## UI Patterns

- Log form: Always visible at top, search-box style
- Filters: Horizontal chip bar, multi-select for types
- Stats: Cards below log form
- Heatmap + Leaderboard side-by-side on desktop, stacked on mobile
- Insight card between heatmap and recent sessions
- Tooltips use `max-w-[90vw]` to prevent overflow on mobile

## Deployment

- Build output goes to `dist/`
- GitHub Pages via Actions workflow (`.github/workflows/deploy.yml`)
- `base: './'` in vite.config.js for relative paths
- Never commit `dist/` to git (add to .gitignore)
