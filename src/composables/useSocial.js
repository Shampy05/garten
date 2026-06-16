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
  const ownWeeklyMinutes = ref(0)
  let feedChannel = null

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
    const { name, isSelf } = actorLabel(row.actor_id, row.actor)
    return { ...row, actorName: name, isSelf }
  }

  async function loadFeed() {
    if (!profile.value) return
    const { data, error } = await supabase
      .from('activity_events')
      .select(
        'id, actor_id, kind, language_name, language_color, activity_type, minutes, streak_days, occurred_on, created_at, ' +
        'actor:profiles!activity_events_actor_id_fkey(username, display_name)'
      )
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) return
    feed.value = (data || []).map(normalizeEvent)
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

  async function loadWaters() {
    if (!profile.value) return
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('waters')
      .select('id, recipient_id, watered_on')
      .eq('sender_id', userId.value)
      .eq('watered_on', today)
    waters.value = data || []
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
      toast.error('Could not share your summary.')
      return
    }
    toast.success('Summary shared with your circle.')
    await loadFeed()
  }

  async function refresh() {
    await loadProfile()
    if (profile.value) {
      await Promise.all([loadFriends(), loadRequests(), loadFeed(), loadWaters(), loadOwnWeeklyMinutes()])
      subscribeFeed()
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
    await Promise.all([loadFriends(), loadRequests(), loadFeed()])
    subscribeFeed()
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
    profile.value = null
    profileLoaded.value = false
    friends.value = []
    incomingRequests.value = []
    outgoingRequests.value = []
    feed.value = []
  })

  return {
    profile,
    profileLoaded,
    hasProfile,
    friends,
    incomingRequests,
    outgoingRequests,
    feed,
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
    removeFriendship
  }
}
