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

- Combined view (no filter): A day studied in a **single** language renders as one solid intensity block (so it reads as a clean cell, not a grid). A day that mixes **two or more** languages fans out into a mosaic — a 5×5 (month), 3×3 (quarter), or 2×2 (year) grid of colored squares distributed proportionally by language — over a `#f3f4f6` backdrop. A tiled cell is therefore a meaningful signal of a varied day. `showMosaic(day)` in `Heatmap.vue` gates this on `dayLanguageCount(day) > 1`.
- Single-language filter: Cells use 8 intensity levels via `getColorAtIntensity()` — solid color blocks from light to full color.
- Empty cells: `#f3f4f6`
- Streak glow: `ring-2 ring-yellow-400/70 shadow-[0_0_8px_rgba(250,204,21,0.25)]` on cells in 3+ day streaks

## Design System ("Garden Journal")

The app shares one visual language. Reuse these instead of hand-rolling card/button/input styles, so the look stays cohesive and future changes don't drift:

- **Tokens** (`tailwind.config.js`): a forest-green `garden` ramp (`garden-50`…`garden-900`) for chrome/accents/CTAs; a warm `line` hairline-border color; layered shadows `shadow-card` / `shadow-card-hover` / `shadow-hero` / `shadow-pill`; and motion keyframes `fade-up`, `grow-in`, `sprout`, `sway`. Body text uses warm `stone-*` grays (not cool `gray-*`).
- **Component classes** (`@layer components` in `src/styles/garden.css`):
  - `gp-card` — the standard white `rounded-2xl` surface (border + soft shadow); `gp-pad` = `p-4 sm:p-6`; `gp-card-hover` adds a lift on hover.
  - `gp-btn-primary` — gradient forest-green CTA with glassy highlight and disabled state; `gp-btn-ghost` — quiet bordered secondary button.
  - `gp-input` — text inputs / selects / textareas (rounded, garden focus ring).
  - `gp-icon-btn` — square icon button; `gp-chip` — pill/chip; `gp-title` — `font-display` section heading.
- **Canvas**: the page background is a warm paper gradient (sky→soil) set on `body`; screens render directly on it (no `bg-gray-50` wrappers). Numbers use `tabular-nums`; headings use Fraunces (`font-display`).
- **Whimsy is subtle**: a swaying sprout on load, sprout-tilt on header hover, seed-lift on CTA hover, and card grow-in / fade-up entrances. A `prefers-reduced-motion` guard disables animation. Keep additions in this register — no loud celebrations or emoji in data displays.

## UI Patterns

- **Garden Status Card (App.vue)**: The header is a single `gp-card` (white `rounded-2xl` surface, hairline border, soft layered shadow) with a faint botanical wash along the top edge, containing:
  - Title + tagline on the left; on the right a single **account menu** — an avatar button (user initial, with a small red dot when notifications are pending) that opens a dropdown consolidating Notifications, Manage languages, and Sign out. These three controls used to sit loose in the header; folding them into one menu keeps the card focused on identity → motivation → action.
  - Status line: streak pill (orange, flame icon + "day streak") + today-minutes text ("Nm tended today")
  - Weekly goal progress bar (color-coded by language, segmented). Each segment carries a `title`/`aria-label`, and when more than one language contributes a small text legend (dot + name) sits below the bar so the split isn't conveyed by color alone.
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

- **Analytics tabs**: Between the heatmap and recent sessions, Insights / Activity / Horizon live in a single tabbed panel (a segmented control switches one card into view at a time) rather than stacking three full-height cards — this keeps the page from becoming a long vertical scroll. The active tab is held in `analyticsTab` in `App.vue`.
  - **Insight card**: auto-generated stat tiles (total, languages, daily avg, best streak, busiest day, top language).
  - **Activity Breakdown**: one stacked bar per language split by activity type (language color at stepped opacity), with a full-word legend ("Reading · 2h 10m") — no single-letter initials — and `title` tooltips on each segment.

