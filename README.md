# Garten

A personal language learning tracker inspired by GitHub contribution heatmaps. Turn your reading and study consistency into a beautiful, visual habit loop.

## Features

- **Visual Heatmap**: Month, quarter, and year views with a colorful mosaic — each cell shows the dominant language(s) studied that day with diagonal splits for multiple languages
- **Language Stack Bars**: Tiny proportional bars inside cells showing each language's share of the day's time
- **Multi-Language Support**: Track any language with custom colors and activity types
- **Smart Filtering**: View combined progress or drill down to specific languages and activity types
- **Insight Card**: Auto-generated narrative — top language, longest streak, weekend/weekday bias
- **Language Leaderboard**: Ranked sidebar showing hours per language in the current period
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
