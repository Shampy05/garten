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

- Combined view (no filter): Cells show mosaic tiles — a 5×5 (month), 3×3 (quarter), or 2×2 (year) grid of colored squares distributed proportionally by language. Background is `#f3f4f6`.
- Single-language filter: Cells use 8 intensity levels via `getColorAtIntensity()` — solid color blocks from light to full color.
- Empty cells: `#f3f4f6`
- Streak glow: `ring-2 ring-yellow-400/70 shadow-[0_0_8px_rgba(250,204,21,0.25)]` on cells in 3+ day streaks

## UI Patterns

- Log form: Collapsed to single button, expands to 4-step stepper
- Language manager: Gear icon in header opens modal with seed packet cards
- Filters: Horizontal chip bar, multi-select for types
- Heatmap + Leaderboard side-by-side on desktop, stacked on mobile
- Leaderboard shows medals, streak fire, 7-day frequency dots, days active
- Insight card between heatmap and recent sessions
- Tooltips: Teleported to body, fixed positioning, scroll-dismiss

## Deployment

- Build output goes to `dist/`
- GitHub Pages via Actions workflow (`.github/workflows/deploy.yml`)
- `base: './'` in vite.config.js for relative paths
- Never commit `dist/` to git (add to .gitignore)
