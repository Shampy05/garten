import { ref, computed, watch } from 'vue'
import { supabase } from '../lib/supabase.js'
import { useToast } from './useToast.js'
import { useAuth } from './useAuth.js'

// Social data layer for the Garden Circle. Owns every Supabase call for the
// social features and exposes reactive state + actions. Created once in App.vue
// and shared with the social components via provide('social', ...).
//
// State lives in the composable (not the components), so it survives the
// SocialView being unmounted when you toggle back to your own garden.
export function useSocial() {
  const { userId } = useAuth()
  const toast = useToast()

  const profile = ref(null)
  const profileLoaded = ref(false)
  const friends = ref([])
  const incomingRequests = ref([])
  const outgoingRequests = ref([])
  const feed = ref([])
  const reactionsByEvent = ref({})

  // Garden Circle state
  const commitments = ref([])
  const leaderboard = ref([])
  const leaderboardWindow = ref('week')
  // Per-gardener language + activity texture for the leaderboard, keyed by
  // user_id, for the active leaderboard window. { languages[], activities[], total }.
  const circleBreakdown = ref({})
  const circleWeekMinutes = ref(0)

  let feedChannel = null
  let reactionsChannel = null
  let commitmentsChannel = null

  const hasProfile = computed(() => !!profile.value)

  async function loadProfile() {
    if (!userId.value) {
      profile.value = null
      profileLoaded.value = true
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId.value)
      .maybeSingle()
    // A missing table or network error degrades to "no profile yet" — the
    // user simply sees the opt-in gate rather than a broken screen.
    profile.value = error ? null : (data || null)
    profileLoaded.value = true
  }

  async function loadFriends() {
    if (!profile.value) return
    const { data, error } = await supabase.rpc('friends_overview')
    if (error) {
      toast.error('Could not load your garden circle.')
      return
    }
    friends.value = data || []
  }

  async function loadRequests() {
    if (!profile.value) return
    const { data, error } = await supabase
      .from('friendships')
      .select(
        'id, requester_id, addressee_id, status, created_at, ' +
        'requester:profiles!friendships_requester_id_fkey(id, username, display_name), ' +
        'addressee:profiles!friendships_addressee_id_fkey(id, username, display_name)'
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error) return
    const me = userId.value
    incomingRequests.value = (data || []).filter((r) => r.addressee_id === me)
    outgoingRequests.value = (data || []).filter((r) => r.requester_id === me)
  }

  // Resolve a dispatch's author to a name. DB rows carry an embedded profile;
  // realtime rows don't, so fall back to the loaded friends list / own profile.
  function actorLabel(actorId, embedded) {
    if (actorId === userId.value) {
      return { name: profile.value?.display_name || profile.value?.username || 'You', isSelf: true }
    }
    if (embedded) {
      return { name: embedded.display_name || embedded.username || 'A gardener', isSelf: false }
    }
    const f = friends.value.find((fr) => fr.friend_id === actorId)
    return { name: f ? f.display_name || f.username : 'A gardener', isSelf: false }
  }

  function normalizeEvent(row) {
    const actor = actorLabel(row.actor_id, row.actor)
    const coActor = row.co_actor_id ? actorLabel(row.co_actor_id, row.co_actor) : null
    return {
      ...row,
      actorName: actor.name,
      isSelf: actor.isSelf,
      coActorName: coActor?.name,
      coActorIsSelf: coActor?.isSelf
    }
  }

  async function loadFeed() {
    if (!profile.value) return
    const { data, error } = await supabase
      .from('activity_events')
      .select(
        'id, actor_id, co_actor_id, kind, language_name, language_color, activity_type, minutes, streak_days, session_count, occurred_on, created_at, details, ' +
        'actor:profiles!activity_events_actor_id_fkey(username, display_name), ' +
        'co_actor:profiles!activity_events_co_actor_id_fkey(username, display_name)'
      )
      .in('kind', ['milestone', 'bloom', 'commitment_progress', 'new_language'])
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) return
    feed.value = (data || []).map(normalizeEvent)
  }

  async function loadFeedReactions() {
    if (!profile.value || feed.value.length === 0) return
    const ids = feed.value.map((e) => e.id)
    const { data, error } = await supabase
      .from('event_reactions')
      .select('id, event_id, reactor_id, kind')
      .in('event_id', ids)
    if (error) {
      reactionsByEvent.value = {}
      return
    }
    const next = {}
    for (const r of data || []) {
      if (!next[r.event_id]) next[r.event_id] = []
      next[r.event_id].push(r)
    }
    reactionsByEvent.value = next
  }

  // ---------------------------------------------------------------------------
  // Circle commitments
  // ---------------------------------------------------------------------------

  function weekStartFor(date = new Date()) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d.toISOString().split('T')[0]
  }

  async function loadCommitments() {
    if (!profile.value) return
    const { data, error } = await supabase.rpc('circle_commitments_with_progress')
    if (error) {
      commitments.value = []
      return
    }
    commitments.value = (data || []).map((c) => ({
      ...c,
      isSelf: c.user_id === userId.value,
      ownerName: c.user_id === userId.value
        ? 'You'
        : actorLabel(c.user_id, null).name
    }))
  }

  async function setCommitment(language, targetMinutes) {
    if (!profile.value) return { error: 'No profile' }
    const weekStart = weekStartFor()
    const { data, error } = await supabase
      .from('circle_commitments')
      .upsert(
        {
          user_id: userId.value,
          week_start: weekStart,
          language_id: language.id,
          language_name: language.name,
          language_color: language.color,
          target_minutes: Math.max(1, Math.round(Number(targetMinutes) || 0))
        },
        { onConflict: 'user_id,week_start,language_id' }
      )
      .select()
      .single()
    if (error) {
      toast.error('Could not set commitment.')
      return { error }
    }
    await loadCommitments()
    return { data }
  }

  async function deleteCommitment(id) {
    if (!profile.value) return
    const { error } = await supabase
      .from('circle_commitments')
      .delete()
      .eq('id', id)
      .eq('user_id', userId.value)
    if (error) {
      toast.error('Could not remove commitment.')
      return
    }
    commitments.value = commitments.value.filter((c) => c.id !== id)
  }

  // ---------------------------------------------------------------------------
  // Leaderboard
  // ---------------------------------------------------------------------------

  async function loadLeaderboard(window = leaderboardWindow.value) {
    if (!profile.value) return
    leaderboardWindow.value = window
    const { data, error } = await supabase.rpc('circle_leaderboard', { p_window: window })
    if (error) {
      leaderboard.value = []
      return
    }
    leaderboard.value = (data || []).map((row, index) => ({
      ...row,
      rank: index + 1,
      isSelf: row.user_id === userId.value
    }))
    // Snapshot the whole-circle weekly total for the hero pulse, so it stays
    // stable even when the user toggles the leaderboard to month / all-time.
    if (window === 'week') {
      circleWeekMinutes.value = leaderboard.value.reduce((s, r) => s + (Number(r.minutes) || 0), 0)
    }
    // Texture rides the same window as the leaderboard, so toggling the window
    // reloads both in step.
    await loadCircleBreakdown(window)
  }

  // Pivot the flat (user, language, activity, minutes) rows into a per-gardener
  // map the leaderboard can render as a language-mix ribbon + activity legend.
  async function loadCircleBreakdown(window = leaderboardWindow.value) {
    if (!profile.value) return
    const { data, error } = await supabase.rpc('circle_breakdown', { p_window: window })
    if (error) {
      circleBreakdown.value = {}
      return
    }
    const map = {}
    for (const r of data || []) {
      const u = map[r.user_id] || (map[r.user_id] = { total: 0, _lang: {}, _act: {} })
      const mins = Number(r.minutes) || 0
      u.total += mins
      if (!u._lang[r.language_name]) {
        u._lang[r.language_name] = { name: r.language_name, color: r.language_color, minutes: 0 }
      }
      u._lang[r.language_name].minutes += mins
      u._act[r.activity_type] = (u._act[r.activity_type] || 0) + mins
    }
    const next = {}
    for (const [uid, u] of Object.entries(map)) {
      next[uid] = {
        total: u.total,
        languages: Object.values(u._lang).sort((a, b) => b.minutes - a.minutes),
        activities: Object.entries(u._act)
          .map(([type, minutes]) => ({ type, minutes }))
          .sort((a, b) => b.minutes - a.minutes)
      }
    }
    circleBreakdown.value = next
  }

  // ---------------------------------------------------------------------------
  // Realtime subscriptions
  // ---------------------------------------------------------------------------

  function subscribeFeed() {
    if (feedChannel) return
    feedChannel = supabase
      .channel('garden-dispatches')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_events' },
        (payload) => {
          const item = normalizeEvent(payload.new)
          if (!['milestone', 'bloom', 'commitment_progress', 'new_language'].includes(item.kind)) return
          if (feed.value.some((e) => e.id === item.id)) return
          feed.value = [item, ...feed.value].slice(0, 50)
        }
      )
      .subscribe()
  }

  function unsubscribeFeed() {
    if (feedChannel) {
      supabase.removeChannel(feedChannel)
      feedChannel = null
    }
  }

  function subscribeReactions() {
    if (reactionsChannel) return
    reactionsChannel = supabase
      .channel('garden-reactions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_reactions' },
        (payload) => {
          const r = payload.new
          if (!reactionsByEvent.value[r.event_id]) {
            reactionsByEvent.value[r.event_id] = []
          }
          const arr = reactionsByEvent.value[r.event_id]
          if (!arr.some((x) => x.id === r.id)) arr.push(r)
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'event_reactions' },
        (payload) => {
          const r = payload.old
          const arr = reactionsByEvent.value[r.event_id]
          if (arr) reactionsByEvent.value[r.event_id] = arr.filter((x) => x.id !== r.id)
        }
      )
      .subscribe()
  }

  function unsubscribeReactions() {
    if (reactionsChannel) {
      supabase.removeChannel(reactionsChannel)
      reactionsChannel = null
    }
  }

  function subscribeCommitments() {
    if (commitmentsChannel) return
    commitmentsChannel = supabase
      .channel('garden-commitments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'circle_commitments' },
        () => loadCommitments()
      )
      .subscribe()
  }

  function unsubscribeCommitments() {
    if (commitmentsChannel) {
      supabase.removeChannel(commitmentsChannel)
      commitmentsChannel = null
    }
  }

  async function deleteDispatch(id) {
    if (!profile.value) return
    const { error } = await supabase.from('activity_events').delete().eq('id', id)
    if (error) {
      toast.error('Could not remove dispatch.')
      return
    }
    feed.value = feed.value.filter((e) => e.id !== id)
  }

  // One like per gardener per celebration. Stored as a 'bloom' reaction so
  // historical reactions (water, bee, …) still count toward the same total —
  // unliking clears whatever kinds you gave under the old palette.
  async function toggleLike(eventId) {
    if (!profile.value) return
    const mine = (reactionsByEvent.value[eventId] || []).filter(
      (r) => r.reactor_id === userId.value
    )
    if (mine.length > 0) {
      await supabase
        .from('event_reactions')
        .delete()
        .eq('event_id', eventId)
        .eq('reactor_id', userId.value)
      reactionsByEvent.value[eventId] = reactionsByEvent.value[eventId].filter(
        (r) => r.reactor_id !== userId.value
      )
    } else {
      const { data } = await supabase
        .from('event_reactions')
        .insert({ event_id: eventId, reactor_id: userId.value, kind: 'bloom' })
        .select('id, event_id, reactor_id, kind')
        .single()
      if (data) {
        if (!reactionsByEvent.value[eventId]) reactionsByEvent.value[eventId] = []
        reactionsByEvent.value[eventId].push(data)
      }
    }
  }

  async function refresh() {
    await loadProfile()
    if (profile.value) {
      await Promise.all([
        loadFriends(),
        loadRequests(),
        loadFeed(),
        loadCommitments(),
        loadLeaderboard()
      ])
      await loadFeedReactions()
      subscribeFeed()
      subscribeReactions()
      subscribeCommitments()
    }
  }

  async function createProfile(username, displayName) {
    if (!userId.value) return { error: 'You need to be signed in.' }
    const uname = (username || '').trim().toLowerCase()
    const dname = (displayName || '').trim() || uname
    const { data, error } = await supabase
      .from('profiles')
      .insert({ id: userId.value, username: uname, display_name: dname })
      .select()
      .single()
    if (error) {
      if (error.code === '23505') return { error: 'That username is already growing here.' }
      if (error.code === '23514') {
        return { error: 'Usernames are 3–20 characters: lowercase letters, numbers, or underscores.' }
      }
      return { error: 'Could not plant your profile. Please try again.' }
    }
    profile.value = data
    await Promise.all([
      loadFriends(),
      loadRequests(),
      loadFeed(),
      loadCommitments(),
      loadLeaderboard()
    ])
    loadFeedReactions()
    subscribeFeed()
    subscribeReactions()
    subscribeCommitments()
    return { data }
  }

  async function updateProfile(updates) {
    if (!profile.value) return
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId.value)
      .select()
      .single()
    if (error) {
      toast.error('Could not update your profile.')
      return
    }
    profile.value = data
  }

  function toggleDiscoverable() {
    if (!profile.value) return
    updateProfile({ discoverable: !profile.value.discoverable })
  }

  async function searchUsers(q) {
    const query = (q || '').trim()
    if (query.length < 2) return []
    const { data, error } = await supabase.rpc('search_users', { q: query })
    if (error) return []
    return data || []
  }

  async function sendRequest(addresseeId) {
    if (!profile.value) return
    const { error } = await supabase
      .from('friendships')
      .insert({ requester_id: userId.value, addressee_id: addresseeId, status: 'pending' })
    if (error) {
      if (error.code === '23505') {
        toast.error('You already have a connection with them.')
      } else {
        toast.error('Could not send the request.')
      }
      return
    }
    toast.success('Request sent.')
    await loadRequests()
  }

  async function acceptRequest(id) {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      toast.error('Could not accept the request.')
      return
    }
    toast.success('You are growing together now.')
    await Promise.all([loadFriends(), loadRequests(), loadLeaderboard()])
  }

  // Used for declining an incoming request, cancelling an outgoing one, and
  // unfriending — all of which are just "remove the friendship row".
  async function removeFriendship(id) {
    const { error } = await supabase.from('friendships').delete().eq('id', id)
    if (error) {
      toast.error('Could not complete that.')
      return
    }
    await Promise.all([loadFriends(), loadRequests(), loadLeaderboard()])
  }

  // Reset (but don't auto-fetch) on auth change. SocialView triggers the first
  // fetch when it mounts, so solo users never pay for social queries.
  watch(userId, () => {
    unsubscribeFeed()
    unsubscribeReactions()
    unsubscribeCommitments()
    profile.value = null
    profileLoaded.value = false
    friends.value = []
    incomingRequests.value = []
    outgoingRequests.value = []
    feed.value = []
    commitments.value = []
    leaderboard.value = []
    leaderboardWindow.value = 'week'
    circleBreakdown.value = {}
    circleWeekMinutes.value = 0
    reactionsByEvent.value = {}
  })

  return {
    profile,
    profileLoaded,
    hasProfile,
    friends,
    incomingRequests,
    outgoingRequests,
    feed,
    reactionsByEvent,
    commitments,
    leaderboard,
    leaderboardWindow,
    circleBreakdown,
    circleWeekMinutes,
    refresh,
    loadFriends,
    loadRequests,
    loadFeed,
    createProfile,
    updateProfile,
    toggleDiscoverable,
    searchUsers,
    sendRequest,
    acceptRequest,
    removeFriendship,
    deleteDispatch,
    toggleLike,
    loadCommitments,
    setCommitment,
    deleteCommitment,
    loadLeaderboard,
    loadCircleBreakdown
  }
}
