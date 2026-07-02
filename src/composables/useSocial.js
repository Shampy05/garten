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
  const waters = ref([])
  const watersReceived = ref([])
  const recentCommentsOnMine = ref([])
  const nudgesReceived = ref([])
  const notificationsLastReadAt = ref(
    Number(localStorage.getItem('garten:notificationsLastReadAt')) || 0
  )
  const reactionsByEvent = ref({})
  const commentsByEvent = ref({})
  const selectedEvent = ref(null)

  // Garden Circle state
  const commitments = ref([])
  const leaderboard = ref([])
  const leaderboardWindow = ref('week')
  // Per-gardener language + activity texture for the leaderboard, keyed by
  // user_id, for the active leaderboard window. { languages[], activities[], total }.
  const circleBreakdown = ref({})
  const circleWeekMinutes = ref(0)
  // Map of user_id -> consecutive met-commitment weeks, for self + friends.
  const commitmentStreaks = ref({})
  // Grow buddies: shared-language pacts with a combined weekly goal.
  const buddyPacts = ref([])
  const pendingBuddyPacts = ref([])
  const outgoingBuddyPacts = ref([])
  // Books friends are reading (returned by circle_books RPC).
  const friendBooks = ref([])

  let feedChannel = null
  let reactionsChannel = null
  let commentsChannel = null
  let watersChannel = null
  let commitmentsChannel = null
  let nudgesChannel = null
  let buddyPactsChannel = null

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
      .in('kind', ['milestone', 'bloom', 'commitment_progress', 'circle_report', 'new_language'])
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

  async function loadComments(eventId) {
    if (!eventId) return
    const { data, error } = await supabase
      .from('event_comments')
      .select(
        'id, event_id, author_id, body, created_at, ' +
        'author:profiles!event_comments_author_id_fkey(username, display_name)'
      )
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })
    if (error) {
      commentsByEvent.value[eventId] = []
      return
    }
    commentsByEvent.value[eventId] = (data || []).map((c) => ({
      ...c,
      authorName: c.author?.display_name || c.author?.username || 'A gardener'
    }))
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

  async function loadCommitmentStreaks() {
    if (!profile.value) return
    const { data, error } = await supabase.rpc('circle_commitment_streaks')
    if (error) {
      commitmentStreaks.value = {}
      return
    }
    const next = {}
    for (const row of data || []) next[row.user_id] = row.weeks
    commitmentStreaks.value = next
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
  // Grow buddies
  // ---------------------------------------------------------------------------

  // Compare uuids as strings to derive the canonical (user_a < user_b) pair.
  function canonicalPair(a, b) {
    return a < b ? { user_a: a, user_b: b } : { user_a: b, user_b: a }
  }

  async function loadBuddyPacts() {
    if (!profile.value) return
    const { data, error } = await supabase.rpc('buddy_pacts_with_progress')
    if (error) {
      buddyPacts.value = []
      pendingBuddyPacts.value = []
      outgoingBuddyPacts.value = []
      return
    }
    const me = userId.value
    const rows = (data || []).map((p) => ({ ...p, isSelf: false }))
    buddyPacts.value = rows.filter((p) => p.status === 'accepted')
    pendingBuddyPacts.value = rows.filter((p) => p.status === 'pending' && p.proposer_id !== me)
    outgoingBuddyPacts.value = rows.filter((p) => p.status === 'pending' && p.proposer_id === me)
  }

  // ---------------------------------------------------------------------------
  // Friends' books
  // ---------------------------------------------------------------------------

  async function loadFriendBooks() {
    if (!profile.value) return
    const { data, error } = await supabase.rpc('circle_books')
    if (error) {
      friendBooks.value = []
      return
    }
    friendBooks.value = (data || []).map((b) => ({
      ...b,
      progressPct: b.total_pages
        ? Math.min(100, Math.round(((b.current_page || 0) / b.total_pages) * 100))
        : 0,
      pagesLeft: Math.max(0, (b.total_pages || 0) - (b.current_page || 0)),
      friendName: b.display_name || b.username || 'A gardener'
    }))
  }

  async function proposeBuddyPact(friendId, language, targetMinutes) {
    if (!profile.value) return { error: 'No profile' }
    const { user_a, user_b } = canonicalPair(userId.value, friendId)
    const { error } = await supabase.from('buddy_pacts').insert({
      proposer_id: userId.value,
      user_a,
      user_b,
      language_name: language.name,
      language_color: language.color,
      target_minutes: Math.max(1, Math.round(Number(targetMinutes) || 0))
    })
    if (error) {
      if (error.code === '23505') {
        toast.error('You already have a pact for that language together.')
      } else {
        toast.error('Could not send the invite.')
      }
      return { error }
    }
    toast.success('Invite sent — grow together.')
    await loadBuddyPacts()
    return {}
  }

  async function acceptBuddyPact(id) {
    if (!profile.value) return
    const { error } = await supabase
      .from('buddy_pacts')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      toast.error('Could not accept the pact.')
      return
    }
    toast.success('Growing together now.')
    await loadBuddyPacts()
  }

  async function declineBuddyPact(id) {
    if (!profile.value) return
    const { error } = await supabase.from('buddy_pacts').delete().eq('id', id)
    if (error) {
      toast.error('Could not decline the pact.')
      return
    }
    await loadBuddyPacts()
  }

  // Ending an accepted pact keeps the row (status = 'ended') so its history and
  // the unique slot stay coherent; cancelling a pending one just removes it.
  async function endBuddyPact(id) {
    if (!profile.value) return
    const { error } = await supabase
      .from('buddy_pacts')
      .update({ status: 'ended', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      toast.error('Could not end the pact.')
      return
    }
    buddyPacts.value = buddyPacts.value.filter((p) => p.id !== id)
    await loadBuddyPacts()
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
  // Nudges / cheers
  // ---------------------------------------------------------------------------

  async function loadNudgesReceived() {
    if (!profile.value) return
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('nudges')
      .select(
        'id, sender_id, recipient_id, kind, commitment_id, focus_session_id, created_at, ' +
        'sender:profiles!nudges_sender_id_fkey(username, display_name), ' +
        'commitment:circle_commitments!nudges_commitment_id_fkey(language_name, language_color, target_minutes), ' +
        'session:focus_sessions!nudges_focus_session_id_fkey(language_name, language_color, duration_minutes, status, ends_at)'
      )
      .eq('recipient_id', userId.value)
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) {
      nudgesReceived.value = []
      return
    }
    nudgesReceived.value = (data || []).map((n) => ({
      ...n,
      senderName: n.sender?.display_name || n.sender?.username || 'A gardener'
    }))
  }

  async function sendNudge(recipientId, kind, commitmentId) {
    if (!profile.value) return
    const { error } = await supabase
      .from('nudges')
      .insert({
        sender_id: userId.value,
        recipient_id: recipientId,
        kind,
        commitment_id: commitmentId
      })
    if (error) {
      toast.error(`Could not send ${kind}.`)
      return
    }
    toast.success(kind === 'cheer' ? 'Cheer sent — sunshine on its way.' : 'Nudge sent.')
  }

  // ---------------------------------------------------------------------------
  // Circle report
  // ---------------------------------------------------------------------------

  async function ensureCircleReport() {
    if (!profile.value) return
    // Only generate once per week. Regenerating on every load reshuffled the
    // feed (fresh id each time) and burned writes, so skip if one already exists.
    const weekStart = weekStartFor()
    const { data, error } = await supabase
      .from('activity_events')
      .select('id')
      .eq('actor_id', userId.value)
      .eq('kind', 'circle_report')
      .gte('occurred_on', weekStart)
      .limit(1)
    if (error) return
    if (data && data.length > 0) return
    await supabase.rpc('generate_circle_report')
    await loadFeed()
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
          if (!['milestone', 'bloom', 'commitment_progress', 'circle_report', 'new_language'].includes(item.kind)) return
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

  function subscribeComments() {
    if (commentsChannel) return
    commentsChannel = supabase
      .channel('garden-comments')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_comments' },
        async (payload) => {
          const c = payload.new
          // Keep the open detail view live.
          if (selectedEvent.value?.id === c.event_id) {
            const { data } = await supabase
              .from('event_comments')
              .select(
                'id, event_id, author_id, body, created_at, ' +
                'author:profiles!event_comments_author_id_fkey(username, display_name)'
              )
              .eq('id', c.id)
              .single()
            if (data) {
              if (!commentsByEvent.value[c.event_id]) commentsByEvent.value[c.event_id] = []
              const arr = commentsByEvent.value[c.event_id]
              if (!arr.some((x) => x.id === c.id)) {
                arr.push({
                  ...data,
                  authorName: data.author?.display_name || data.author?.username || 'A gardener'
                })
              }
            }
          }
          // Refresh notification bell for comments on the user's own dispatches.
          loadRecentCommentsOnMine()
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'event_comments' },
        (payload) => {
          const c = payload.old
          const arr = commentsByEvent.value[c.event_id]
          if (arr) commentsByEvent.value[c.event_id] = arr.filter((x) => x.id !== c.id)
          recentCommentsOnMine.value = recentCommentsOnMine.value.filter((x) => x.id !== c.id)
        }
      )
      .subscribe()
  }

  function unsubscribeComments() {
    if (commentsChannel) {
      supabase.removeChannel(commentsChannel)
      commentsChannel = null
    }
  }

  function subscribeWaters() {
    if (watersChannel) return
    watersChannel = supabase
      .channel('garden-waters')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'waters' },
        (payload) => {
          const w = payload.new
          if (w.recipient_id !== userId.value) return
          if (!watersReceived.value.some((x) => x.id === w.id)) {
            watersReceived.value.push({ ...w, senderName: 'A gardener' })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'waters' },
        (payload) => {
          const w = payload.old
          watersReceived.value = watersReceived.value.filter((x) => x.id !== w.id)
        }
      )
      .subscribe()
  }

  function unsubscribeWaters() {
    if (watersChannel) {
      supabase.removeChannel(watersChannel)
      watersChannel = null
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

  function subscribeNudges() {
    if (nudgesChannel) return
    nudgesChannel = supabase
      .channel('garden-nudges')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'nudges' },
        (payload) => {
          const n = payload.new
          if (n.recipient_id !== userId.value) return
          if (!nudgesReceived.value.some((x) => x.id === n.id)) {
            nudgesReceived.value.unshift({ ...n, senderName: 'A gardener' })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'nudges' },
        (payload) => {
          const n = payload.old
          nudgesReceived.value = nudgesReceived.value.filter((x) => x.id !== n.id)
        }
      )
      .subscribe()
  }

  function unsubscribeNudges() {
    if (nudgesChannel) {
      supabase.removeChannel(nudgesChannel)
      nudgesChannel = null
    }
  }

  function subscribeBuddyPacts() {
    if (buddyPactsChannel) return
    buddyPactsChannel = supabase
      .channel('garden-buddy-pacts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'buddy_pacts' },
        () => loadBuddyPacts()
      )
      .subscribe()
  }

  function unsubscribeBuddyPacts() {
    if (buddyPactsChannel) {
      supabase.removeChannel(buddyPactsChannel)
      buddyPactsChannel = null
    }
  }

  async function loadWaters() {
    if (!profile.value) return
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('waters')
      .select('id, recipient_id, watered_on')
      .eq('sender_id', userId.value)
      .eq('watered_on', today)
    if (error) {
      waters.value = []
      return
    }
    waters.value = data || []
  }

  async function loadWatersReceived() {
    if (!profile.value) return
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('waters')
      .select(
        'id, sender_id, watered_on, ' +
        'sender:profiles!waters_sender_id_fkey(username, display_name)'
      )
      .eq('recipient_id', userId.value)
      .eq('watered_on', today)
    if (error) {
      watersReceived.value = []
      return
    }
    watersReceived.value = (data || []).map((w) => ({
      ...w,
      senderName: w.sender?.display_name || w.sender?.username || 'A gardener'
    }))
  }

  async function loadRecentCommentsOnMine() {
    if (!profile.value) return
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('event_comments')
      .select(
        'id, event_id, author_id, body, created_at, ' +
        'author:profiles!event_comments_author_id_fkey(username, display_name), ' +
        'event:activity_events!event_comments_event_id_fkey(actor_id)'
      )
      .eq('event.actor_id', userId.value)
      .neq('author_id', userId.value)
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) {
      recentCommentsOnMine.value = []
      return
    }
    recentCommentsOnMine.value = (data || []).map((c) => ({
      ...c,
      authorName: c.author?.display_name || c.author?.username || 'A gardener'
    }))
  }

  function hasWatered(recipientId) {
    return waters.value.some((w) => w.recipient_id === recipientId)
  }

  async function waterFriend(recipientId) {
    if (!profile.value) return
    const { data, error } = await supabase
      .from('waters')
      .insert({ sender_id: userId.value, recipient_id: recipientId })
      .select('id, recipient_id, watered_on')
      .single()
    if (error) {
      if (error.code !== '23505') toast.error('Could not water that garden.')
      return
    }
    waters.value = [...waters.value, data]
  }

  async function unwaterFriend(recipientId) {
    const w = waters.value.find((x) => x.recipient_id === recipientId)
    if (!w) return
    await supabase.from('waters').delete().eq('id', w.id)
    waters.value = waters.value.filter((x) => x.id !== w.id)
  }

  async function deleteDispatch(id) {
    if (!profile.value) return
    const { error } = await supabase.from('activity_events').delete().eq('id', id)
    if (error) {
      toast.error('Could not remove dispatch.')
      return
    }
    feed.value = feed.value.filter((e) => e.id !== id)
    if (selectedEvent.value?.id === id) selectedEvent.value = null
  }

  async function toggleReaction(eventId, kind) {
    if (!profile.value) return
    const existing = (reactionsByEvent.value[eventId] || []).find(
      (r) => r.reactor_id === userId.value && r.kind === kind
    )
    if (existing) {
      await supabase.from('event_reactions').delete().eq('id', existing.id)
      reactionsByEvent.value[eventId] = reactionsByEvent.value[eventId].filter(
        (r) => r.id !== existing.id
      )
    } else {
      const { data } = await supabase
        .from('event_reactions')
        .insert({ event_id: eventId, reactor_id: userId.value, kind })
        .select('id, event_id, reactor_id, kind')
        .single()
      if (data) {
        if (!reactionsByEvent.value[eventId]) reactionsByEvent.value[eventId] = []
        reactionsByEvent.value[eventId].push(data)
      }
    }
  }

  async function addComment(eventId, body) {
    if (!profile.value || !body.trim()) return
    const { data, error } = await supabase
      .from('event_comments')
      .insert({ event_id: eventId, author_id: userId.value, body: body.trim() })
      .select(
        'id, event_id, author_id, body, created_at, ' +
        'author:profiles!event_comments_author_id_fkey(username, display_name)'
      )
      .single()
    if (error) {
      toast.error('Could not post comment.')
      return
    }
    if (!commentsByEvent.value[eventId]) commentsByEvent.value[eventId] = []
    commentsByEvent.value[eventId].push({
      ...data,
      authorName: data.author?.display_name || data.author?.username || 'You'
    })
  }

  async function deleteComment(commentId) {
    await supabase.from('event_comments').delete().eq('id', commentId)
    for (const eventId of Object.keys(commentsByEvent.value)) {
      commentsByEvent.value[eventId] = commentsByEvent.value[eventId].filter(
        (c) => c.id !== commentId
      )
    }
  }

  function openEventDetail(event) {
    selectedEvent.value = event
    loadComments(event.id)
    if (!reactionsByEvent.value[event.id]) loadFeedReactions()
  }

  function closeEventDetail() {
    selectedEvent.value = null
  }

  const watersReceivedToday = computed(() => watersReceived.value.length)

  const unseenWaters = computed(() => {
    const read = notificationsLastReadAt.value
    return watersReceived.value.filter((w) => {
      const ts = new Date(w.watered_on + 'T00:00:00').getTime()
      return ts > read
    }).length
  })

  const unseenComments = computed(() => {
    const read = notificationsLastReadAt.value
    return recentCommentsOnMine.value.filter(
      (c) => new Date(c.created_at).getTime() > read
    ).length
  })

  const unseenNudges = computed(() => {
    const read = notificationsLastReadAt.value
    return nudgesReceived.value.filter(
      (n) => new Date(n.created_at).getTime() > read
    ).length
  })

  const notificationCount = computed(() => unseenWaters.value + unseenComments.value + unseenNudges.value)
  const hasNotifications = computed(() => notificationCount.value > 0)

  function markNotificationsRead() {
    notificationsLastReadAt.value = Date.now()
    localStorage.setItem('garten:notificationsLastReadAt', String(notificationsLastReadAt.value))
  }

  function hasWateredMe(senderId) {
    return watersReceived.value.some((w) => w.sender_id === senderId)
  }

  async function refresh() {
    await loadProfile()
    if (profile.value) {
      await Promise.all([
        loadFriends(),
        loadRequests(),
        loadFeed(),
        loadWaters(),
        loadWatersReceived(),
        loadRecentCommentsOnMine(),
        loadCommitments(),
        loadLeaderboard(),
        loadNudgesReceived(),
        loadCommitmentStreaks(),
        loadBuddyPacts(),
        loadFriendBooks()
      ])
      await Promise.all([loadFeedReactions(), ensureCircleReport()])
      subscribeFeed()
      subscribeReactions()
      subscribeComments()
      subscribeWaters()
      subscribeCommitments()
      subscribeNudges()
      subscribeBuddyPacts()
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
      loadWatersReceived(),
      loadRecentCommentsOnMine(),
      loadCommitments(),
      loadLeaderboard(),
      loadNudgesReceived(),
      loadCommitmentStreaks(),
      loadBuddyPacts(),
      loadFriendBooks()
    ])
    loadFeedReactions()
    ensureCircleReport()
    subscribeFeed()
    subscribeReactions()
    subscribeComments()
    subscribeWaters()
    subscribeCommitments()
    subscribeNudges()
    subscribeBuddyPacts()
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
    unsubscribeComments()
    unsubscribeWaters()
    unsubscribeCommitments()
    unsubscribeNudges()
    unsubscribeBuddyPacts()
    profile.value = null
    profileLoaded.value = false
    friends.value = []
    incomingRequests.value = []
    outgoingRequests.value = []
    feed.value = []
    waters.value = []
    watersReceived.value = []
    recentCommentsOnMine.value = []
    nudgesReceived.value = []
    commitments.value = []
    leaderboard.value = []
    leaderboardWindow.value = 'week'
    circleBreakdown.value = {}
    circleWeekMinutes.value = 0
    commitmentStreaks.value = {}
    buddyPacts.value = []
    pendingBuddyPacts.value = []
    outgoingBuddyPacts.value = []
    reactionsByEvent.value = {}
    commentsByEvent.value = {}
    selectedEvent.value = null
  })

  return {
    profile,
    profileLoaded,
    hasProfile,
    friends,
    incomingRequests,
    outgoingRequests,
    feed,
    waters,
    watersReceived,
    reactionsByEvent,
    commentsByEvent,
    selectedEvent,
    commitments,
    leaderboard,
    leaderboardWindow,
    circleBreakdown,
    circleWeekMinutes,
    commitmentStreaks,
    buddyPacts,
    pendingBuddyPacts,
    outgoingBuddyPacts,
    friendBooks,
    nudgesReceived,
    recentCommentsOnMine,
    notificationCount,
    hasNotifications,
    unseenWaters,
    unseenComments,
    unseenNudges,
    watersReceivedToday,
    markNotificationsRead,
    refresh,
    loadFriends,
    loadRequests,
    loadFeed,
    loadWatersReceived,
    loadRecentCommentsOnMine,
    createProfile,
    updateProfile,
    toggleDiscoverable,
    searchUsers,
    sendRequest,
    acceptRequest,
    removeFriendship,
    hasWatered,
    hasWateredMe,
    waterFriend,
    unwaterFriend,
    deleteDispatch,
    toggleReaction,
    addComment,
    deleteComment,
    openEventDetail,
    closeEventDetail,
    loadCommitments,
    setCommitment,
    deleteCommitment,
    loadBuddyPacts,
    proposeBuddyPact,
    acceptBuddyPact,
    declineBuddyPact,
    endBuddyPact,
    loadFriendBooks,
    loadLeaderboard,
    loadCircleBreakdown,
    loadNudgesReceived,
    loadCommitmentStreaks,
    sendNudge,
    ensureCircleReport
  }
}
