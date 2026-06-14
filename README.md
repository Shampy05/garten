# Garten

A personal language learning tracker inspired by GitHub contribution heatmaps. Turn your reading and study consistency into a beautiful, visual habit loop.

## Features

- **Visual Heatmap**: 52-week garden grid showing your daily learning intensity
- **Multi-Language Support**: Track English, German, French, Welsh, Urdu, Spanish, and any custom languages you add
- **Granular Tracking**: Log specific activity types (Reading, Grammar, Vocabulary) per language
- **Smart Filtering**: View combined progress or drill down to specific languages and activity types
- **Time-Based**: Track hours and minutes for accurate progress measurement
- **Persistent Storage**: localStorage for now, backend-ready for future migration

## Tech Stack

- Vue 3 (Composition API)
- Vite
- Tailwind CSS
- localStorage persistence

## Getting Started

```bash
npm install
npm run dev
```

## Deployment

```bash
npm run build
# Deploy dist/ folder to GitHub Pages
```

## Data Structure

Sessions are stored as atomic entries:
- date
- languageId
- type (reading, grammar, vocabulary)
- hours & minutes

## Future Roadmap

- [ ] Backend API with real database
- [ ] Mobile PWA support
- [ ] Data export/import
- [ ] Streak goals and notifications
