-- Garden Circle: surface friend reading activity.
--
-- Two changes:
--   1. Allow a new `reading` kind in activity_events — emitted every time a
--      gardener logs pages, so friends see "X is on page N of Title today"
--      in the feed. The existing `reading_milestone` kind (25/50/75/100%) is
--      too sparse for a feed that should breathe with shared activity.
--   2. Add a SECURITY DEFINER `emit_reading_progress` RPC the client calls
--      after a successful logProgress. RLS has no INSERT policy on
--      activity_events, so the app has to go through a function — same shape
--      as check_reading_milestone.

-- 1. Allow the new kind --------------------------------------------------------

alter table public.activity_events
  drop constraint if exists activity_events_kind_check;

alter table public.activity_events
  add constraint activity_events_kind_check
    check (kind in (
      'session', 'milestone', 'summary', 'bloom',
      'commitment_progress', 'circle_report', 'new_language',
      'reading_milestone', 'reading'
    ));

-- 2. SECURITY DEFINER helper: emit a reading event ----------------------------

create or replace function public.emit_reading_progress(
  p_book_id        text,
  p_book_title     text,
  p_language_name  text,
  p_language_color text,
  p_current_page   int,
  p_total_pages    int,
  p_pages_read     int
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_pages_read <= 0 or p_total_pages is null or p_total_pages <= 0 then
    return;
  end if;

  insert into public.activity_events
    (actor_id, kind, language_name, language_color, occurred_on, details)
  values
    (
      auth.uid(),
      'reading',
      p_language_name,
      p_language_color,
      current_date,
      jsonb_build_object(
        'book_id', p_book_id,
        'book_title', p_book_title,
        'current_page', p_current_page,
        'total_pages', p_total_pages,
        'pages_read', p_pages_read
      )
    );
end;
$$;

grant execute on function public.emit_reading_progress(
  text, text, text, text, int, int, int
) to authenticated;