- **Fluency Horizon card**: The third analytics tab (Horizon). The methodology paragraph is tucked behind an info (ⓘ) toggle next to the title (`showInfo`), collapsed by default. One thin progress bar per language showing accumulated hours (prior starting point at 40% opacity + logged hours at full color) against a research-based proficiency target from `src/lib/proficiency.js` (FSI difficulty categories → hours to ~CEFR B2/C1 for English speakers). Status line gives a pace-based ETA from a recency-weighted forecast: minutes are bucketed per-day over a 56-day window (`PACE_WINDOW_DAYS`) and weighted with exponential decay (`weightedWeeklyPace`, 14-day half-life) so recent sessions count more and the ETA doesn't whipsaw when one ages out. A momentum signal (`paceMomentum`, last 28 days vs the prior 28) shows "+N% / −N% vs last month" in green/gray when the swing is ≥10%. Targets are native-language-aware: `targetHours(name, nativeLanguage)` applies `nativeMultiplier`, a discount derived from a `LINEAGE` family-tree proximity model (`relationRank`, 1–5) normalized against English — it can only lower a target where the learner's L1 is closer to the target than English is, never raise it, so English-L1 and unmodelled pairs are exact no-ops. The L1 picker (curated `NATIVE_LANGUAGES` list) lives in the LanguageManager modal and also re-bases the per-language Starting Point credit. Each row runs through three phases so advanced learners aren't dead-ended: `learning` (toward the base ~B2/C1 target), `mastery` (once base is reached the bar rescales to `masteryHours` ≈ `MASTERY_FACTOR` 1.6× base, a green "Proficient" badge + emerald proficiency tick appear, and the ETA reads "to mastery"), and `maintaining` (past the mastery target — green "Mastery reached — maintaining", momentum hidden). Milestone ticks and the hours readout are all scaled to the active goal. The CEFR starting-point fractions (`LEVELS` in proficiency.js) are derived from Cambridge English's published guided-learning-hours per level, normalised to the C1 midpoint (~750h): A1 0.13, A2 0.25, B1 0.50, B2 0.73, C1 1.0; `MASTERY_FACTOR` 1.5 matches Cambridge's C2/C1 hour ratio. These are documented as estimates with the citation inline in the source. "Set starting point" opens the LanguageManager. Targets are framed as estimates, no emojis. Starting point is captured per-language via a CEFR level picker (not raw hours) in the LanguageManager seed packet, which maps the level to a fraction of that language's target.

- **Data export**: Quiet "Export your data" footer inside the LanguageManager modal (gear/settings surface). Two buttons — Download CSV / Download JSON — wired to `src/lib/export.js`. CSV is a flat one-row-per-session table (`date,language,type,hours,minutes,total_minutes,notes`) with language names resolved; JSON is a denormalized snapshot (summary header + sessions with language names inlined + a backup of languages/prior_hours and weekly goal). Pure client-side via Blob download, no backend. Buttons disable when there is nothing to export. Filenames are date-stamped (`garten-sessions-YYYY-MM-DD.csv`, `garten-export-YYYY-MM-DD.json`).

- **Recent sessions**: Below everything, inside its own card. A **day-grouped timeline** (`groupedRecentEntries` in App.vue): sessions are bucketed under relative-day headers (`relativeDayLabel`: Today / Yesterday / weekday within 7 days / "Mon, Jun 15" older) with that day's total time on the right under a hairline `border-line`. Each row has a thin left language-color accent bar, language · type, duration (`fmtMinutes`, drops a leading 0h), notes (truncated), and edit/delete on hover. Still paginated by `recentLimit` ("Show more").

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

## Garden Circle (social)

The Friends tab is an opt-in social layer for users who create a `profiles` row. It is owned by `useSocial.js` and rendered by `src/components/social/SocialView.vue`.

Social tables (all scoped to self + accepted friends via RLS or SECURITY DEFINER functions):
- `profiles`, `friendships` — handle and friend relationships.
- `circle_commitments` — weekly public language commitment per user.
- `focus_sessions` — timed focus sessions with real-time presence; completed sessions auto-log an `entries` row.
- `activity_events` — celebration feed only (`milestone`, `bloom`, `commitment_progress`, `circle_report`, `new_language`). Per-session and summary dispatches were removed. `new_language` (migration `20260620000000`) fires the first time a gardener ever logs a session in a language ("planted a new language"), deduped to once per (gardener, language) via a partial unique index — a rare, meaningful crossing rather than per-session noise.
- `event_reactions`, `event_comments`, `waters` — reactions, notes, and daily "water" taps attached to celebration events.
- `nudges` — `cheer` / `nudge` (against a commitment) or `invite` (against a `focus_session_id`); shown in the notifications bell.

Two "deepen the circle" features (migration `20260619000000`):
- **Commitment streaks** — `circle_commitment_streaks()` (SECURITY DEFINER) returns consecutive weeks each gardener met ≥1 weekly commitment, for self + friends. The in-progress current week only counts once met, so an unfinished week never breaks the streak. Surfaced as an amber Flame "Nw" badge on each `CommitmentCard` (`commitmentStreaks` map in `useSocial`).
- **Targeted focus invites** — `inviteToFocus(sessionId, recipientIds)` inserts `invite` nudges linked to the focus session. The StartFocusSessionModal has an optional friend-invite chip row; invitees see "X invited you to focus on [lang] · N min" in their notifications bell.

