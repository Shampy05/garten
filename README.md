# Garten

A personal language learning tracker inspired by GitHub contribution heatmaps. Turn your reading and study consistency into a beautiful, visual habit loop.

## Features

- **Visual Heatmap**: Month, quarter, and year views with mosaic tiles — each cell shows a pixel-art grid of colored squares representing languages studied that day
- **Multi-Language Mosaic**: In combined view, cells display a 5×5 (month), 3×3 (quarter), or 2×2 (year) grid of tiny colored squares, distributed proportionally by language
- **Intensity Cells**: When filtered to a single language, cells use 8 intensity levels from light to full color
- **Streak Glow**: Cells in a 3+ day streak get a subtle gold ring and glow
- **Language Activity Leaderboard**: Clean ranked sidebar with plain numbers, color-coded languages, current streak, and hours logged — no emojis or redundant visual noise
- **Garden Status Card**: Unified header containing the app title, motivational status line (streak + today's minutes), and the main "Log a session" CTA — creates visual hierarchy and bridges identity with the primary action
- **Smart Filtering**: View combined progress or drill down to specific languages and activity types
- **Stepper Log Form**: Step-by-step session entry with quick duration presets
- **Language Seeds Modal**: Manage languages via a gear icon, displayed as styled seed packets
- **Insight Card**: Auto-generated narrative — top language, longest streak, weekend/weekday bias
- **Time-Based**: Track hours and minutes for accurate progress measurement
- **Persistent Storage**: Supabase (PostgreSQL) backend — data persists across devices

## Tech Stack

- Vue 3 (Composition API + `<script setup>`)
- Vite
- Tailwind CSS
- Supabase

## Getting Started

```bash
npm install
npm run dev        # Vite dev server
npm run build      # Production build to dist/
```

The Supabase anon key is embedded in the client bundle. For production, set up proper Row Level Security policies and consider an auth flow.

## Deployment

Deploys automatically to GitHub Pages on push to `main` via `.github/workflows/deploy.yml`.

```bash
git push origin main
```

## UX Design Principles (applied in v2)

This app was refined by researching patterns from Duolingo, GitHub, Forest, Streaks, and UX best practices (NN Group, Laws of UX):

- **Unified header card**: Title, status line, and primary CTA are grouped in one visual container (Gestalt proximity principle). The floating, disconnected "Log a session" button was anchored inside the card.
- **Motivational status bridge**: A streak + today-minutes line sits between the title and the CTA, giving users a reason to act (visibility of system status, gamification without clutter).
- **Full-width CTA**: The primary action button spans the full card width on all breakpoints, eliminating empty space and anchoring the card's bottom edge.
- **Single-line leaderboard**: Each language row shows rank, color dot, name, streak, and hours on one horizontal line. Removed: 7-day frequency dots (duplicated the heatmap), proportional bar (hours + rank already convey proportion), medal emojis (added visual noise), fire emoji (used plain text instead).
- **Timeframe selector aligned**: Moved inside the heatmap column so the Month/Quarter/Year bar matches the heatmap width instead of stretching full page width.
- **Aesthetic & Minimalist Design (NN/G Heuristic #8)**: Every visual element was evaluated for whether it supports the user's primary goal of logging and viewing study progress.
- **Progressive disclosure (Hick's Law)**: Collapsed LogForm at rest, 4-step stepper when active. Leaderboard shows summary data; detailed per-language patterns are one click away via filters.
- **Remove before adding**: We removed 7-day dots, proportional bars, medal emojis, fire emojis, and floating CTA positioning. In each case, the lost information was available elsewhere (heatmap, hours display, rank order) or was not essential to the primary task.

## Data Structure

Sessions are stored in Supabase as atomic entries:
- `date`
- `language_id` (references `languages.id`)
- `type` (reading, grammar, vocabulary, listening, speaking, writing, pronunciation)
- `hours` & `minutes`

## Performance

Supabase data is cached in localStorage with a 30-second TTL. On page refresh, cached data is served immediately — no API call is made unless the cache has expired. The cache is invalidated after any mutation (logging a session, adding a language, deleting an entry). Entries older than 2 years are not fetched.
