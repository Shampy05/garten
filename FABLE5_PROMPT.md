# Fable 5 Power Prompt: Garten Simplification & UI Revamp

> **Goal:** Use your first Fable 5 session strategically. Do NOT start writing code immediately. First audit, then propose, then implement in thin, reviewable slices.

---

## 1. Project Context

**Garten** is a personal language-learning tracker (Vue 3 + Vite + Tailwind + Supabase). It has three top-level views:

- **My Garden** — the core dashboard: log sessions, heatmap, analytics, fluency horizon, recent sessions.
- **Library** — search for books in target languages and track reading progress.
- **Friends** — a social layer with leaderboards, commitments, celebrations, focus sessions, buddy pacts, etc.

The app is deployed to GitHub Pages. Data lives in Supabase. State is cached in `localStorage` with a 30-second TTL.

### Tech stack (non-negotiable)

- Vue 3 Composition API, `<script setup>`
- Tailwind CSS v3
- No external charting libraries
- Supabase via `@supabase/supabase-js`
- Lucide icons only
- Components in `src/components/`, composables in `src/composables/`
- Design tokens and component classes in `src/styles/garden.css` and `tailwind.config.js`

---

## 2. The Problem Statement

The app has grown feature-heavy and visually noisy. The user finally has Fable 5 access and wants a clean, opinionated revamp focused on:

1. **Feature simplification** — remove low-usage social features that create maintenance and cognitive overhead.
2. **UI improvements across the entire app** — especially the messy Friends section and the overly-modal Library flow.
3. **Intuition** — every screen should be immediately understandable without reading tooltips or onboarding copy.

The user does **not** yet have a fixed visual target. They want you to propose a direction, grounded in the existing design system, and execute it in a way that doesn't break the core tracking flow.

---

## 3. Required First Step: Audit & Proposal

**Before touching code,** produce a concise written audit and proposal in the chat:

1. **Feature audit** — list the major features currently in each view (My Garden, Library, Friends).
2. **Simplification proposal** — for each feature, recommend: **Keep**, **Simplify**, or **Remove**. Justify each removal in one sentence.
3. **New information architecture** — sketch the new top-level structure (views, tabs, cards, primary actions per screen).
4. **Three biggest UI moves** — the highest-leverage visual/interaction changes you plan to make.
5. **Risk list** — what could break, what data migrations or Supabase changes might be needed, and what you'll do to avoid regressions.
6. **Implementation order** — a phased plan. Suggest starting with the highest-uncertainty area (likely Friends or Library) so feedback comes early.

Wait for user approval before writing code. This is the most important step.

---

## 4. Simplification Guidance

The user explicitly mentioned **focus groups / focus sessions** as an example of something unused. Treat the following as the starting point for your proposal, but justify each one:

### Strong candidates for removal

- **Focus sessions** (`focus_sessions`, `StartFocusSessionModal`, `FocusSessions.vue`, real-time timers, invites, auto-logged entries). The premise was real-time co-studying; it is underused and adds the most complexity (timers, expiry RPCs, invites, live presence).
- **Grow buddy pacts** (`buddy_pacts`, `BuddyPactCard`, `ProposeBuddyModal`, `BuddyInbox`). A second social-goal system alongside commitments. Consider collapsing into commitments or removing.
- **Nudges / cheers** (`nudges`, cheer/nudge buttons). Social pressure mechanics that are easy to remove and rarely used.
- **Waters** (`waters`, `WaterButton`). A daily "tap" mechanic that duplicates reactions without adding meaning.
- **Circle reports** (`circle_report` events, `generate_circle_report` RPC). Automated weekly summary noise in the feed.
- **Friend books** (`circle_books`, `CircleBooks.vue`, `friendBooks`). Cross-pollinating reading activity with social; nice but not core.

### Strong candidates for simplification

- **Celebrations feed** — keep, but strip it down. Remove reaction kinds beyond a simple "like" or keep only comments. Remove "Coming up" if it feels like extra noise. The feed should show meaningful moments (streak milestones, new language, commitment met, reading milestone), not automated reports.
- **Commitments** — keep as a lightweight public weekly goal per language. Remove streaks, cheers/nudges, and buddy pacts. One goal per language per week, visible to friends, progress bar, done.
- **Leaderboard** — keep, but make it calmer. The language-mix ribbon and expand detail are good; remove rank medal colors, rank badges, and anything that feels competitive rather than collaborative.
- **Notifications panel** — simplify. Remove waters, nudges, and invites. Keep friend requests and maybe comments on celebrations.

### Almost certainly keep

- Core logging, heatmap, analytics, fluency horizon, recent sessions.
- Languages, types, weekly goal, native language.
- Reading library (search, saved books, page progress, status/rating/difficulty).
- Profiles, friendships, friend search, requests.
- Basic leaderboard and celebrations feed.
- Data export.

### Principle for removal

If a feature has its own table, modal, real-time channel, and tooltip explanation, it's a prime removal candidate. The app should feel like one garden journal, not a social network with a timer attached.

---

## 5. UI/UX Direction

The user wants a cleaner, more intuitive app. Ground your proposal in these principles:

### 5.1 Information hierarchy

- **One primary action per card.** The Garden status card already does this well (Log a session). Apply the same discipline everywhere.
- **Group related elements.** Don't float disconnected buttons. Use cards and sections to create proximity.
- **Tabs are for switching context, not for hiding clutter.** If a tab would be empty or confusing, remove it or merge it.