**Grow buddies** (migration `20260621000000`) — a pact between two friends to grow a shared language toward a *combined* weekly goal, so progress pools both gardeners' minutes and checking in on each other is intrinsic (unlike solo commitments). `buddy_pacts` (proposer_id + canonical user_a < user_b pair + language_name + target_minutes + status pending/accepted/ended; one live pact per pair per language via a partial unique index). `buddy_pacts_with_progress()` (SECURITY DEFINER) returns the caller's live pacts with this-week combined/`my_minutes`/`buddy_minutes` and a `joint_streak` from `buddy_joint_streak()` (consecutive weeks the pair hit the combined goal; in-progress week counts only once met). `useSocial` owns `buddyPacts` (accepted) / `pendingBuddyPacts` (incoming) / `outgoingBuddyPacts` and `proposeBuddyPact` / `acceptBuddyPact` / `declineBuddyPact` / `endBuddyPact`, with a realtime channel. UI: a top-level `BuddyInbox` (accept/decline invites, mirrors `RequestsInbox`), and inside the Commitments tab a `GrowBuddiesPanel` above the solo commitments with `BuddyPactCard`s (paired avatars, combined progress bar, You/buddy split, amber Flame joint-streak badge, bloom flourish at 100%) and a `ProposeBuddyModal` (pick friend + shared language + combined target). Pacts are friend-only (RLS + `are_friends`).

UI layout on the Friends page (top to bottom): a **circle-pulse hero** (identity + a live status line: "N gardeners focusing now" with a breathing dot, plus "Xh tended together this week" from `circleWeekMinutes`, a week snapshot of the leaderboard total), requests inbox, focus sessions, then a **segmented tabbed panel** (Leaderboard / Commitments / Celebrations) so the data-heavy sections share one card instead of stacking — mirrors the analytics tabs in App.vue (`activeTab` in SocialView). When the user has **no friends yet**, the tabs are replaced by a single "Plant your circle" invite card (embedded `FriendSearch`) rather than a row of empty boxes. Below: friends list and friend search.

Live/whimsy details, kept in the design-system register (no emojis in data displays): `focusingNow` (distinct, non-expired active sessions) drives the hero dot, the focus-sessions presence line, a breathing ring on your active timer, and a breathing live-dot on friends' session avatars (`animate-breathe` token). The leaderboard uses the forest-green `garden` ramp for rank badges (no amber/orange medals); your own row carries a subtle ring. CommitmentCard speaks garden (Not planted yet / Sprouting / Growing / In bloom, with a bloom flourish at 100% and a sunshine Cheer button); `CommitmentsPanel` shows "N of M in bloom this week" social proof. The reaction palette offers water / sun / bloom / leaf / **bee**.

**Celebrations tab (`CelebrationFeed.vue`)** is framed as "moments worth witnessing", not a self-stat log. Three reinforcing pieces beyond the raw feed:
- **Coming up (anticipation)** — a calm strip atop the feed showing the most imminent crossings (max 2, ranked by urgency): a nearing streak milestone (`upcomingMilestones`, computed from entries in App.vue from `STREAK_MILESTONES` [7,14,30,50,100,200,365], surfaced only when ≤7 days out, threaded App.vue → SocialView → CelebrationFeed) and self-commitments close to completion (from `commitments` in the composable). A milestone you can see approaching motivates before it lands.
- **Reactions land back** — on your *own* celebrations, a garden-green line names who reacted ("Maria & Sam celebrated this"), resolved from `reactionsByEvent` + the `friends` list. The witnessing is the reward, not the stat.
- **Freshness decay** — celebrations within 7 days (by `occurred_on`) read bright; older ones fade under a quiet "Earlier" divider (`firstStaleId` / `isStale`), so the feed never becomes an undifferentiated wall.

## Activity Types

Fixed set defined in `src/lib/types.js`: reading, grammar, vocabulary, listening, speaking, writing, pronunciation. Displayed as toggleable pills in both the LogForm and LanguageManager.

## Deployment

- Build output goes to `dist/`
- GitHub Pages via Actions workflow (`.github/workflows/deploy.yml`)
- `base: './'` in vite.config.js for relative paths
- Never commit `dist/` to git (add to .gitignore)
