import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useAction, useConvexAuth } from 'convex/react'
import { useAuthActions } from '@convex-dev/auth/react'
import { api } from '../../convex/_generated/api'

const AppContext = createContext(null)

let toastId = 0

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
function todayLabel() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function AppProvider({ children }) {
  // --- UI-only state ---
  const [demoRole, setDemoRole] = useState(null) // set when exploring without an account
  const [view, setView] = useState('home')
  // A daycare claiming its public directory listing arrives via
  // mitten.care/childcare/<area> → /signup?claim=<area>. Stash the area so it
  // survives signup + onboarding (which rewrite the URL), then route them to
  // Account → Public listing once their facility exists.
  const [claimArea, setClaimArea] = useState(() => {
    try {
      const c = new URLSearchParams(window.location.search).get('claim')
      if (c) { sessionStorage.setItem('mitten_claim_area', c); return c }
      return sessionStorage.getItem('mitten_claim_area') || null
    } catch { return null }
  })
  // The specific centre being claimed (from /signup?claim=<area>&name=<daycare>),
  // so the listing panel pre-fills their exact name — not just the area.
  const [claimName, setClaimName] = useState(() => {
    try {
      const n = new URLSearchParams(window.location.search).get('name')
      if (n) { sessionStorage.setItem('mitten_claim_name', n); return n }
      return sessionStorage.getItem('mitten_claim_name') || null
    } catch { return null }
  })
  const claimRoutedRef = useRef(false)
  const clearClaimArea = useCallback(() => {
    setClaimArea(null)
    setClaimName(null)
    try { sessionStorage.removeItem('mitten_claim_area'); sessionStorage.removeItem('mitten_claim_name') } catch {}
  }, [])
  const [activeChildId, setActiveChildId] = useState('c1')
  const [toasts, setToasts] = useState([])

  // --- Auth ---
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth()
  const { signOut } = useAuthActions()
  const viewerQ = useQuery(api.users.viewer) // null when signed out, undefined while resolving
  const viewer = viewerQ ?? null
  // Real account role wins; otherwise fall back to the demo role.
  const role = isAuthenticated ? viewer?.role ?? null : demoRole
  const authResolving = authLoading || (isAuthenticated && viewerQ === undefined)

  // --- Live data from Convex ---
  const timelineQ = useQuery(api.activities.list)
  const conversationsQ = useQuery(api.conversations.list)
  const invoicesQ = useQuery(api.invoices.list)
  const rosterQ = useQuery(api.roster.list)
  const photosQ = useQuery(api.photos.list)
  const educatorsQ = useQuery(api.educators.list)
  const lessonPlanQ = useQuery(api.lessons.plan)
  const lessonBlocksQ = useQuery(api.lessons.blocks)
  const resourcesQ = useQuery(api.resources.list)
  const facilityQ = useQuery(api.facilities.current)
  const childrenQ = useQuery(api.children.list)
  const invitesQ = useQuery(api.facilities.listInvites)
  const milestonesQ = useQuery(api.milestones.list)

  const timeline = timelineQ ?? []
  const conversations = conversationsQ ?? []
  const invoices = invoicesQ ?? []
  const roster = rosterQ ?? []
  const photos = photosQ ?? []
  const educators = educatorsQ ?? []
  const lessonPlan = lessonPlanQ ?? null
  const lessonBlocks = lessonBlocksQ ?? []
  const resources = resourcesQ ?? []
  const facility = facilityQ ?? null

  // Once a claiming owner has a facility, jump them to Account → Public listing
  // (the panel reads claimArea to preselect their area). Fires even before the
  // full onboarding wizard — claiming + setting a status is their onboarding.
  useEffect(() => {
    if (claimArea && !claimRoutedRef.current && facility && !facility.isDemo && facility.isOwner) {
      claimRoutedRef.current = true
      setView('account')
    }
  }, [claimArea, facility])
  const childrenList = childrenQ ?? []
  const invites = invitesQ ?? []
  const milestones = milestonesQ ?? []

  const loading =
    timelineQ === undefined ||
    conversationsQ === undefined ||
    invoicesQ === undefined ||
    rosterQ === undefined ||
    photosQ === undefined

  // --- Mutations ---
  const addActivityMut = useMutation(api.activities.add)
  const sendMut = useMutation(api.conversations.send)
  const markReadMut = useMutation(api.conversations.markRead)
  const payMut = useMutation(api.invoices.pay)
  const toggleMut = useMutation(api.roster.toggle)
  const setStatusMut = useMutation(api.roster.setStatus)
  const likeMut = useMutation(api.photos.like)
  const clockMut = useMutation(api.educators.clock)
  const confirmCheckout = useAction(api.payments.confirmCheckout)
  // --- Tenant / billing ---
  const createFacilityMut = useMutation(api.facilities.createForCurrentUser)
  const completeOnboardingMut = useMutation(api.facilities.completeOnboarding)
  const generateInviteMut = useMutation(api.facilities.generateInvite)
  const revokeInviteMut = useMutation(api.facilities.revokeInvite)
  const joinViaTokenMut = useMutation(api.facilities.joinViaToken)
  const addEducatorMut = useMutation(api.educators.add)
  const removeChildMut = useMutation(api.children.remove)
  const claimChildMut = useMutation(api.children.claim)
  const setTuitionMut = useMutation(api.children.setTuition)
  const addPhotoMut = useMutation(api.photos.add)
  const startThreadMut = useMutation(api.conversations.startWithParent)
  const addMilestoneMut = useMutation(api.milestones.add)
  const removeMilestoneMut = useMutation(api.milestones.remove)
  const genUploadUrlMut = useMutation(api.files.generateUploadUrl)
  const setMyAvatarMut = useMutation(api.files.setMyAvatar)
  const setChildPhotoMut = useMutation(api.files.setChildPhoto)
  const setEducatorPhotoMut = useMutation(api.files.setEducatorPhoto)
  const addChildAction = useAction(api.billing.addChild)
  const startCheckoutAction = useAction(api.billing.startCheckout)
  const billingPortalAction = useAction(api.billing.billingPortal)
  const syncQuantityAction = useAction(api.billing.syncQuantity)
  const confirmSubscriptionAction = useAction(api.billing.confirmSubscription)
  const draftNoteAction = useAction(api.ai.draftNote)
  const dailyRecapAction = useAction(api.ai.dailyRecap)
  const scanIntakeAction = useAction(api.ai.scanIntake)
  // Lessons + training (mutations passed straight through to views)
  const setLessonTheme = useMutation(api.lessons.setTheme)
  const addLessonBlock = useMutation(api.lessons.addBlock)
  const updateLessonBlock = useMutation(api.lessons.updateBlock)
  const deleteLessonBlock = useMutation(api.lessons.deleteBlock)
  const setLessonStatus = useMutation(api.lessons.setStatus)
  const toggleLessonChild = useMutation(api.lessons.toggleChild)
  const addResource = useMutation(api.resources.add)
  const removeResource = useMutation(api.resources.remove)

  // --- Toasts (local) ---
  const pushToast = useCallback((message, opts = {}) => {
    const id = ++toastId
    setToasts((t) => [...t, { id, message, emoji: opts.emoji || '🎉', tone: opts.tone || 'brand' }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration || 3200)
  }, [])
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  // Handle the redirect back from Stripe Checkout.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const stripe = params.get('stripe')
    if (!stripe) return
    const clean = () => window.history.replaceState({}, '', window.location.pathname)
    if (stripe === 'success') {
      const sessionId = params.get('session_id')
      if (sessionId) {
        confirmCheckout({ sessionId, invId: params.get('inv') || undefined })
          .then((r) => {
            if (r?.ok) pushToast('Payment received — thank you! 💙', { emoji: '✅', tone: 'mint', duration: 5000 })
          })
          .catch(() => {})
      }
      clean()
    } else if (stripe === 'cancel') {
      pushToast('Checkout canceled — no charge was made.', { emoji: '↩️', tone: 'coral' })
      clean()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle the redirect back from subscription billing setup.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const billing = params.get('billing')
    if (!billing) return
    const clean = () => window.history.replaceState({}, '', '/app')
    if (billing === 'success') {
      const sessionId = params.get('session_id')
      ;(async () => {
        // Confirm the session against Stripe right away so the plan activates
        // deterministically (the webhook is just a backup).
        if (sessionId) { try { await confirmSubscriptionAction({ sessionId }) } catch {} }
        pushToast('Billing is set up — card on file 💳', { emoji: '✅', tone: 'mint', duration: 5000 })
        let pending = null
        try { pending = JSON.parse(sessionStorage.getItem('cubby_pending_child') || 'null') } catch {}
        if (pending) {
          sessionStorage.removeItem('cubby_pending_child')
          try {
            const r = await addChildAction({ ...pending, origin: window.location.origin })
            if (r?.ok) pushToast(`${pending.first} is enrolled 🎒`, { emoji: '🎒', tone: 'brand' })
            else if (r?.needsBilling) pushToast(`Card saved — tap Add child to finish enrolling ${pending.first}.`, { emoji: '👶', tone: 'brand', duration: 5000 })
          } catch {}
        }
        // Reconcile the subscription quantity with the real roster.
        try { await syncQuantityAction({}) } catch {}
      })()
      clean()
    } else if (billing === 'cancel') {
      try { sessionStorage.removeItem('cubby_pending_child') } catch {}
      pushToast('Billing setup canceled — no charge was made.', { emoji: '↩️', tone: 'coral' })
      clean()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After an owner/parent signs up, finish wiring them to a facility once auth
  // has fully propagated (calling these inline right after signIn races the
  // token and fails with "Sign in first").
  useEffect(() => {
    if (!isAuthenticated || !viewer || viewer.hasFacility) return
    let pendFac = null
    let pendJoin = null
    try {
      pendFac = sessionStorage.getItem('cubby_pending_facility')
      pendJoin = sessionStorage.getItem('cubby_pending_join')
    } catch {}
    if (pendJoin) {
      try { sessionStorage.removeItem('cubby_pending_join') } catch {}
      joinViaTokenMut({ token: pendJoin }).catch(() => {})
    } else if (pendFac && viewer.role === 'admin') {
      try { sessionStorage.removeItem('cubby_pending_facility') } catch {}
      createFacilityMut({ name: pendFac }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, viewer?.hasFacility, viewer?.id])

  // --- Navigation ---
  const enterRole = useCallback((r) => {
    setDemoRole(r)
    setView('home')
  }, [])
  const logout = useCallback(async () => {
    if (isAuthenticated) await signOut()
    setDemoRole(null)
    setView('home')
  }, [isAuthenticated, signOut])

  // --- Actions (same signatures the views already use) ---
  const addActivity = useCallback(
    (entry) => addActivityMut(entry),
    [addActivityMut],
  )
  const sendMessage = useCallback(
    (conversationId, text) => sendMut({ conversationId, text, time: nowTime() }),
    [sendMut],
  )
  const markConversationRead = useCallback(
    (conversationId) => markReadMut({ conversationId }),
    [markReadMut],
  )
  const payInvoice = useCallback((id) => payMut({ id, paidOn: todayLabel() }), [payMut])
  const toggleAttendance = useCallback((id) => toggleMut({ id, time: nowTime() }), [toggleMut])
  const setAttendance = useCallback((id, status) => setStatusMut({ id, status, time: nowTime() }), [setStatusMut])
  const likePhoto = useCallback((id) => likeMut({ id }), [likeMut])
  const clockEducator = useCallback((id) => clockMut({ id, time: nowTime() }), [clockMut])

  // --- Tenant / billing wrappers ---
  const createFacility = useCallback((name) => createFacilityMut({ name }), [createFacilityMut])
  const completeOnboarding = useCallback(() => completeOnboardingMut({}), [completeOnboardingMut])
  const generateInvite = useCallback((role, label, childId) => generateInviteMut({ role, label, childId }), [generateInviteMut])
  const revokeInvite = useCallback((id) => revokeInviteMut({ id }), [revokeInviteMut])
  const joinFacility = useCallback((token) => joinViaTokenMut({ token }), [joinViaTokenMut])
  const addEducator = useCallback((fields) => addEducatorMut(fields), [addEducatorMut])

  // Enroll a child. Handles the freemium gate: when it crosses the free limit
  // without a card on file, Stripe Checkout opens to collect one (we stash the
  // child so the form can be re-offered on return).
  const enrollChild = useCallback(
    async (fields) => {
      const res = await addChildAction({ ...fields, origin: window.location.origin })
      if (res?.needsBilling && res.url) {
        try { sessionStorage.setItem('cubby_pending_child', JSON.stringify(fields)) } catch {}
        window.location.href = res.url
        return { redirecting: true }
      }
      if (res?.ok) pushToast(`${fields.first} is enrolled 🎒`, { emoji: '🎒', tone: 'brand' })
      return res
    },
    [addChildAction, pushToast],
  )
  const removeChild = useCallback(
    async (id) => {
      await removeChildMut({ id })
      try { await syncQuantityAction({}) } catch {}
    },
    [removeChildMut, syncQuantityAction],
  )
  const claimChild = useCallback((id) => claimChildMut({ id }), [claimChildMut])
  const setTuition = useCallback((id, monthlyTuition) => setTuitionMut({ id, monthlyTuition }), [setTuitionMut])
  const addMilestone = useCallback((fields) => addMilestoneMut(fields), [addMilestoneMut])
  const removeMilestone = useCallback((id) => removeMilestoneMut({ id }), [removeMilestoneMut])
  const draftNote = useCallback((args) => draftNoteAction(args), [draftNoteAction])
  const dailyRecap = useCallback((args) => dailyRecapAction(args), [dailyRecapAction])
  const scanIntake = useCallback((storageId) => scanIntakeAction({ storageId }), [scanIntakeAction])
  const addPhoto = useCallback((fields) => addPhotoMut(fields), [addPhotoMut])
  const startThread = useCallback((parentUserId, name) => startThreadMut({ parentUserId, name }), [startThreadMut])

  // Upload an image to Convex storage → returns a storageId.
  const uploadImage = useCallback(
    async (file) => {
      const url = await genUploadUrlMut({})
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': file.type }, body: file })
      const { storageId } = await res.json()
      return storageId
    },
    [genUploadUrlMut],
  )
  const setMyAvatar = useCallback(async (file) => { const imageId = await uploadImage(file); await setMyAvatarMut({ imageId }) }, [uploadImage, setMyAvatarMut])
  const setChildPhoto = useCallback(async (id, file) => { const imageId = await uploadImage(file); await setChildPhotoMut({ id, imageId }) }, [uploadImage, setChildPhotoMut])
  const setEducatorPhoto = useCallback(async (id, file) => { const imageId = await uploadImage(file); await setEducatorPhotoMut({ id, imageId }) }, [uploadImage, setEducatorPhotoMut])
  const postPhoto = useCallback(
    async ({ file, caption, audience, childId, childName, emoji, gradient }) => {
      const imageId = file ? await uploadImage(file) : undefined
      await addPhotoMut({ caption: caption || 'New moment', room: 'Main Room', emoji, gradient, imageId, audience, childId, childName })
    },
    [uploadImage, addPhotoMut],
  )
  const startBilling = useCallback(async () => {
    const res = await startCheckoutAction({ origin: window.location.origin })
    if (res?.configured && res.url) { window.location.href = res.url; return { redirecting: true } }
    if (!res?.configured) pushToast('Billing isn’t connected yet — almost there!', { emoji: '⚙️', tone: 'coral' })
    return res
  }, [startCheckoutAction, pushToast])
  const openBillingPortal = useCallback(async () => {
    const res = await billingPortalAction({ origin: window.location.origin })
    if (res?.url) { window.location.href = res.url; return { redirecting: true } }
    pushToast(res?.error || 'Could not open billing settings.', { emoji: '⚠️', tone: 'coral' })
    return res
  }, [billingPortalAction, pushToast])

  const value = {
    role,
    enterRole,
    logout,
    isAuthenticated,
    authResolving,
    viewer,
    view,
    setView,
    claimArea,
    claimName,
    clearClaimArea,
    activeChildId,
    setActiveChildId,
    loading,
    timeline,
    addActivity,
    conversations,
    sendMessage,
    markConversationRead,
    invoices,
    payInvoice,
    roster,
    toggleAttendance,
    setAttendance,
    photos,
    likePhoto,
    educators,
    clockEducator,
    lessonPlan,
    lessonBlocks,
    resources,
    setLessonTheme,
    addLessonBlock,
    updateLessonBlock,
    deleteLessonBlock,
    setLessonStatus,
    toggleLessonChild,
    addResource,
    removeResource,
    // Tenant / billing
    facility,
    childrenList,
    invites,
    milestones,
    addMilestone,
    removeMilestone,
    draftNote,
    dailyRecap,
    scanIntake,
    createFacility,
    completeOnboarding,
    generateInvite,
    revokeInvite,
    joinFacility,
    addEducator,
    enrollChild,
    removeChild,
    claimChild,
    setTuition,
    addPhoto,
    postPhoto,
    uploadImage,
    setMyAvatar,
    setChildPhoto,
    setEducatorPhoto,
    startThread,
    startBilling,
    openBillingPortal,
    toasts,
    pushToast,
    dismissToast,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
