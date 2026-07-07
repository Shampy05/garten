-- Word Garden: surface "vocab mined" celebrations in the Garden Circle feed.
--
-- Two changes, mirroring 20260705000002_reading_feed_events.sql:
--   1. Allow a new `vocab_mined` kind in activity_events — emitted once per
--      batch the gardener plants out of a finished book's passage. The
--      WordGarden's addWord inserts go directly into `vocab_words` (already
--      permitted by table RLS); this event is the *celebration* signal that
--      friends see, not the data write.
--   2. Add a SECURITY DEFINER `emit_vocab_mined` RPC the client calls after a
--      successful batch. RLS has no INSERT policy on activity_events, same as
--      reading milestone events.

-- 1. Allow the new kind --------------------------------------------------------

alter table public.activity_events
  drop constraint if exists activity_events_kind_check;

alter table public.activity_events
  add constraint activity_events_kind_check
    check (kind in (
      'session', 'milestone', 'summary', 'bloom',
      'commitment_progress', 'circle_report', 'new_language',
      'reading_milestone', 'reading', 'vocab_mined'
    ));

-- 2. SECURITY DEFINER helper: emit a vocab-mined event -------------------------

create or replace function public.emit_vocab_mined(
  p_book_id        text,
  p_book_title     text,
  p_language_name  text,
  p_language_color text,
  p_count          int
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- No-op if nothing was actually planted (defensive — caller should already
  -- have skipped, but never trust the wire).
  if p_count is null or p_count <= 0 then
    return;
  end if;

  insert into public.activity_events
    (actor_id, kind, language_name, language_color, occurred_on, details)
  values
    (
      auth.uid(),
      'vocab_mined',
      p_language_name,
      p_language_color,
      current_date,
      jsonb_build_object(
        'book_id', p_book_id,
        'book_title', p_book_title,
        'count', p_count
      )
    );
end;
$$;

grant execute on function public.emit_vocab_mined(
  text, text, text, text, int
) to authenticated;