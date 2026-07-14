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
- `user_settings`: { user_id, weekly_goal_hours, native_language, activity_goals } — per-user weekly study goal and L1. `native_language` (nullable text) feeds the Fluency Horizon's proximity-based target adjustment; NULL = English baseline. `activity_goals` (jsonb, migration `20260702000000`) maps activity type → target hours/week, e.g. `{"reading": 3}`; missing key = no goal set for that type. Mirrors `weekly_goal_hours` but scoped per activity type instead of one overall total — see "Activity goals" below.

The Reading Library (Library tab) persists through its own `useBooks` composable, not `useStorage` — two per-user tables joined 1:1 in memory under each book's `.record`:
- `books`: { id, externalId, title, author, coverUrl, description, languageCode } — saved external-book metadata; `external_id` is unique per user (re-saving updates, never duplicates).
- `reading_records`: { book_id, target_language, status, rating, difficulty, notes, saved_at, started_at, finished_at, current_page, total_pages } — the user's reading data, PK `(user_id, book_id)`, FK → `books`. See the Reading Library section.

## Data Caching

Supabase reads are cached in localStorage with a 30-second TTL (`src/lib/cache.js`). On page load, cached data is served instantly and no API call is made. Every mutation (add/delete/update entry or language) writes the new in-memory state back to the cache with a fresh timestamp, so reloads after an edit keep hitting the cache instead of the network. This minimizes Supabase reads on the free tier. Settings (`weekly_goal_hours`, `native_language`) are not cached and are always read from Supabase. The Reading Library reuses the same cache module under a separate `books_<uid>` key (→ `garten_data_books_<uid>`) so it never clobbers the main `garten_data_<uid>` entry; the Word Garden does the same under `vocab_<uid>` (→ `garten_data_vocab_<uid>`). The Library's Discover rows use their own namespace entirely — `garten_discover_<uid>:<seedKey>` with a **24h** TTL (`src/lib/discoverCache.js`, deliberately separate from `cache.js`, whose 30s TTL is wrong for quota-guarded recommendation queries). Discover seed keys embed their inputs, so invalidation is structural (a new finished book → new key) and `pruneDiscoverRows` clears keys the current lineup no longer produces.

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
  - Title + tagline on the left; on the right a single **account menu** — a bloom-avatar button (see "Profiles & avatars") that opens a dropdown of My profile / Manage languages / Sign out. These controls used to sit loose in the header; folding them into one menu keeps the card focused on identity → motivation → action. Pending friend requests surface as a small dot on the Friends nav button instead of a notifications bell.
  - Status line: streak pill (orange, flame icon + "day streak") + today-minutes text ("Nm tended today"). The whole row hides when there's neither a streak nor minutes today (the next-action line below carries the prompt instead).
  - **Today's seed** — one gentle next-best-action line (`computeNextAction` in `src/lib/nextAction.js`, styled by `tone` via `NEXT_ACTION_TONES` in App.vue). A first-match priority ladder over data already in memory: brand-new → streak-at-risk (live run through yesterday, unwatered today) → within reach of the weekly goal → nothing-logged-today → a lagging activity goal → 3+ Word Garden reviews due (`vocab-due`, leaf icon; threshold 3 so a single stray word never nags) → a language un-watered ≥7 days → a calm "thriving" affirmation. Always returns exactly one suggestion (never null), sitting directly above the LogForm so motivation precedes action. Pure/tested; no new reads.
  - Weekly goal progress bar (color-coded by language, segmented). Each segment carries a `title`/`aria-label`, and when more than one language contributes a small text legend (dot + name) sits below the bar so the split isn't conveyed by color alone.
  - LogForm CTA below the status line (full-width button on all breakpoints)
  - This grouping follows the Gestalt proximity principle — title, motivation, and action are visually connected.
  - **Milestone moments**: logging a session is the one place stats feed back. App.vue's `addEntry` takes a `milestoneSnapshot()` before and after the add and runs `detectMilestone` (`src/lib/milestones.js`) — a pure diff that surfaces the single most meaningful crossing (CEFR level-up > streak rung 7/14/30/100/180/365 > per-language logged-hours rung 25/50/100/250/500/1000 > weekly-goal completion) as one quiet `'celebrate'` toast (garden-green, swaying sprout icon; added to `Toast.vue`). Hours rungs use **logged** hours (prior-hours credit excluded so a starting credit can't instant-cross); the level uses prior+logged. Detection runs only on the add path, so a page reload never re-fires. The Library's "log as reading session" writes through its own `useStorage` instance and does **not** trigger these (reading milestones already surface via the `reading_milestone` feed event).

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

