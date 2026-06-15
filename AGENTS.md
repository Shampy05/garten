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
- `languages`: Array of { id, name, color, types[], prior_hours } — stored as-is in Supabase. `prior_hours` (numeric, default 0) is the "starting point" credited from experience before tracking; feeds the Fluency Horizon only.
- `entries`: Array of { id, date, languageId, type, hours, minutes, notes } — `languageId` maps to `language_id` in DB
- `user_settings`: { user_id, weekly_goal_hours, native_language } — per-user weekly study goal and L1. `native_language` (nullable text) feeds the Fluency Horizon's proximity-based target adjustment; NULL = English baseline.

## Data Caching

Supabase reads are cached in localStorage with a 30-second TTL (`src/lib/cache.js`). On page load, cached data is served instantly and no API call is made. Every mutation (add/delete/update entry or language) writes the new in-memory state back to the cache with a fresh timestamp, so reloads after an edit keep hitting the cache instead of the network. This minimizes Supabase reads on the free tier. Settings (`weekly_goal_hours`, `native_language`) are not cached and are always read from Supabase.

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

- **Fluency Horizon card**: Below the insight card. One thin progress bar per language showing accumulated hours (prior starting point at 40% opacity + logged hours at full color) against a research-based proficiency target from `src/lib/proficiency.js` (FSI difficulty categories → hours to ~CEFR B2/C1 for English speakers). Status line gives a pace-based ETA from a recency-weighted forecast: minutes are bucketed per-day over a 56-day window (`PACE_WINDOW_DAYS`) and weighted with exponential decay (`weightedWeeklyPace`, 14-day half-life) so recent sessions count more and the ETA doesn't whipsaw when one ages out. A momentum signal (`paceMomentum`, last 28 days vs the prior 28) shows "+N% / −N% vs last month" in green/gray when the swing is ≥10%. Targets are native-language-aware: `targetHours(name, nativeLanguage)` applies `nativeMultiplier`, a discount derived from a `LINEAGE` family-tree proximity model (`relationRank`, 1–5) normalized against English — it can only lower a target where the learner's L1 is closer to the target than English is, never raise it, so English-L1 and unmodelled pairs are exact no-ops. The L1 picker (curated `NATIVE_LANGUAGES` list) lives in the LanguageManager modal and also re-bases the per-language Starting Point credit. Each row runs through three phases so advanced learners aren't dead-ended: `learning` (toward the base ~B2/C1 target), `mastery` (once base is reached the bar rescales to `masteryHours` ≈ `MASTERY_FACTOR` 1.6× base, a green "Proficient" badge + emerald proficiency tick appear, and the ETA reads "to mastery"), and `maintaining` (past the mastery target — green "Mastery reached — maintaining", momentum hidden). Milestone ticks and the hours readout are all scaled to the active goal. The CEFR starting-point fractions (`LEVELS` in proficiency.js) are derived from Cambridge English's published guided-learning-hours per level, normalised to the C1 midpoint (~750h): A1 0.13, A2 0.25, B1 0.50, B2 0.73, C1 1.0; `MASTERY_FACTOR` 1.5 matches Cambridge's C2/C1 hour ratio. These are documented as estimates with the citation inline in the source. "Set starting point" opens the LanguageManager. Targets are framed as estimates, no emojis. Starting point is captured per-language via a CEFR level picker (not raw hours) in the LanguageManager seed packet, which maps the level to a fraction of that language's target.

- **Data export**: Quiet "Export your data" footer inside the LanguageManager modal (gear/settings surface). Two buttons — Download CSV / Download JSON — wired to `src/lib/export.js`. CSV is a flat one-row-per-session table (`date,language,type,hours,minutes,total_minutes,notes`) with language names resolved; JSON is a denormalized snapshot (summary header + sessions with language names inlined + a backup of languages/prior_hours and weekly goal). Pure client-side via Blob download, no backend. Buttons disable when there is nothing to export. Filenames are date-stamped (`garten-sessions-YYYY-MM-DD.csv`, `garten-export-YYYY-MM-DD.json`).

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