### 5.2 Reduce visual noise

- Remove decorative emoji in buttons and data displays (the app already avoids medals/fire; extend this: no sprout emoji in CTAs, no seedling icon overload).
- Reduce the number of nested cards and hairline borders.
- Use whitespace and alignment more than borders to separate sections.
- Keep animations subtle and purposeful (the existing `fade-up`, `grow-in`, `sway`, `breathe` tokens are enough; don't add celebratory confetti).

### 5.3 Make actions obvious

- Buttons should say what they do. "Set commitment" is better than "Set goal" if the feature is called commitments; "Log pages" is better than an icon.
- Empty states should suggest the next action, not just describe emptiness.
- Avoid jargon. "Garden circle" can stay as a brand name, but use plain labels inside the UI: "Friends", "Weekly goals", "Activity", not "Bloom", "Waters", "Sprouting" unless the metaphor truly clarifies.

### 5.4 Mobile-first reconsideration

- Many cards currently stack okay but feel cramped on small screens.
- Review every card at `sm` and below. Consider collapsing secondary stats, moving inline-edit inputs into modals, and making CTA buttons full-width.

### 5.5 Friends section specifically

The Friends view is the messiest. Propose a structure like:

1. **Hero** — friendly presence summary: "You and N friends are growing [language(s)] this week."
2. **Requests / pending** — only if non-empty; otherwise hide.
3. **Friends list** — simple avatars, names, maybe current streak. Tappable to see a simple profile.
4. **Leaderboard** — clean ranking, language-mix ribbon, no medals.
5. **Weekly goals** — unified list of your own and friends' commitments. No buddy pacts, no cheers/nudges.
6. **Celebrations** — quiet feed of milestones, with like/comment only.

If the user has no friends, show one inviting card with `FriendSearch`, not a row of empty tabs.

### 5.6 Library section specifically

The Library works but is modal-heavy. Consider:

- Combining search and "My library" into a single, scannable view: a search bar at top, and saved books below.
- Making "Log pages" a quick inline action on the book card rather than a full modal, where possible.
- Reducing the number of status/difficulty/rating fields shown by default; show them on expand or edit.
- Keeping the auto-detect page count, but making it feel like a helper, not a second flow.
- The reading summary bars are good; keep them but make them calmer.

---

## 6. Implementation Constraints

### Code quality

- Keep the existing design system classes (`gp-card`, `gp-btn-primary`, `gp-btn-ghost`, `gp-input`, `gp-chip`, `gp-title`, `gp-pad`) unless you propose replacing them.
- Preserve warm stone grays and the garden green palette. No cool `gray-*` additions.
- Continue using `lucide-vue-next` icons only.
- Keep `<script setup>` and Composition API.
- Do not introduce new dependencies.

### Data & backend

- **Prefer soft removal first.** When removing a feature, start by hiding the UI and stopping the data fetches. Do not delete Supabase tables or migrations unless the user explicitly approves it.
- If a removed feature has realtime channels, unsubscribe and remove the channel setup.
- If a removed feature is referenced in `useSocial.js` or other composables, clean up the reactive state and methods, but keep the database tables intact during the first pass.
- For features you keep, ensure existing data continues to display correctly.

### Safety

- Run `npm run test` after each meaningful slice. Fix or update tests as needed.
- Run `npm run build` before declaring a slice done.
- Do not commit `dist/` or modify `.github/workflows/deploy.yml`.
- Preserve the existing caching behavior in `useStorage.js` and `useBooks.js`.

---

## 7. Suggested Implementation Order

Work in small, reviewable PRs or commits. Suggested order:

1. **Friends: remove focus sessions** — hide `FocusSessions.vue`, stop fetching, remove related modals/channels. This is the highest-complexity removal and gives immediate relief.
2. **Friends: simplify social mechanics** — remove nudges, cheers, waters, circle reports, buddy pacts. Keep commitments and leaderboard.
3. **Friends: redesign the view** — reorganize `SocialView.vue` and subcomponents into the proposed structure.
4. **Library: flatten search/library flow** — reduce modal usage, unify into one view.
5. **Garden dashboard polish** — simplify `LogForm`, analytics tabs, and recent sessions based on the same principles.
6. **Final pass** — remove dead code, unused imports, stale comments, and run full test + build.

Each slice should leave the app in a working, shippable state.

---

## 8. Success Criteria

When you're done, the app should feel like this:

- A new user can understand every screen in under 10 seconds.
- The Friends tab is calm and social without being a notification firehose.
- The Library lets you find a book, save it, and log progress in under 30 seconds.
- The Garden dashboard still rewards logging and shows progress clearly.
- `npm run test` and `npm run build` both pass.
- No new dependencies.
- No broken Supabase references for features that remain.

---

## 9. How to Communicate During the Session

- Be concise. The user wants strategic clarity, not long essays.
- When proposing a removal, say what you will remove from the UI and what you will leave in the database/composable for safety.
- When showing UI changes, describe the intended hierarchy before the styling details.
- If you need a decision, present 2–3 options with a recommendation.
- After each implemented slice, give a 2-line status update and point out anything that needs testing.

---

**Start by producing the audit and proposal described in Section 3. Do not write code until the user approves the plan.**
