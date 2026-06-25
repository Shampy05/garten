-- Garden Circle: share what friends are reading.
--
-- Adds a SECURITY DEFINER RPC that returns the reading records of accepted
-- friends. Raw books/reading_records rows are still protected by RLS; this
-- function is the only doorway and returns only safe, shareable fields.

create or replace function public.circle_books()
returns table (
  friend_id      uuid,
  username       text,
  display_name   text,
  book_id        text,
  external_id    text,
  title          text,
  author         text,
  cover_url      text,
  language_code  text,
  status         text,
  current_page   int,
  total_pages    int,
  rating         numeric,
  difficulty     text,
  started_at     date,
  finished_at    date,
  updated_at     timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    fr.friend_id,
    pr.username,
    pr.display_name,
    b.id as book_id,
    b.external_id,
    b.title,
    b.author,
    b.cover_url,
    b.language_code,
    r.status,
    r.current_page,
    r.total_pages,
    r.rating,
    r.difficulty,
    r.started_at,
    r.finished_at,
    r.updated_at
  from (
    select
      case
        when f.requester_id = auth.uid() then f.addressee_id
        else f.requester_id
      end as friend_id
    from public.friendships f
    where f.status = 'accepted'
      and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
  ) fr
  join public.profiles pr on pr.id = fr.friend_id
  join public.books b on b.user_id = fr.friend_id
  join public.reading_records r
    on r.user_id = fr.friend_id
    and r.book_id = b.id
  where r.status in ('reading', 'read')
  order by
    case r.status when 'reading' then 0 else 1 end,
    r.updated_at desc;
$$;

grant execute on function public.circle_books() to authenticated;
