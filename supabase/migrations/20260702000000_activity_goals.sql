-- Per-activity-type weekly goals (reading, writing, listening, ...), stored
-- alongside the existing overall weekly_goal_hours. Map of activity type ->
-- target hours/week, e.g. {"reading": 3, "writing": 1.5}. Missing key = no
-- goal set for that type.
alter table public.user_settings
  add column if not exists activity_goals jsonb not null default '{}'::jsonb;