- **Recent sessions**: Below everything, inside its own card. A **day-grouped story** (pure helpers in `src/lib/recentActivity.js`, assembled into `recentStory` in App.vue), not just a log of study entries:
  - **Merged timeline**: study-session entries (`sessionRows`) and reading-progress rows (`readingRows`, joined against `useBooks`' bulk-loaded `readingProgress` + `savedBooks` — see "Reading Library" below) are combined by `mergeTimelineRows` (newest-first, same date+createdAt tiebreak as before) then paginated by `recentLimit` ("Show more"), *then* grouped by day (`groupRowsByDay`). Each session row carries an activity-type icon (`ACTIVITY_ICONS` in App.vue: reading→BookOpen, grammar→Layers, vocabulary→BookMarked, listening→Headphones, speaking→MessageCircle, writing→PenLine, pronunciation→Volume2). Reading rows render as "Read N pages · Title" with the book's own language-colour accent bar (via `codeForName` against the user's tracked languages), no edit/delete (that lives in the Library).
  - **Day headers** (`relativeDayLabel`: Today / Yesterday / weekday within 7 days / "Mon, Jun 15" older) keep their total-time readout, plus a **per-day language-mix bar** (`dayLanguageMix`, study entries only — pages aren't time) rendered only when a day mixes 2+ languages, in the same visual grammar as the weekly-goal segmented bar.
  - **Week digests**: a one-line divider ("Week of Jun 22 · 4h 10m · 5 days · mostly Spanish") precedes the first day-group of every represented week (`weekStartFor` groups by Monday; `weekSummary`, both in `recentActivity.js`). Computed from the **full** `data.entries` for that week — not the paginated slice — so the digest stays accurate regardless of how much of that week is currently visible.
  - **Edit/delete safety**: rows rendered in the timeline are display copies (tagged with `kind`, sometimes a reading row with no backing `entries` row at all). `openEdit`/`confirmDeleteEntry` in App.vue re-resolve the real entry by id from `data.value.entries` before acting, so a stray `kind` field never round-trips into storage and a reading row safely no-ops if clicked (it has none of these controls in the UI anyway).
  - **New read**: enriching this section needed all of a user's `reading_progress` rows at once, which nothing previously loaded in bulk (only per-book, on demand, inside `LogPagesModal`). `useBooks.js` gained `readingProgress` + `loadAllProgress()`, cached under its own `books_progress_<uid>` key (mirrors the `books_<uid>` pattern, never collides) and triggered by the same per-user `watch(userId, ...)` that loads `savedBooks`. App.vue now calls `useBooks()` once at the top level (the same shared singleton instance Library and `GardenerProfile` use) specifically to drive this — meaning book + reading-progress data now loads once per session for every user, not just Library visitors. It's a deliberate, cached, single-query trade for a materially richer timeline; a load failure degrades silently to sessions-only (no toast).

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

## Profiles & avatars

Every gardener — you and your friends — has a **bloom avatar** and a **gardener profile**.

- **Bloom avatars** (`src/components/BloomAvatar.vue`, pure params in `src/lib/avatar.js`): a small generative SVG plant that replaces letter avatars everywhere identity appears (header account menu, gardener profile, friends list, leaderboard, friend search, requests inbox). Bloom colour / petal count / tilt / leaf side are hashed deterministically from the gardener's user id (`avatarParams(seed)`), so the same person looks the same everywhere with no stored state. The **growth stage** (seedling → sprout → bloom → flourish, thresholds in `STAGE_HOURS` = 10/50/250) comes from **total logged hours only** (no prior-hours credit). Friends' hours aren't visible to the client (only safe aggregates), so `growthStage(null)` returns the fully-grown `bloom` face rather than guessing — friend and own-leaderboard-row avatars always render bloomed. Event-glyph circles in `CelebrationFeed`/`CommitmentCard` are deliberately **not** avatars (they encode event kind + language colour), so they were left alone. An optional `variant` prop overrides only the bloom colour (not shape) from a gardener's chosen `avatar_variant`.
- **Gardener profile** (`src/components/GardenerProfile.vue`): one modal shell serving both `mode="self"` and `mode="friend"`, replacing the old `social/FriendProfile.vue`.
  - *Self* — opened from the account menu ("My profile" in `App.vue`). A personal dashboard: bloom avatar (hours-driven stage + chosen colour), handle, editable bio, bloom-colour picker, stat tiles (total hours / streak / languages), weekly-goal bar, per-language proficiency mini-bars + CEFR badge (`languageHorizons`), currently-reading spotlight (`currentReadingBook`), and earned "recent milestones" (`selfMilestones`). All derived in `src/lib/profileStats.js` (pure, tested) from data App.vue already holds — **no new reads**. The modal calls `useBooks()` itself (a module singleton with its own cache) so books load lazily on first open and never on app boot. A gardener with no `profiles` row sees a gentle "set up your handle" nudge instead of the bio/bloom editors. `App.vue` calls the cheap `social.loadProfile()` (one row) on open so identity shows even if the Friends view was never visited.
  - *Friend* — opened from the leaderboard / friends list. Identity + stat tiles + their active languages + cross-pollinated blooms (from `feed`) + a compact "Recently" list of their celebrations. Bio + chosen bloom are fetched on demand via `social.fetchProfileExtras(id)` (one RLS-guarded row read, only on open); shared blooms and celebrations are read live from injected social state.
- **Personalization columns** (migration `20260703000000_profile_personalization.sql`): `profiles.bio` (≤160 chars) and `profiles.avatar_variant` (smallint 0–5, index into `BLOOMS`). Both nullable, opt-in, inherit `profiles`' existing RLS (self + accepted friends) and grants — no new policies. **The migration must be applied to the database** before bio/bloom writes succeed; until then `updateProfile`/`fetchProfileExtras` calls that touch these columns return 400 and the app degrades gracefully (self bloom/bio don't persist, friend bios don't show). Friends' chosen `avatar_variant` is only reflected in the friend profile modal for now — the friends-list/leaderboard avatars still use the hashed default because the social RPCs (`friends_overview`, `circle_leaderboard`) don't carry the column yet (a later slice can thread it through).

## Garden Circle (social)

The Friends tab is an opt-in social layer for users who create a `profiles` row. It is owned by `useSocial.js` and rendered by `src/components/social/SocialView.vue`.

**2026-07 simplification (soft removal)**: focus sessions, grow-buddy pacts, nudges/cheers, waters, circle reports, friend books (`circle_books`), event comments, the reaction palette, and the notifications panel were removed from the UI and composable. Their Supabase tables, RPCs, and migrations are **intentionally untouched** — do not re-wire the client to them, and do not drop them without explicit approval. What remains client-side: friendships/requests, weekly commitments, the leaderboard, and a like-only celebration feed.

Social tables the client still reads/writes (scoped to self + accepted friends via RLS or SECURITY DEFINER functions):
- `profiles`, `friendships` — handle and friend relationships.
- `circle_commitments` — one weekly public commitment per language per user; progress via `circle_commitments_with_progress()`.
- `activity_events` — celebration feed. The client filters kinds to `milestone`, `bloom`, `commitment_progress`, `new_language`, `reading_milestone` (both in `loadFeed`'s `.in()` and the realtime handler — keep them in sync). Legacy `circle_report` rows still exist in the DB and are simply filtered out.
- `event_reactions` — likes. The UI offers a single like (`ReactionBar`), written as kind `'bloom'`; the displayed total counts every historical kind, and unliking deletes *all* of the user's reactions on that event.

Realtime channels — exactly three: `garden-dispatches` (activity_events INSERT), `garden-reactions` (INSERT/DELETE), `garden-commitments` (any change → reload). Each has a subscribe/unsubscribe pair, and the `watch(userId)` reset in `useSocial` must tear all of them down.

UI layout on the Friends page — one stacked column, no tabs: hero ("Friends" title + a presence line "You and N friends are growing Spanish & French." built from friends' `active_languages`, plus "Xh tended together this week" from `circleWeekMinutes`, a week snapshot that stays stable when the leaderboard window is toggled) → `RequestsInbox` (renders nothing when empty) → `FriendsList` → `CircleLeaderboard` → `WeeklyGoalsPanel` (solo commitments only) → `CelebrationFeed` → `FriendSearch`. With **no friends yet**, the sections are replaced by a single "Plant your circle" invite card (embedded `FriendSearch`). Pending friend requests show as a small dot on the Friends nav button in App.vue (`incomingRequests`; populated after the Friends view first loads social state).

**Leaderboard texture** (`CircleLeaderboard.vue`, migration `20260622000000`) — beyond the total-hours ranking, each row carries a thin colour-only **language-mix ribbon** (texture as colour, no numbers — who's all-in on one language vs spread across many) and **taps to expand** into that gardener's per-language minutes + a full-word activity legend ("Reading 1h · Listening 40m · Speaking 25m"). Fed by `circle_breakdown(p_window)` (SECURITY DEFINER, self + friends), pivoted in `useSocial` into `circleBreakdown` (`user_id` → `{ languages[], activities[], total }`); it rides the same window as the leaderboard (`loadCircleBreakdown` is chained inside `loadLeaderboard`). Ranks are deliberately calm: every rank chip is neutral stone (collaborative, not competitive) and only your own row carries a subtle garden ring.

**Celebrations (`CelebrationFeed.vue`)** is framed as "moments worth witnessing", not a self-stat log. Cards are not clickable (there is no detail modal); the like button is the whole interaction. Two reinforcing pieces beyond the raw feed:
- **Reactions land back** — on your *own* celebrations, a garden-green line names who reacted ("Maria & Sam celebrated this"), resolved from `reactionsByEvent` + the `friends` list. The witnessing is the reward, not the stat.
- **Freshness decay** — celebrations within 7 days (by `occurred_on`) read bright; older ones fade under a quiet "Earlier" divider (`firstStaleId` / `isStale`), so the feed never becomes an undifferentiated wall.

## Reading Library

The Library tab is the third top-level view (alongside My Garden and Friends) for finding books in a target language via an external API and tracking reading them. It is **self-contained** — reading is tracked by status/difficulty/notes/dates, not study minutes, so finishing a book does NOT create a Garten `entries` session. Owned by `useBooks.js` + `useBookSearch.js` and rendered by `src/components/library/LibraryView.vue`.

**Top-level navigation** (`App.vue`): the former `socialMode` boolean became a `navView` string (`'garden' | 'library' | 'words' | 'friends'`), persisted under `garten:viewMode` (migrates the old `garten:socialMode` boolean on first load; unknown stored values fall back to `'garden'` via the `NAV_VIEWS` whitelist, so a stale/renamed value never lands on the bare `v-else` view). It is named `navView` specifically to avoid colliding with `useTimeframe`'s heatmap `viewMode`. The header segmented control has four buttons (Sprout / BookOpen / Leaf / Users); the Words button carries a small dot when vocab reviews are due, mirroring the Friends request dot.

**Tables** (migrations `20260624000000_reading_library.sql`, `20260624232905_add_book_rating.sql`, and `20260625000000_reading_progress.sql`), per-user with the same RLS shape as the rest of the app (`for all to authenticated using (auth.uid() = user_id)`):
- `books` — externally-sourced metadata snapshot of each saved book: PK `(user_id, id)`, plus `external_id`, `title`, `author`, `cover_url`, `description`, `language_code`. `UNIQUE (user_id, external_id)` enforces the no-duplicate-on-resave rule. `language_code` is constrained by a CHECK to the curated ISO 639-1 set — **keep that list in sync with `src/lib/bookLanguages.js`** (mirrors how `chk_entry_type` pairs with `types.js`).
- `reading_records` — the user's reading data, strictly 1:1 with a book: PK `(user_id, book_id)` (which alone enforces "one book → one reading record"), FK `(user_id, book_id) → books` `on delete cascade` (a reading record can't exist without a book; removing a book removes its record). `status` CHECK in `want_to_read | reading | read`; `rating` (nullable) CHECK in 0–5 with 0.5 steps; `difficulty` (nullable) CHECK in `beginner | intermediate | advanced`; plus `target_language` (ISO 639-1), `notes`, `saved_at`/`started_at`/`finished_at`, `current_page`, `total_pages`.
- `reading_progress` — per-user history of page-logging sessions: PK `(user_id, id)`, FK `(user_id, book_id) → books` on delete cascade, `date`, `pages_read`, optional `from_page`/`to_page`, optional `minutes`, optional `notes`.

**Data flow** (`useBooks.js`) mirrors `useStorage.js`: per-user reads scoped by `user_id`, optimistic in-memory updates, `toast.error` on failure. It joins `books` + `reading_records` in memory into one `savedBooks` array where the reading fields live under each book's `.record`. Cache namespace gotcha: `cache.js` keys everything as `garten_data_<x>`, and `useStorage` owns `garten_data_<uid>`, so `useBooks` passes `books_<uid>` to land on `garten_data_books_<uid>` and avoid clobbering it. `saveBook` dedups like `addLanguage` — if the `externalId` is already saved it reuses the stable `id` so the `reading_records` PK updates rather than inserting a duplicate.

**Search — Google Books with Open Library fallback** (`src/lib/bookSearch.js` orchestrator):
- `searchGoogleBooks` (`googleBooks.js`) is primary — richest inline metadata, returns ISO 639-1 codes directly. Uses optional `VITE_GOOGLE_BOOKS_KEY` (keyless works but is heavily rate-limited → HTTP 429).
- On **any** Google request error the orchestrator falls back to `searchOpenLibrary` (`openLibrary.js`), which is keyless/quota-free but speaks ISO 639-2/B 3-letter codes — `openLibrary.js` maps 639-1 ↔ 639-2 in both directions (including the 639-2/T variants OL emits, e.g. `deu`→`de`). A successful-but-empty Google response does NOT fall back.
- `searchBooks` returns `{ books, source }`; `BookSearch.vue` shows a quiet "showing results from Open Library" note when `source === 'openlibrary'`.
- **FR3 strict language filter**: `langRestrict` (Google) and `language=` (OL) are biased, not strict, so `filterByLanguage` drops any result whose language ≠ the selected code client-side (a French search returns English editions otherwise — confirmed live).
- **ISBN quality gate** (`hasIsbn` in both `googleBooks.js` and `openLibrary.js`): both sources pad results with scanned periodicals and public-domain documents (old Reichstag reports, journals, encyclopedias) whose only identifier is Google's internal `OTHER` id / no OL `isbn` — these are the obscure, often mojibake-laden entries. The search requests `industryIdentifiers` (Google) / `isbn` (OL) and keeps only volumes carrying an ISBN-10/13, so only cataloged published editions survive. Applied to raw results before normalisation, ahead of the language filter. Deliberately **not** a numeric-title filter (that would drop real books like *1984* / *2666*). Trade-off: very sparse partial queries can surface a few ISBN-bearing but oddly-titled editions; normal title/author queries are clean.
- `useBookSearch.js` holds debounced (350 ms), request-token-guarded search state (so a slow earlier search can't overwrite a newer one).
- **Page-count auto-detect** (`detectPageCount` + pure `pickPageCount` in `bookSearch.js`): saved `books` rows store no page count (it only rides along on live search results), so for a book missing `total_pages` the LogPagesModal can re-query by title (+ author) and match the count back to the saved edition — preferring same `external_id`, then exact case-insensitive title, then the first ISBN-gated result that carries a count. Returns `null` (manual entry) on no match / empty title / search failure.

**Components** (`src/components/library/`, all in the Garden Journal design system — `gp-*` classes, Teleport modals, `ConfirmDialog`, `useToast`, no emojis in data displays):
- `LibraryView` — root; owns the composables and the Save/Edit/Remove/Log-pages modal state. **One continuous surface, no sub-tabs**: the search bar sits on top; while a query is active `BookSearch` shows results (it emits `active` as the query becomes non-empty/empty), otherwise the reading summary + saved books render beneath.
- `BookSearch` + `BookResultCard` — language `<select>` scoped to the user's tracked Garten languages (defaults to one via `codeForName`) + title/author box + results grid. Save is disabled with an "Unsupported language" note when a result's language is outside the curated set (OL "All languages" can return those; the DB CHECK would reject them).
- `SaveBookModal` / `EditBookModal` — status + rating (`StarRating`, 0.5-step 5 stars) + difficulty pills, notes, started/finished dates, total pages (page count is auto-detected from Google/Open Library metadata when available). Rating/difficulty/notes live only here — the saved-book card no longer shows them.
- `SavedBooksList` — **three status shelves** (`useShelves.js` computeds over `savedBooks`; pure sort math in `src/lib/shelfSort.js`): "Reading" (`ReadingSpotlightCard` — bookmark-ribbon progress, pace stats from `readingProgress.js`, inline quick-log chips, an "Add a word" capture affordance; soft cap `ACTIVE_CAP = 3` with a ConfirmDialog bypass), "Up next" (`QueueCard` grid, manual ▲/▼ reorder via sparse `sortIndex`), and "Finished" (`FinishedShelf`, collapsible). Language + status filter chips sit behind a Filter disclosure.
- **"Your next read" pick** (`NextPickCard` + pure `src/lib/nextPick.js`, tested): one spotlighted queue book at the top of the Up-next shelf, chosen by a first-match ladder modeled on `nextAction.js` — `neglected` (a tracked language un-watered ≥ `NEGLECT_DAYS` 7 with a queued book and no active Reading book covering it; prefers a ≤ `SHORT_PAGE_LIMIT` 220pp "short win" within it) → `short` (shortest known ≤ 220pp; missing `totalPages` never qualifies) → `difficulty` (matches the modal difficulty of ≥2 finished books in that language) → `queue-top` (always matches). Derived from the **filtered** queue so filters keep working; the grid below excludes the pick and passes its own ids as `visibleIds`, so reorder treats the pick exactly like a filter-hidden row (`runReorder` leapfrog — covered in `useShelves.reorder.test.js`). Study `entries`/`studyLanguages` are threaded down from LibraryView's existing `useStorage` instance — no new reads.
- **Discover rows** (`DiscoverSection` + `useDiscover.js` + pure `src/lib/discover.js`, tested): replaces the old single "More by <last finished author>" strip. Up to `MAX_ROWS` 3 rows, each a seed with a stated reason: "More by {author}" (finished books **rated ≥ `RATING_FLOOR` 4**, rotating daily across loved authors), "Because you finished {title}" (most recent finish, different author than row 1), "Short reads in {language}" (`laggingLanguage` — least study minutes in 28 days among ≥2 codable tracked languages; `postFilter` caps at `SHORT_READ_MAX_PAGES` 250pp, sorted shortest). Fetches ride `searchBooksMerged`, sequential with a 500ms stagger, cached 24h per seed (`discoverCache.js`); the section is gated on `!searchActive` **and** a `ready` prop (books + storage loaded) — loading with an empty library would prune every cached row and refetch on each reload. Saved/cross-row dedupe happens at render time via `filterRowBooks`, so saving a book hides it everywhere instantly. Empty/errored rows collapse silently.
- `LogPagesModal` + `ProgressRing` — page-logging flow. All derived UI (ring, "pages left", quick chips, finish preview) keys off `effectiveTotal` = the saved `total_pages` **or** what's currently typed into the gateway field, so setting the count makes the form react immediately (without this it stayed frozen at `0/?` until the modal was reopened). When the count is unknown the modal shows a single focused "How many pages?" gateway with an **Auto-detect** button (calls `detectPageCount` and fills it); once known it reveals one "Pages read today" input (stepper + quick-add chips + Finish). From/to page and the landing page are **derived** from pages-read — not separate inputs — and still written to `reading_progress`. Plus optional minutes, optional notes, pace + finish prediction, and an optional "log as reading session" toggle that writes a Garten `entries` row.
- `ReadingSummary` — FR12 per-language status counts (`summaryByLanguage` in `src/lib/readingStats.js`), one thin read/reading/want bar per language.

**Page tracking flow**: `useBooks.logProgress(bookId, { pagesRead, fromPage, toPage, minutes, notes, languageColor })` inserts a `reading_progress` row, updates `reading_records.current_page`, auto-advances `status` from `want_to_read` → `reading` and to `read` when the last page is reached, and calls the SECURITY DEFINER RPC `check_reading_milestone(...)` so 25/50/75/100% book milestones appear as `reading_milestone` celebrations in the Garden Circle feed. `src/lib/readingProgress.js` holds the pure analytics (weighted pace, streak, predicted finish).

**Reference data**: `src/lib/bookLanguages.js` is the single source of truth for the curated ISO 639-1 reading languages (`BOOK_LANGUAGES`, `nameForCode`, `codeForName`, `isValidCode`, `CODE_SET`) — the existing `languages.js` is names-only. The migration's `language_code` / `target_language` CHECK lists must stay in sync with it.

## Word Garden (SRS vocabulary)

The Words tab is the fourth top-level view: capture words/phrases, then review them with spaced repetition. Words are seeds that grow through review — the active-recall loop (see term → recall → reveal → grade) is the learning feature, not a stat display. Owned by `useVocab.js`, rendered by `src/components/wordgarden/WordGardenView.vue`.

**Table** (migration `20260707000000_word_garden.sql`, same RLS shape as the rest): `vocab_words` — PK `(user_id, id)` (client `crypto.randomUUID()`), `language_id` (text slug, composite FK → `languages(user_id, id)` on delete cascade, mirroring `entries_language_fk` — deleting a language deletes its words), `term`/`meaning` (CHECK 1–200 / 1–500 chars — `meaning` was later relaxed to nullable by `20260708000001_vocab_meaning_nullable.sql`; see below), optional `note`, `gender` (nullable, migration `20260709000000_vocab_gender.sql`; see below), `source_book_id` (**soft** reference to `books.id`, deliberately no FK — cascade would wrongly delete vocabulary with the book; the client resolves it in memory and shows nothing when the book is gone), plus SRS state: `stage` (CHECK 0–6), `due_date`, `lapses`, `review_count`, `last_reviewed_at`. **The migration must be applied** before vocab writes succeed; until then the tab shows the standard load-error retry card and nothing else is affected. `meaning` can be null at the data layer (`chk_vocab_meaning_optional` only validates length when a meaning is present) — a holdover from the now-removed passage-mining feature; the current UI always collects a meaning up front via `WordCaptureForm`.

**SRS** (`src/lib/srs.js`, pure/tested): a fixed-interval Leitner ladder, `SRS_INTERVALS = [0, 1, 3, 7, 14, 30, 90]` days indexed by stage — no SM-2 ease floats. `good` +1 stage, `easy` +2 (capped), `again` −2 (floor 0), counts a lapse, and stays due today so the session recycles it. All date math uses `localDateStr` (local TZ — never `toISOString().slice(0,10)`, which is UTC). `vocabGrowthStage` maps stage → seed (0–1) / sprout (2–3) / bloom (4–5) / flourish (6), echoing the avatar arc but from reviews, not hours. Keep `chk_vocab_stage` (0–6) in sync with `SRS_INTERVALS.length - 1`.

**Data flow** (`useVocab.js`): module singleton mirroring `useBooks` — per-user load on the `userId` watch, optimistic mutations with rollback + `toast.error`, cache key `vocab_<uid>`. `addWord` does a case-insensitive per-language duplicate check and returns `{ duplicate, existing }` so the form shows a gentle note instead of inserting. `dueCount` is a module-level computed (known limit: a tab open across midnight won't bump it until the next mutation). App.vue calls `useVocab()` once at top level to drive the nav dot and the `vocab-due` next-action rung — same one-cached-read-per-session trade as `useBooks`.

**Components** (`src/components/wordgarden/`): `WordGardenView` (header card with "Review · N due" CTA or a calm all-watered line; owns the review modal + remove ConfirmDialog), `WordCaptureForm` (term/meaning/language + note behind "+ add context"; language defaults to preset → single tracked → most recently studied; reused by the Library's capture-from-reading modal via `presetLanguageId`/`sourceBookId` props), `ReviewSession` (Teleport modal: recall-first reveal, Again/Good/Easy with "in Nd" interval labels so the buttons teach the schedule, Again re-enqueues at the back, quiet end-of-session summary via `sessionSummary`), `WordList`/`WordCard` (due-first ordering, per-language chips, inline edit, "from {title}" source caption), `VocabStageGlyph` (16px inline SVG, four growth states, bloom stroked in the language colour — chip-scale whimsy, not a scene).

**Capture-from-reading**: "Add a word" on a Reading spotlight card opens a slim Teleport shell around `WordCaptureForm` in LibraryView, prefilling the book's language (via `codeForName` match) and carrying `source_book_id`.

**Grammatical gender** (`src/lib/grammaticalGender.js`, migration `20260709000000_vocab_gender.sql`): an optional one-tap gender toggle shown while entering/editing a word's meaning (`WordCaptureForm`, `WordCard`'s inline edit) — but **only** for languages that actually have grammatical gender, and only with the genders that language has. `gendersForLanguage(name)` is a best-effort linguistic mapping (same spirit as the FSI categories in `proficiency.js`) across every name in `languages.js`, returning one of four shapes: `[]` (no gender — English, Chinese, Turkish...), `['masculine', 'feminine']` (French, Spanish, Arabic, Hindi, Urdu...), `['masculine', 'feminine', 'neuter']` (German, Russian, Greek, Gujarati...), or `['common', 'neuter']` for Scandinavian/Dutch/Frisian-style languages where the old masculine/feminine distinction merged into one "common" gender opposite neuter (Danish, Dutch, Frisian, Norwegian, Swedish) — forcing these into a masculine/feminine pill would be linguistically wrong, not just imprecise. Selecting a gender clears whenever the language changes (a stale pill from a different language's gender set is worse than no pill). `vocab_words.gender` is nullable (most words are ungendered — verbs/adjectives, or the gardener hasn't filled it in) and CHECK-bounded to the four gender keys; the mapping, not the DB, decides which subset applies to a given language. Shown as a small badge next to the term in `WordCard`'s display state and — the highest-value spot, since recalling the gender is half of knowing the noun — next to the meaning once revealed in the `ReviewSession` watering round.

**Part of speech** (`src/lib/wordType.js`, migration `20260710000000_vocab_word_type.sql`): a second pill row, same register as gender, in `WordCaptureForm` and `WordCard`'s edit mode — `noun | verb | adjective | adverb | phrase | other`, nullable `vocab_words.word_type`. Unlike gender this needs no per-language mapping (every language has these categories), so the pills always show. Its one behavioral effect: `isNounlike(wordType)` (true for `'noun'` and for unset/null) gates the gender row — retagging a word as a verb hides the gender pills and clears any gender already picked, since "gender" here means the noun's own article/class, not something a verb has. Shown as a badge next to the gender badge in `WordCard`'s display state.

**Tags / themed collections** (`vocab_words.tags text[]`, migration `20260710000001_vocab_tags.sql`, mirrors the `languages.types` array column rather than a join table): freeform per-word labels ("kitchen", "trip to Berlin") entered via `TagInput.vue` (chip input, commits on Enter/comma/blur, case-insensitive dedup, capped at 8 by `chk_vocab_tags_count`) inside `WordCaptureForm`/`WordCard`'s "+ add context & tags" disclosure. `WordList` gets a second, independent filter chip bar (tag chips computed from the *language-scoped* word list, so switching language doesn't leave a stale tag chip visible) that combines with the language filter via AND; clicking a tag chip on a `WordCard` (`@filter-tag`, relayed through `WordRow`) jumps straight to that filter. When a tag filter is active and has due words, a "Review N in '{tag}'" button appears and opens `ReviewSession` scoped via the existing `forceIds` mechanism (`WordGardenView.startScopedReview`, the same plumbing `onReviewWeak` already used for "review the ones you got wrong" — a themed round is just another id list).

**Removed**: the "mine words from a passage" feature (`MineWordsModal`, `BookPickerModal`, `vocabMining.js`, the "Mine from book"/"Mine words" buttons, and the `vocab_mined` activity-feed event) was pulled entirely — passage tokenization added surface area the single-word capture flow didn't need. `20260714000000_drop_vocab_mined_event.sql` reverts the DB side; `source_book_id` and nullable `meaning` stay (both are shared with capture-from-reading).

**Deferred (do not build without asking)**: a `vocab_reviews` history table (per-word state covers all current surfaces), vocab milestones in `milestones.js`, and a GardenScene-style vocab plot.

## Activity Types

Fixed set defined in `src/lib/types.js`: reading, grammar, vocabulary, listening, speaking, writing, pronunciation. Displayed as toggleable pills in both the LogForm and LanguageManager.

## Activity Goals

A per-activity-type weekly goal (`src/components/ActivityGoals.vue`, `src/composables/useActivityGoals.js`), mirroring the overall `useWeeklyGoal` but scoped to one activity type across all languages instead of one grand total — e.g. "Reading: 1h40m / 3h this week", "Writing: no goal set". Lives in its own "Goals" tab alongside Insights / Activity / Horizon in App.vue's analytics tab group (uses unfiltered `data.entries`/`data.languages`, not the FilterBar-scoped `filteredEntries`, matching the top-of-page weekly goal's scope).

- **Which types are offered**: the union of `types` across the user's languages (`trackedTypes` in `useActivityGoals`) — not the full global `ACTIVITY_TYPES` list, so a type never added to any language never shows a goal row.
- **Storage**: `user_settings.activity_goals` (see Data Model above). `useActivityGoals.setGoal(type, hours)` reads the current map, adds/removes the one key, and calls `useStorage.saveActivityGoals(nextMap)` which upserts the *whole* map in one write (no partial jsonb update) — same shape as `saveGoal` for the overall target.
- **Interaction**: inline edit only, no modal — click "+ Set goal" (or the pencil once a goal exists) to reveal a number input + Save/Cancel/Remove, exactly the affordance the overall weekly goal already uses in the status card.
- **Bar color**: a single garden-green hue at stepped opacity per row (`BAR_OPACITIES` in `ActivityGoals.vue`), not a distinct color per type — avoids inventing a second color-coding scheme that would compete with the language colors used everywhere else.
- **Row order**: rows with a goal set sort first (least-progressed first, so what needs attention leads), then goal-less rows sorted by recent usage.

## "Your Garden" hero (scene model + portrait)

A full-width generative SVG scene at the top of the My Garden view. Every visual element grows from data already in memory — deterministic, no new Supabase reads, no `Math.random`. Collapsible.

**Files**:
- `src/lib/gardenScene.js` — `buildGardenScene(input)` returns a fully declarative layout (numbers in viewBox units). Pure: `now` is injected so tests can pin any time/season. Also exports `loggedHoursByLanguage`, `skyBand`, `seasonFor`, `plantPositions`, `GARDEN_VIEW`, `STAGE_GEOM`.
- `src/lib/portrait.js` — `svgToPngBlob(svgEl)` + `downloadGardenPortrait(svgEl)` + pure `portraitFilename(now)`. Reuses `downloadFile` from `export.js`.
- `src/components/GardenScene.vue` — dumb renderer; owns the 10-min clock tick (`setInterval` set up in `onMounted`, cleared in `onBeforeUnmount`) and the download/collapse buttons. View-agnostic — takes plain data props, no injected composables — so it can be promoted to a fourth top-level tab later by cut-paste.
- `src/components/GardenPlant.vue` — one plant's SVG subtree from a precomputed `plant` object (4 species × 4 stages).

**Scene model shape** (viewBox `0 0 1200 320`, groundY 264):
- `sky: { band, stops[3], glow }` — `band` is `dawn|day|dusk|night` from `skyBand(hour)`. `glow` is true on streak ≥ 3 outside night.
- `season: { name, leafTint, grassTint, frost, particles }` — `seasonFor(month)` (meteorological, NH). Spring/autumn emit ≤ 8 drift particles; summer/winter emit none; winter sets `frost: true`.
- `plants[]` — `{ id, name, color, x, species, stage, hours, scale, droop, droopTransform, tilt, jitter, bloomColor, swayDelay, colors }`. Per-plant determinism from `hashSeed(languageId)`. `scale` is the within-stage size lerp (clamped 0.85–1.15, ×0.9 when ≥ 7 languages).
- `beds[]` — pressed blooms as ground clusters at the plant's feet (recipe mirrors `PressedFlower.vue`'s 5/6-petal fan).
- `sign: { show, text, x } | null` — `gardenName` clamped to 18 chars + `…`; null when no name.
- `companion: { kind, pathKind: 'air'|'ground' } | null` — from the chosen `avatar_companion` index; null when none or out of range.
- `fireflies[]` — exactly 7 (night + streak ≥ 3 only), at hashed air positions, with a per-firefly delay.

**Layout**: `plantPositions(count)` returns even slots across `[140, 1060]`. A single plant gets center-stage at `x = 600`. Per-plant hashed x-jitter is ±12% of slot width; 0-hour languages render as a seedling mound; droop fires at 7+ days of staleness (never-watered → no droop, just a mound).

**Hours vs prior-hours**: `loggedHoursByLanguage` sums `hours + minutes/60` per language. `languageHorizons` is **not** reusable here — it filters 0-hour languages and adds `prior_hours`, but the scene needs both 0-hour languages (as seed mounds) and logged hours only (matching avatar/pressed-flower semantics).

**The one hard invariant — attribute-only styling for rasterization**:
An SVG loaded into an `<img>` has no access to external stylesheets. In `GardenScene.vue`, every visual property (fill, opacity, base transform) must be an SVG attribute or inline style; classes may carry only animation. The scene's animation classes (`.gs-sway`, `.gs-firefly`, `.gs-drift`, `.gs-wander-*`) are scoped behind the root `.gs-live` class, and the portrait clone drops `.gs-live` (belt-and-braces — the styles wouldn't apply anyway). The portal scene only embeds pure shapes, so the canvas can't taint.

**SMIL prohibition**: no `animateMotion` etc. The reduced-motion guard at the top of `garden.css` neutralizes CSS animations but cannot reach SMIL — a SMIL animation would keep moving for users who asked for stillness. The CSS keyframes for sway, fireflies, drift, ground/air wander, and streak glow all live in `garden.css` under a `/* Garden scene */` section beside the guard.

**Collapse persistence**: key `garten:gardenSceneOpen`, values `'true'|'false'`, default open. The collapsed state is a quiet "Show your garden" strip (`<Sprout>` icon + label) that costs ~40px — discoverable, no auto-collapse on mobile.

**Portrait PNG** (`src/lib/portrait.js`): `cloneNode(true)`, strip `.gs-live` + any `gs-*` animation classes, ensure `xmlns` + explicit `width="1200" height="320"`, serialize via `XMLSerializer`, load as a `data:image/svg+xml;charset=utf-8,…` URI (`encodeURIComponent`, not `btoa` — non-Latin-1 garden names), draw onto a 2× canvas filled with the paper tone `#f6f7f2`, then `toBlob('image/png')` and `downloadFile`. Filename is `garten-garden-YYYY-MM-DD.png`. Failure surfaces as `toast.error('Portrait failed to grow — try again.')`.

**Mobile lightness**: `max-h-56 sm:max-h-72` on the SVG; `preserveAspectRatio="xMidYMax meet"` so it scales down cleanly. The 10-min `setInterval` is the only per-frame cost; the panel renders only when `navView === 'garden'`, and `v-if` on collapse fully unmounts the scene and its interval.

## Deployment

- Build output goes to `dist/`
- GitHub Pages via Actions workflow (`.github/workflows/deploy.yml`)
- `base: './'` in vite.config.js for relative paths
- Never commit `dist/` to git (add to .gitignore)
