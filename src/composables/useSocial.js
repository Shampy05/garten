import { ref, computed, watch } from 'vue'
import { supabase } from '../lib/supabase.js'
import { useToast } from './useToast.js'
import { useAuth } from './useAuth.js'

// Social data layer. Mirrors useStorage: owns every Supabase call for the
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
  const ownWeeklyMinutes = ref(0)
  const reactionsByEvent = ref({})
  const commentsByEvent = ref({})
  const selectedEvent = ref(null)
  let feedChannel = null
  let reactionsChannel = null
  let commentsChannel = null
  let watersChannel = null

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

  // One realtime channel for the dispatch stream. RLS scopes the inserts we
  // receive to our own + friends' events, so no client-side filter is needed.
  function subscribeFeed() {
    if (feedChannel) return
    feedChannel = supabase
      .channel('garden-dispatches')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_events' },
        (payload) => {
          const item = normalizeEvent(payload.new)
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
          if (!selectedEvent.value || selectedEvent.value.id !== c.event_id) return
          const { data } = await supabase
            .from('event_comments')
            .select(
              'id, event_id, author_id, body, created_at, ' +
              'author:profiles!event_comments_author_id_fkey(username, display_name)'
            )
            .eq('id', c.id)
            .single()
          if (!data) return
          if (!commentsByEvent.value[c.event_id]) commentsByEvent.value[c.event_id] = []
          const arr = commentsByEvent.value[c.event_id]
          if (!arr.some((x) => x.id === c.id)) {
            arr.push({
              ...data,
              authorName: data.author?.display_name || data.author?.username || 'A gardener'
            })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'event_comments' },
        (payload) => {
          const c = payload.old
          const arr = commentsByEvent.value[c.event_id]
          if (arr) commentsByEvent.value[c.event_id] = arr.filter((x) => x.id !== c.id)
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

  async function loadWaters() {
    if (!profile.value) return
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('waters')
      .select('id, recipient_id, watered_on')
      .eq('sender_id', userId.value)
      .eq('watered_on', today)
    if (error) {
      // Gracefully degrade if the waters table is not yet deployed.
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

  async function loadOwnWeeklyMinutes() {
    if (!userId.value) return
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    const weekStart = d.toISOString().split('T')[0]
    const { data } = await supabase
      .from('entries')
      .select('hours, minutes')
      .eq('user_id', userId.value)
      .gte('date', weekStart)
    ownWeeklyMinutes.value = (data || []).reduce(
      (sum, e) => sum + Number(e.hours) * 60 + Number(e.minutes), 0
    )
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

  async function shareWeeklySummary() {
    const { error } = await supabase.rpc('share_weekly_summary')
    if (error) {
      toast.error('Could not share your harvest.')
      return
    }
    toast.success('Harvest shared with your circle.')
    await loadFeed()
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

  const tendingToday = computed(() => {
    const today = new Date().toISOString().split('T')[0]
    const seen = new Set()
    const out = []
    for (const item of feed.value) {
      if (item.occurred_on !== today || item.kind !== 'session') continue
      if (seen.has(item.actor_id)) continue
      seen.add(item.actor_id)
      out.push({ actorId: item.actor_id, name: item.actorName, isSelf: item.isSelf })
    }
    return out
  })

  const togetherWeekMinutes = computed(() => {
    const friendMins = friends.value.reduce(
      (sum, f) => sum + (Number(f.minutes_this_week) || 0), 0
    )
    return (Number(ownWeeklyMinutes.value) || 0) + friendMins
  })

  const watersReceivedToday = computed(() => watersReceived.value.length)

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
        loadOwnWeeklyMinutes()
      ])
      await loadFeedReactions()
      subscribeFeed()
      subscribeReactions()
      subscribeComments()
      subscribeWaters()
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
    await Promise.all([loadFriends(), loadRequests(), loadFeed(), loadWatersReceived()])
    loadFeedReactions()
    subscribeFeed()
    subscribeReactions()
    subscribeComments()
    subscribeWaters()
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
    await Promise.all([loadFriends(), loadRequests()])
  }

  // Used for declining an incoming request, cancelling an outgoing one, and
  // unfriending — all of which are just "remove the friendship row".
  async function removeFriendship(id) {
    const { error } = await supabase.from('friendships').delete().eq('id', id)
    if (error) {
      toast.error('Could not complete that.')
      return
    }
    await Promise.all([loadFriends(), loadRequests()])
  }

  // Reset (but don't auto-fetch) on auth change. SocialView triggers the first
  // fetch when it mounts, so solo users never pay for social queries.
  watch(userId, () => {
    unsubscribeFeed()
    unsubscribeReactions()
    unsubscribeComments()
    unsubscribeWaters()
    profile.value = null
    profileLoaded.value = false
    friends.value = []
    incomingRequests.value = []
    outgoingRequests.value = []
    feed.value = []
    waters.value = []
    watersReceived.value = []
    ownWeeklyMinutes.value = 0
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
    ownWeeklyMinutes,
    reactionsByEvent,
    commentsByEvent,
    selectedEvent,
    tendingToday,
    togetherWeekMinutes,
    watersReceivedToday,
    refresh,
    loadFriends,
    loadRequests,
    loadFeed,
    loadWatersReceived,
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
    shareWeeklySummary,
    deleteDispatch,
    toggleReaction,
    addComment,
    deleteComment,
    openEventDetail,
    closeEventDetail
  }
}
