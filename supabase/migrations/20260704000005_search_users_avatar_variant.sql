-- Search + request bloom colour sync.
--
-- search_users (the "Find gardeners" search results) never returned
-- avatar_variant, so every search-result avatar fell back to the id hash.
-- Now that profiles.avatar_variant exists, expose it on the search RPC
-- so FriendSearch.vue can pass it through to BloomAvatar and a gardener's
-- bloom colour stays the same wherever you see them.
--
-- The pending-requests inbox reads the embedded requester/addressee
-- profile off the friendships row, so the JS-side select is updated
-- there too (no SQL change needed for that path).

drop function if exists public.search_users(text);

create function public.search_users(q text)
returns table (id uuid, username text, display_name text, avatar_variant smallint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.username, p.display_name, p.avatar_variant
  from public.profiles p
  where p.discoverable = true
    and (
      p.username ilike q || '%'
      or p.display_name ilike '%' || q || '%'
    )
  order by p.username
  limit 10;
$$;

grant execute on function public.search_users(text) to authenticated;
