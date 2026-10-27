import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useAction, useConvexAuth } from 'convex/react'
import { useAuthActions } from '@convex-dev/auth/react'
import { api } from '../../convex/_generated/api'
import { getEntry } from '../routes.js'
import { fileToBase64, prepareImage } from '../lib/files.js'
import { dayKey } from '../lib/careData.js'
import { useProtectedMedia } from '../lib/useProtectedMedia.js'

const AppContext = createContext(null)

let toastId = 0

function nowTime(timeZone) {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone:timeZone || 'America/Vancouver' })
}
function todayLabel() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function AppProvider({ children }) {
  // --- UI-only state ---
  const [demoRole, setDemoRole] = useState(null) // set when exploring without an account
  // Only this explicit, known email-link intent changes a cold launch. Normal
  // app launches still start on the dashboard; warm resumes keep current work.
  const launchViewRef = useRef(new URLSearchParams(window.location.search).get('open') === 'calendar' ? 'calendar' : 'home')
  const launchViewHandledRef = useRef(false)
  const [view, setView] = useState(() => launchViewRef.current)
  const entryRef = useRef(getEntry())
  try {if(['join','slug'].includes(entryRef.current.kind)&&entryRef.current.token)sessionStorage.setItem('cubby_pending_join',entryRef.current.token)} catch {}
  const paymentReturnRef = useRef(new URLSearchParams(window.location.search))
  const paymentProcessingRef = useRef(false)
  const [paymentReturnError,setPaymentReturnError] = useState('')
  const [paymentRetry,setPaymentRetry] = useState(0)
  const [membershipError,setMembershipError] = useState('')
  const [membershipRetry,setMembershipRetry] = useState(0)
  const [joiningFacility,setJoiningFacility] = useState(false)
  const retryPaymentReturn = useCallback(()=>{paymentProcessingRef.current=false;setPaymentRetry(x=>x+1)},[])
  const retryMembership = useCallback(()=>{pendingMembershipRef.current=null;setMembershipRetry(x=>x+1)},[])
  // A daycare claiming its public directory listing arrives via
  // mitten.care/childcare/<area> → /signup?claim=<area>. Stash the area so it
  // survives signup + onboarding (which rewrite the URL), then route them to
  // Account → Public listing once their facility exists.
  const [claimArea, setClaimArea] = useState(() => {
    try {
      const c = new URLSearchParams(window.location.search).get('claim')
      if (c) { sessionStorage.setItem('mitten_claim_area', c); return c }
      sessionStorage.removeItem('mitten_claim_area'); sessionStorage.removeItem('mitten_claim_name')
      return null
    } catch { return null }
  })
  // The specific centre being claimed (from /signup?claim=<area>&name=<daycare>),
  // so the listing panel pre-fills their exact name — not just the area.
  const [claimName, setClaimName] = useState(() => {
    try {
      const n = new URLSearchParams(window.location.search).get('name')
      if (n) { sessionStorage.setItem('mitten_claim_name', n); return n }
      return null
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
  const displayPreferences = useQuery(api.preferences.get,isAuthenticated?{}:'skip')
  useEffect(()=>{
    const previous=document.documentElement.style.fontSize
    document.documentElement.style.fontSize=displayPreferences?.textSize==='large'?'18px':''
    return ()=>{document.documentElement.style.fontSize=previous}
  },[displayPreferences?.textSize])
  // Real account role wins; otherwise fall back to the demo role.
  const role = isAuthenticated ? viewer?.role ?? null : demoRole
  const authResolving = authLoading || (isAuthenticated && viewerQ === undefined)

  // A removed membership must never subscribe to workspace data, even with an old token.
  const canReadWorkspace = !isAuthenticated || (!!viewer?.hasFacility && viewer?.accessStatus !== 'suspended' && viewer?.hasActiveChildren !== false)
  useEffect(() => {
    if (!isAuthenticated || !viewer?.id) {
      if (launchViewHandledRef.current) launchViewRef.current = 'home'
      return
    }
    setView(launchViewRef.current)
    // Keep this idempotent during React StrictMode's mount-effect replay.
    launchViewHandledRef.current = true
    const params = new URLSearchParams(window.location.search)
    params.delete('open')
    // A later payment reconciliation uses its original snapshot. Consume the
    // navigation hint there too so it cannot reappear after a payment succeeds.
    paymentReturnRef.current.delete('open')
    if (!params.get('claim')) {
      try { sessionStorage.removeItem('cubby_fresh_auth') } catch {}
    }
    const nextPath = params.get('claim') ? window.location.pathname : '/app'
    window.history.replaceState(null, '', nextPath + (params.toString() ? '?' + params.toString() : ''))
  }, [isAuthenticated, viewer?.id])

  // --- Live data from Convex ---
  const [clockNow,setClockNow]=useState(Date.now())
  useEffect(()=>{const timer=setInterval(()=>setClockNow(Date.now()),60_000);return()=>clearInterval(timer)},[])
  const facilityQ = useQuery(api.facilities.current, canReadWorkspace ? {} : 'skip')
  const datedArgs=isAuthenticated?{date:dayKey(clockNow,facilityQ?.timezone)}:{}
  const timelineQ = useQuery(api.activities.list, canReadWorkspace ? datedArgs : 'skip')
  const conversationsQ = useQuery(api.conversations.list, canReadWorkspace ? {} : 'skip')
  const invoicesQ = useQuery(api.invoices.list, canReadWorkspace ? {} : 'skip')
  const rosterQ = useQuery(api.roster.list, canReadWorkspace ? datedArgs : 'skip')
  const photosQ = useQuery(api.photos.list, canReadWorkspace ? {limit:12} : 'skip')
  const educatorsQ = useQuery(api.educators.list, canReadWorkspace ? { asOfDay: dayKey(clockNow, facilityQ?.timezone) } : 'skip')
  const lessonPlanQ = useQuery(api.lessons.plan, canReadWorkspace ? {} : 'skip')
  const lessonBlocksQ = useQuery(api.lessons.blocks, canReadWorkspace ? {} : 'skip')
  const resourcesQ = useQuery(api.resources.list, canReadWorkspace ? {} : 'skip')
  const childrenQ = useQuery(api.children.list, canReadWorkspace ? datedArgs : 'skip')
  const invitesQ = useQuery(api.facilities.listInvites, canReadWorkspace && role === 'admin' ? {} : 'skip')
  const milestonesQ = useQuery(api.milestones.list, canReadWorkspace ? {} : 'skip')

  const timeline = timelineQ ?? []
  const conversations = conversationsQ ?? []
  const invoices = invoicesQ ?? []
  const roster = rosterQ ?? []
  const photos = useProtectedMedia(photosQ ?? [])
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
  const childrenList = useProtectedMedia(childrenQ ?? [])
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
  const clockMut = useMutation(api.educators.setClock)
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
  const uploadFileAction = useAction(api.files.uploadFile)
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

  // Keep callback parameters until authenticated reconciliation completes. A
  // failed confirmation stays recoverable across reloads and never claims paid.
  useEffect(() => {
    const params = paymentReturnRef.current
    const stripe = params.get('stripe'); const billing = params.get('billing')
    if ((!stripe && !billing) || authResolving || !isAuthenticated || !viewer?.hasFacility || paymentProcessingRef.current) return
    paymentProcessingRef.current = true
    setPaymentReturnError('')
    setView(stripe ? (viewer.role === 'parent' ? 'billing' : 'invoices') : 'account')
    ;(async () => {
      try {
        if (stripe === 'success') {
          const sessionId = params.get('session_id')
          if (!sessionId) throw new Error('Payment reference is missing. Contact the daycare before trying another payment.')
          const result = await confirmCheckout({sessionId,invId:params.get('inv') || undefined})
          if (!result?.ok) throw new Error(result?.error || 'Payment has not been confirmed yet. Please retry confirmation before paying again.')
          pushToast('Payment confirmed. Your receipt is in Billing.',{emoji:'✅',tone:'mint',duration:5000})
        } else if (billing === 'success') {
          const sessionId = params.get('session_id')
          if (!sessionId) throw new Error('Billing setup reference is missing.')
          const result = await confirmSubscriptionAction({sessionId})
          if (!result?.ok) throw new Error(result?.error || 'Billing setup could not be confirmed yet.')
          pushToast('Billing setup confirmed.',{emoji:'✅',tone:'mint'})
          let pending = null
          try {pending=JSON.parse(sessionStorage.getItem('cubby_pending_child') || 'null')} catch {}
          if (pending) {
            const childResult=await addChildAction({...pending,origin:window.location.origin})
            if(childResult?.ok) sessionStorage.removeItem('cubby_pending_child')
            else pushToast('Your enrolment draft is saved. Open Add child to finish.',{tone:'coral',duration:6000})
          }
          await syncQuantityAction({})
        } else if (stripe === 'cancel' || billing === 'cancel') {
          pushToast('Checkout was cancelled. Your saved records have not changed.',{emoji:'↩️',tone:'coral'})
        }
        params.delete('stripe');params.delete('billing');params.delete('session_id');params.delete('inv')
        window.history.replaceState(null,'','/app'+(params.toString()?'?'+params.toString():''))
      } catch (error) { setPaymentReturnError(error?.message || 'Could not confirm. Retry or contact the daycare before making another payment.') }
    })()
  }, [authResolving,isAuthenticated,viewer?.hasFacility,viewer?.id,paymentRetry])

  // After an owner/parent signs up, finish wiring them to a facility once auth
  // has fully propagated (calling these inline right after signIn races the
  // token and fails with "Sign in first").
  const pendingMembershipRef = useRef(null)
  useEffect(() => {
    if (!isAuthenticated || !viewer || viewer.accessStatus === 'suspended') return
    let pendingFacility = null; let token = null; let pendingEmail=null
    try {
      pendingFacility=sessionStorage.getItem('cubby_pending_facility')
      pendingEmail=sessionStorage.getItem('cubby_pending_facility_email')
      token=sessionStorage.getItem('cubby_pending_join') || (['join','slug'].includes(entryRef.current.kind) ? entryRef.current.token : null)
    } catch {}
    if(pendingFacility&&!token&&pendingEmail&&pendingEmail!==viewer.email?.trim().toLowerCase()){setMembershipError('This saved daycare setup belongs to a different email. Sign in with that email to resume.');return}
    const intent=token || (pendingFacility && !viewer.hasFacility && viewer.role==='admin' ? 'facility:'+pendingFacility : null)
    const key=intent?viewer.id+':'+intent:null
    if(pendingFacility&&viewer.hasFacility&&!token){try{sessionStorage.removeItem('cubby_pending_facility');sessionStorage.removeItem('cubby_pending_facility_email')}catch{}}
    if (!key || pendingMembershipRef.current===key) return
    pendingMembershipRef.current=key; setMembershipError(''); setJoiningFacility(true)
    const operation=token ? joinViaTokenMut({token}) : createFacilityMut({name:pendingFacility})
    operation.then(()=>{
      try {sessionStorage.removeItem(token?'cubby_pending_join':'cubby_pending_facility');if(!token)sessionStorage.removeItem('cubby_pending_facility_email')} catch {}
      entryRef.current={kind:'normal'};setView('home');window.history.replaceState(null,'','/app')
    }).catch(error=>setMembershipError(error?.message || 'Setup could not finish. Your details are saved. Retry or ask the daycare for help.'))
      .finally(()=>setJoiningFacility(false))
  },[isAuthenticated,viewer?.id,viewer?.hasFacility,viewer?.accessStatus,viewer?.role,membershipRetry])

  // --- Navigation ---
  const enterRole = useCallback((r) => {
    setDemoRole(r)
    setView('home')
  }, [])
  const logout = useCallback(async () => {
    if (isAuthenticated) await signOut()
    launchViewRef.current = 'home'; launchViewHandledRef.current = false
    pendingMembershipRef.current=null
    setMembershipError('');setJoiningFacility(false)
    setDemoRole(null)
    setView('home')
  }, [isAuthenticated, signOut])

  // --- Actions (same signatures the views already use) ---
  const addActivity = useCallback(
    (entry) => addActivityMut(entry),
    [addActivityMut],
  )
  const sendMessage = useCallback(
    (conversationId, text) => sendMut({ conversationId, text, time: nowTime(facility?.timezone) }),
    [sendMut,facility?.timezone],
  )
  const markConversationRead = useCallback(
    (conversationId) => markReadMut({ conversationId }),
    [markReadMut],
  )
  const payInvoice = useCallback((id) => payMut({ id, paidOn: todayLabel() }), [payMut])
  const toggleAttendance = useCallback((id) => toggleMut({ id, time: nowTime(facility?.timezone) }), [toggleMut,facility?.timezone])
  const setAttendance = useCallback((id, status) => setStatusMut({ id, status, time: nowTime(facility?.timezone) }), [setStatusMut,facility?.timezone])
  const likePhoto = useCallback((id) => likeMut({ id }), [likeMut])
  const clockEducator = useCallback((id, status) => clockMut({ id, status }), [clockMut])

  // --- Tenant / billing wrappers ---
  const createFacility = useCallback((name) => createFacilityMut({ name }), [createFacilityMut])
  const completeOnboarding = useCallback(async () => { await completeOnboardingMut({}); setView('home'); clearClaimArea(); window.history.replaceState(null, '', '/app') }, [completeOnboardingMut, clearClaimArea])
  const generateInvite = useCallback((role, label, childId, email, educatorId) => generateInviteMut({ role, label, childId, email, educatorId }), [generateInviteMut])
  const revokeInvite = useCallback((id) => revokeInviteMut({ id }), [revokeInviteMut])
  const joinFacility = useCallback(async (token) => { const result = await joinViaTokenMut({ token }); setView('home'); window.history.replaceState(null, '', '/app'); return result }, [joinViaTokenMut])
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

  // Register ownership server-side, resize photos for mobile, and never
  // accept an arbitrary storage ID as proof that the current user uploaded it.
  const uploadImage = useCallback(async (file,purpose='photo') => {
    const prepared = purpose==='bookkeeping' || purpose==='child-document' ? file : await prepareImage(file)
    if(prepared.size>8*1024*1024) throw new Error('Choose a file smaller than 8 MB.')
    const {storageId}=await uploadFileAction({base64:await fileToBase64(prepared),mimeType:prepared.type,purpose})
    return storageId
  },[uploadFileAction])
  const setMyAvatar = useCallback(async (file) => { const imageId = await uploadImage(file,'avatar'); await setMyAvatarMut({ imageId }) }, [uploadImage, setMyAvatarMut])
  const setChildPhoto = useCallback(async (id, file) => { const imageId = await uploadImage(file,'child-photo'); await setChildPhotoMut({ id, imageId }) }, [uploadImage, setChildPhotoMut])
  const setEducatorPhoto = useCallback(async (id, file) => { const imageId = await uploadImage(file,'avatar'); await setEducatorPhotoMut({ id, imageId }) }, [uploadImage, setEducatorPhotoMut])
  const postPhoto = useCallback(
    async ({ file, caption, audience, childId, childName, emoji, gradient, room }) => {
      const imageId = file ? await uploadImage(file) : undefined
      await addPhotoMut({ caption: caption || 'New moment', room: room || 'Unassigned', emoji, gradient, imageId, audience, childId, childName })
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
    displayPreferences,
    paymentReturnError, retryPaymentReturn, membershipError, retryMembership, joiningFacility,
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
    educatorsLoading: educatorsQ === undefined,
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
