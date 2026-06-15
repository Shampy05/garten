# Garten

A personal language learning tracker inspired by GitHub contribution heatmaps. Turn your reading and study consistency into a beautiful, visual habit loop.

## Features

- **Visual Heatmap**: Month, quarter, and year views with mosaic tiles — each cell shows a pixel-art grid of colored squares representing languages studied that day
- **Multi-Language Mosaic**: In combined view, cells display a 5×5 (month), 3×3 (quarter), or 2×2 (year) grid of colored squares, distributed proportionally by language
- **Intensity Cells**: When filtered to a single language, cells use 8 intensity levels from light to full color
- **Streak Glow**: Cells in a 3+ day streak get a subtle gold ring and glow
- **Language Activity Leaderboard**: Clean ranked sidebar with plain numbers, color-coded languages, current streak, and hours logged
- **Garden Status Card**: Unified header with title, motivational status line, weekly goal progress bar, and the "Log a session" CTA
- **Weekly Study Goal**: Set a target (e.g., 5h/week) and see a color-coded progress bar split by language
- **Smart Filtering**: View combined progress or drill down to specific languages and activity types
- **Stepper Log Form**: 4-step session entry with quick duration presets and optional notes
- **Edit Sessions**: Click "Edit" on any recent session to change language, type, duration, date, or notes
- **Session Notes**: Add optional notes to sessions (e.g., "read chapter 3", "Duolingo lesson 5")
- **Language Seeds Modal**: Manage languages via a gear icon, displayed as styled seed packets. Languages removed via ✕ button
- **Language Autocomplete**: Curated list of ~130 languages — no free-form input, no misspellings
- **Activity Type Pills**: Fixed types (reading, grammar, vocabulary, listening, speaking, writing, pronunciation) as toggleable pills
- **Insight Card**: Auto-generated narrative — top language, longest streak, weekend/weekday bias
- **Fluency Horizon**: Each language's accumulated hours plotted against a research-based proficiency target (FSI language-difficulty categories → hours to ~CEFR B2/C1 for English speakers), with a recency-weighted pace ETA and a momentum signal (pace up/down vs the previous month)
- **Starting Point**: Set a rough prior level (Beginner → Advanced) per language so existing experience counts toward your horizon instead of starting from zero
- **Native-Language-Aware Targets**: Set your first language and the Fluency Horizon discounts targets by language-family proximity (e.g. a Spanish speaker reaches Portuguese far faster). Only ever lowers a target where your L1 gives a head start, never raises it; English speakers and unmodelled pairs are unchanged
- **Stretch & Maintenance Horizon**: Reaching professional proficiency isn't a dead end — the bar extends to a mastery (~C2) target with a "Proficient" badge, then settles into a "maintaining" state once mastery is reached
- **Data Export**: Download all sessions as CSV (flat spreadsheet table) or a JSON snapshot (denormalized with language names + a summary header and full backup of languages/goal) from the gear menu — fully client-side, for backups, analysis, or feeding to an LLM
- **Persistent Storage**: Supabase (PostgreSQL) backend — data persists across devices
- **Email/Password Auth**: Per-user data via Supabase RLS. Language picker on first sign-up

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

Enable email/password auth in the Supabase dashboard (Authentication → Providers → Email). RLS policies scope all data to the authenticated user.

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
- `notes` (optional text)

User settings:
- `weekly_goal_hours` (nullable numeric)

## Performance

Supabase data is cached in localStorage with a 30-second TTL. On page refresh, cached data is served immediately — no API call is made unless the cache has expired. The cache is invalidated after any mutation (logging a session, adding a language, deleting an entry). Entries older than 2 years are not fetched.
