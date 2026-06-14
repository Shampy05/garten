# Garten

A personal language learning tracker inspired by GitHub contribution heatmaps. Turn your reading and study consistency into a beautiful, visual habit loop.

## Features

- **Visual Heatmap**: Month, quarter, and year views with mosaic tiles — each cell shows a pixel-art grid of colored squares representing languages studied that day
- **Multi-Language Mosaic**: In combined view, cells display a 5×5 (month), 3×3 (quarter), or 2×2 (year) grid of tiny colored squares, distributed proportionally by language
- **Intensity Cells**: When filtered to a single language, cells use 8 intensity levels from light to full color
- **Streak Glow**: Cells in a 3+ day streak get a subtle gold ring and glow
- **Language Activity Leaderboard**: Ranked sidebar with medal icons (🥇🥈🥉), current streak (🔥), last-7-days frequency dots, and days active count
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

## Data Structure

Sessions are stored in Supabase as atomic entries:
- `date`
- `language_id` (references `languages.id`)
- `type` (reading, grammar, vocabulary)
- `hours` & `minutes`
