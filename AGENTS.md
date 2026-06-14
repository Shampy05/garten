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
- `entries`: Array of { id, date, languageId, type, hours, minutes, notes } — `languageId` maps to `language_id` in DB
- `user_settings`: { user_id, weekly_goal_hours } — per-user weekly study goal

## Data Caching

Supabase reads are cached in localStorage with a 30-second TTL (`src/lib/cache.js`). On page load, cached data is served instantly and no API call is made. Cache is invalidated on every mutation (add/delete entry, add language). This minimizes Supabase reads on the free tier.

Entries older than 2 years are not fetched — the heatmap only displays data within that window.

## Color Scheme

- Combined view (no filter): Cells show mosaic tiles — a 5×5 (month), 3×3 (quarter), or 2×2 (year) grid of colored squares distributed proportionally by language. Background is `#f3f4f6`.
- Single-language filter: Cells use 8 intensity levels via `getColorAtIntensity()` — solid color blocks from light to full color.
- Empty cells: `#f3f4f6`
- Streak glow: `ring-2 ring-yellow-400/70 shadow-[0_0_8px_rgba(250,204,21,0.25)]` on cells in 3+ day streaks

## UI Patterns

- **Garden Status Card (App.vue)**: The header is a single `bg-white rounded-xl border shadow-sm` card containing:
  - Title + tagline on the left, gear icon + sign-out on the right
  - Status line: streak pill (orange bg, plain number + "day streak") + today-minutes text
  - Weekly goal progress bar (color-coded by language, segmented)
  - LogForm CTA below the status line (full-width button on all breakpoints)
  - This grouping follows the Gestalt proximity principle — title, motivation, and action are visually connected.

- **Log form**: Collapsed to a full-width button, expands to 4-step stepper (language → type → duration → confirm with optional notes). Button is `w-full flex items-center justify-center` (no longer centered/floating). The expanded form renders inside the same header card.

- **Language manager**: Gear icon in the top-right of the header card opens a modal with seed packet language cards. Languages can be removed via the ✕ button on each card. New languages use a curated autocomplete list (no free-form input).

- **Filters**: Horizontal chip bar below stats, multi-select for types.

- **TimeframeSelector**: Renders inside the heatmap column (left side of flex layout), NOT at full page width. Has its own card with `mb-6`.

- **Heatmap + Leaderboard**: Side-by-side on desktop (`lg:flex-row`), stacked on mobile (`flex-col`). The TimeframeSelector sits above the Heatmap inside the left column.

- **Leaderboard (single-line rows)**: Each language row is one horizontal flex line. No emojis (medals or fire), no 7-day frequency dots, no proportional bar. Shows:
  - Rank number (plain 1, 2, 3...)
  - Color dot
  - Language name (truncated)
  - Streak as `Nd` (e.g., `3d`) — orange text, only if > 0
  - Hours logged
  - Title: "Top Languages"

- **Insight card**: Between heatmap and recent sessions.

- **Recent sessions**: Below everything, inside its own card. Two-row layout: top row has language/type/date/duration, bottom row has notes (truncated) + edit/delete actions.

- **Tooltips**: Teleported to body, fixed positioning, scroll-dismiss.

## Design Principles (applied in v2)

The following UX research informed the current design. Apply these when making future UI changes:

1. **Group related elements** (Gestalt proximity): The header card proved that connecting identity (title), motivation (streak), and action (CTA) in one container creates a clear visual hierarchy. Avoid floating disconnected elements.

2. **Full-width is often better than centered**: The "Log a session" button was centered and floating, which created whitespace without context. Making it full-width inside the card anchored it and eliminated visual imbalance.

3. **Remove before adding (aesthetic/minimalist heuristic)**: The leaderboard had medals, fire emoji, 7-day dots, a proportional bar, and a "days active" label. We removed everything except rank, name, hours, and streak. The lost info (daily frequency, relative share) was either duplicated by the heatmap or implied by the rank order. Always ask: "does this element support the user's primary goal?"

4. **Each component should own its width context**: The TimeframeSelector was full page width even though it only controls the heatmap. It now lives inside the heatmap column. Components should be scoped to the context they affect.

5. **No emojis in data displays**: Emojis (🥇 🥈 🥉 🔥) added visual noise without information value. Plain numbers and text are cleaner and more professional.

6. **Status bridges motivation**: Showing "3 day streak · 30m studied today" between the title and the CTA gives the user a reason to act. This follows NN/G's visibility of system status heuristic.

7. **Progressive disclosure**: The LogForm shows only the CTA at rest. Expanding reveals steps one at a time. The leaderboard shows summary rankings; detailed daily patterns require one more click (language filter in the heatmap).

## Authentication

Email/password auth via Supabase. On sign-up, users pick languages from a curated autocomplete list before entering the app. On sign-in, they go straight to the app. RLS policies scope all data to the authenticated user.

## Activity Types

Fixed set defined in `src/lib/types.js`: reading, grammar, vocabulary, listening, speaking, writing, pronunciation. Displayed as toggleable pills in both the LogForm and LanguageManager.

## Deployment

- Build output goes to `dist/`
- GitHub Pages via Actions workflow (`.github/workflows/deploy.yml`)
- `base: './'` in vite.config.js for relative paths
- Never commit `dist/` to git (add to .gitignore)
