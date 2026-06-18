import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { authTables } from '@convex-dev/auth/server'

// Mitten — multi-tenant childcare portal data model.
//
// Every facility (daycare) is a tenant. All user-facing collections carry a
// `facilityId` and are queried through a `by_facility` index, so one Convex
// deployment serves every daycare with their data fully isolated. A seeded
// `isDemo` facility (slug "demo") powers the public /app + /demo experience.
export default defineSchema({
  // ── Convex Auth tables, with role + facility membership on the user ──
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    imageId: v.optional(v.id('_storage')), // uploaded profile photo
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(v.string()), // 'parent' | 'staff' | 'admin'
    facilityId: v.optional(v.id('facilities')), // the daycare this user belongs to
  }).index('email', ['email']),

  // ── Tenants ──────────────────────────────────────────────────────────
  facilities: defineTable({
    name: v.string(),
    slug: v.string(), // url segment: mitten.care/<slug>
    ownerUserId: v.optional(v.id('users')),
    plan: v.string(), // 'free' | 'active' | 'past_due' | 'canceled'
    freeLimit: v.number(), // children allowed before billing starts
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    hasCard: v.optional(v.boolean()), // card on file → can auto-bill
    onboardedAt: v.optional(v.number()), // null until owner finishes the wizard
    isDemo: v.optional(v.boolean()),
    payPeriod: v.optional(v.string()), // payroll: 'weekly' | 'biweekly' | 'semimonthly'
    // ── Invoicing & payments business profile (set in Account → Invoicing) ──
    logoId: v.optional(v.id('_storage')), // daycare's own logo, shown on invoices
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    billingEmail: v.optional(v.string()),
    etransferEmail: v.optional(v.string()), // Interac e-Transfer deposit address; enables the e-transfer rail
    gstNumber: v.optional(v.string()),
    invoiceFooter: v.optional(v.string()), // free-text note printed on every invoice
    autoInvoice: v.optional(v.boolean()), // cron generates tuition invoices on the 1st
    stripeAccountId: v.optional(v.string()), // Stripe Connect (Express) — card payments land in THEIR account
    stripeAccountReady: v.optional(v.boolean()), // charges_enabled after Connect onboarding
    // ── Public business profile (shown on the mitten.care/childcare board, and
    //    a head-start on full app onboarding — set once, reused everywhere) ──
    programs: v.optional(v.array(v.object({
      name: v.string(), // e.g. "Infant/Toddler", "3–5 Preschool", "Before & After School"
      capacity: v.optional(v.number()), // how many children this program takes
      opensAt: v.optional(v.string()), // when it opens / next intake — free text e.g. "Sep 2026", "Rolling"
    }))),
    paymentMethods: v.optional(v.array(v.string())), // e.g. "e-Transfer", "Credit/debit card", "CCFRI/subsidy"
    about: v.optional(v.string()), // what their programs contain / what sets them apart
    agesServed: v.optional(v.string()), // e.g. "10 months – 5 years"
    website: v.optional(v.string()),
    // Paid add-ons unlocked for this facility. Demo facilities get them all so the
    // sales demo can show them off; real facilities unlock via the paid extra.
    addons: v.optional(v.object({
      crm: v.optional(v.boolean()),
      bookkeeping: v.optional(v.boolean()),
    })),
    createdAt: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_subscription', ['stripeSubscriptionId'])
    .index('by_customer', ['stripeCustomerId']),

  // Public childcare-directory listing a daycare sets for itself — powers the
  // live status overlay on the static /childcare/<area> boards. One per facility.
  directoryListings: defineTable({
    facilityId: v.id('facilities'),
    area: v.string(), // area slug, e.g. 'north-vancouver'
    name: v.string(), // public display name (defaults to facility name)
    status: v.string(), // 'accepting' | 'waitlist' | 'full' | 'unconfirmed'
    spots: v.optional(v.number()), // open spots when accepting
    visible: v.boolean(), // owner opted to show on the public board
    updatedAt: v.number(),
  })
    .index('by_facility', ['facilityId'])
    .index('by_area', ['area']),

  // Shareable join links for parents / staff (carry role + facility).
  invites: defineTable({
    facilityId: v.id('facilities'),
    role: v.string(), // 'parent' | 'staff' | 'admin'
    token: v.string(),
    label: v.optional(v.string()),
    email: v.optional(v.string()),
    childId: v.optional(v.id('children')), // parent invite tied to one child → auto-claims on join
    used: v.boolean(),
    createdAt: v.number(),
  })
    .index('by_token', ['token'])
    .index('by_facility', ['facilityId']),

  children: defineTable({
    facilityId: v.id('facilities'),
    first: v.string(),
    name: v.string(),
    age: v.string(),
    room: v.string(),
    emoji: v.string(),
    color: v.string(),
    parent: v.string(),
    parentUserId: v.optional(v.id('users')),
    imageId: v.optional(v.id('_storage')), // uploaded child profile photo
    monthlyTuition: v.optional(v.number()), // what the daycare charges this family / month
    allergies: v.array(v.string()),
    status: v.string(),
    checkInTime: v.string(),
    mood: v.string(),
    napMinutes: v.number(),
    photosToday: v.number(),
    order: v.number(),
  }).index('by_facility', ['facilityId', 'order']),

  activities: defineTable({
    facilityId: v.id('facilities'),
    childName: v.optional(v.string()),
    type: v.string(),
    time: v.string(),
    title: v.string(),
    detail: v.string(),
    amount: v.optional(v.string()),
    by: v.string(),
  }).index('by_facility', ['facilityId']),

  roster: defineTable({
    facilityId: v.id('facilities'),
    name: v.string(),
    emoji: v.string(),
    status: v.string(),
    time: v.string(),
    mood: v.string(),
    order: v.number(),
  }).index('by_facility', ['facilityId', 'order']),

  conversations: defineTable({
    facilityId: v.id('facilities'),
    name: v.string(),
    role: v.string(),
    emoji: v.string(),
    online: v.boolean(),
    unread: v.number(),
    order: v.number(),
    parentUserId: v.optional(v.id('users')), // the family this thread belongs to
  }).index('by_facility', ['facilityId', 'order']),

  messages: defineTable({
    facilityId: v.optional(v.id('facilities')),
    conversationId: v.id('conversations'),
    from: v.string(), // legacy demo: 'me' | 'them'
    authorId: v.optional(v.id('users')), // real sender (multi-user threads)
    authorName: v.optional(v.string()),
    authorRole: v.optional(v.string()),
    text: v.string(),
    time: v.string(),
  }).index('by_conversation', ['conversationId']),

  invoices: defineTable({
    facilityId: v.id('facilities'),
    invId: v.string(),
    period: v.string(),
    amount: v.number(),
    status: v.string(), // 'due' | 'processing' (e-transfer sent, awaiting confirm) | 'paid' | 'void'
    due: v.string(),
    paidOn: v.optional(v.string()),
    items: v.optional(v.array(v.object({ label: v.string(), amt: v.number() }))),
    order: v.number(),
    // ── Real-facility invoicing (demo seed rows leave these unset) ──
    parentUserId: v.optional(v.id('users')), // bill-to family; parents only see their own
    billTo: v.optional(v.string()), // display name for the family on the document
    childName: v.optional(v.string()),
    method: v.optional(v.string()), // how it was (or is being) paid: 'card' | 'etransfer' | 'manual'
    etransferRef: v.optional(v.string()), // reference the parent supplies after sending
    stripeSessionId: v.optional(v.string()), // Checkout session (on the connected account if any)
    stripeAccountId: v.optional(v.string()), // connected account the session was created on
    notes: v.optional(v.string()),
  })
    .index('by_facility', ['facilityId', 'order'])
    .index('by_invId', ['invId'])
    .index('by_parent', ['facilityId', 'parentUserId']),

  // Government childcare-subsidy tracking, per child. CCFRI (provider fee
  // reduction, not income-tested), ACCB (income-tested, family applies + renews
  // yearly), CWELCC ($10/day cap). Approved records with a monthlyAmount net
  // off the family's invoices automatically as a transparent reduction line.
  subsidies: defineTable({
    facilityId: v.id('facilities'),
    childId: v.id('children'),
    type: v.string(), // 'ccfri' | 'accb' | 'cwelcc' | 'other'
    status: v.string(), // 'tracking' | 'applied' | 'approved' | 'expired'
    monthlyAmount: v.optional(v.number()), // $/month reduction (applied to invoices when approved)
    startDate: v.optional(v.string()),
    expiryDate: v.optional(v.string()), // ACCB renews yearly → drives renewal reminders
    reference: v.optional(v.string()), // government file / confirmation number
    notes: v.optional(v.string()),
    applyToInvoices: v.optional(v.boolean()), // net this off invoices (default true once approved + amount)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_facility', ['facilityId'])
    .index('by_child', ['childId']),

  photos: defineTable({
    facilityId: v.id('facilities'),
    emoji: v.string(),
    caption: v.string(),
    room: v.string(),
    time: v.string(),
    gradient: v.string(),
    likes: v.number(),
    liked: v.optional(v.boolean()),
    order: v.number(),
    imageId: v.optional(v.id('_storage')), // real uploaded photo (else emoji placeholder)
    audience: v.optional(v.string()), // 'all' (whole class) | 'family' (one child's parents)
    childId: v.optional(v.id('children')), // when audience === 'family'
    childName: v.optional(v.string()),
  }).index('by_facility', ['facilityId', 'order']),

  // Lesson plan meta (theme/week) — one per facility room.
  lessonPlans: defineTable({
    facilityId: v.id('facilities'),
    room: v.string(),
    week: v.string(),
    theme: v.string(),
  }).index('by_facility', ['facilityId']),

  // Time-based, child-based curriculum blocks the director authors and educators run.
  lessonBlocks: defineTable({
    facilityId: v.id('facilities'),
    room: v.string(),
    day: v.string(), // 'Mon' .. 'Fri'
    time: v.string(),
    order: v.number(),
    title: v.string(),
    detail: v.string(),
    program: v.string(), // a signature program or 'Routine'
    materials: v.array(v.string()),
    objectives: v.array(v.string()),
    status: v.string(), // 'planned' | 'active' | 'done'
    doneChildren: v.array(v.string()),
  }).index('by_facility', ['facilityId']),

  // Developmental milestones educators tag per child → parents' Memory Book.
  milestones: defineTable({
    facilityId: v.id('facilities'),
    childId: v.id('children'),
    childName: v.string(),
    domain: v.string(), // Motor | Language | Social | Cognitive | Self-help
    label: v.string(),
    status: v.string(), // Emerging | Progressing | Mastered
    note: v.optional(v.string()),
    date: v.string(),
    by: v.string(),
    createdAt: v.number(),
  })
    .index('by_facility', ['facilityId'])
    .index('by_child', ['childId']),

  // Ongoing training & learning materials directors share with all educators.
  resources: defineTable({
    facilityId: v.id('facilities'),
    title: v.string(),
    url: v.string(),
    type: v.string(), // 'video' | 'article' | 'link'
    note: v.string(),
    category: v.string(),
    order: v.number(),
  }).index('by_facility', ['facilityId', 'order']),

  // Educators with live time-tracking (clock in/out) the director can see.
  educators: defineTable({
    facilityId: v.id('facilities'),
    userId: v.optional(v.id('users')), // links an invited educator's login to their staff record
    name: v.string(),
    role: v.string(),
    room: v.string(),
    emoji: v.string(),
    hireDate: v.string(),
    certifications: v.array(v.string()),
    status: v.string(), // 'in' | 'out'
    clockInAt: v.optional(v.number()), // ms epoch of current session start
    todaySeconds: v.number(), // accumulated seconds today before current session
    punches: v.array(v.object({ type: v.string(), time: v.string() })),
    hoursWeek: v.number(),
    hoursTarget: v.number(),
    pto: v.string(),
    order: v.number(),
    // Payroll pay setup (optional until the owner configures it)
    payType: v.optional(v.string()), // 'hourly' | 'salary'
    payRate: v.optional(v.number()), // $/hr if hourly, annual $ if salary
    vacationPct: v.optional(v.number()), // BC vacation pay %: 4 (<5yrs) or 6 (5yrs+)
  }).index('by_facility', ['facilityId', 'order']),

  // Self-serve employee onboarding. The employer generates a token link; the new
  // hire fills personal info, banking + SIN, and uploads documents. SIN + bank
  // numbers are stored ONLY as application-layer-encrypted blobs (AES-GCM, key in
  // the ONBOARDING_ENC_KEY env var) plus a masked tail for display; raw values are
  // returned solely to an authenticated admin via the reveal action.
  employeeProfiles: defineTable({
    facilityId: v.id('facilities'),
    token: v.string(),
    status: v.string(), // 'pending' | 'submitted'
    educatorId: v.optional(v.id('educators')), // created/linked on submit
    inviteName: v.string(), // what the employer typed when generating the link
    inviteRole: v.string(),
    createdAt: v.number(),
    // employee-submitted, non-sensitive (admin-only access, stored plainly)
    fullName: v.optional(v.string()),
    preferredName: v.optional(v.string()),
    dob: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    personalEmail: v.optional(v.string()),
    emergencyName: v.optional(v.string()),
    emergencyPhone: v.optional(v.string()),
    startDate: v.optional(v.string()),
    // sensitive — encrypted blobs + masked tails only
    sinEnc: v.optional(v.string()),
    sinLast3: v.optional(v.string()),
    bankEnc: v.optional(v.string()), // encrypted JSON {institution,transit,account}
    bankLast4: v.optional(v.string()),
    // uploaded documents (void cheque, ID, work permit, signed forms…)
    documents: v.optional(
      v.array(v.object({ name: v.string(), kind: v.string(), storageId: v.id('_storage') })),
    ),
    consentAt: v.optional(v.number()),
    submittedAt: v.optional(v.number()),
  })
    .index('by_facility', ['facilityId', 'createdAt'])
    .index('by_token', ['token']),

  // ── Extras: what a daycare chooses to charge beyond base tuition ──────────
  // The catalog: per-occurrence charges (late pickup, early drop-off, ad-hoc
  // early pickup…) and monthly add-on plans (extended hours, hot lunch…).
  extraServices: defineTable({
    facilityId: v.id('facilities'),
    name: v.string(),
    emoji: v.string(),
    kind: v.string(), // 'incident' (charged when it happens) | 'plan' (monthly add-on)
    pricing: v.string(), // incident: 'flat' | 'per15' — plan: always 'monthly'
    amount: v.number(), // $ flat / $ per 15 min / $ per month
    active: v.boolean(),
    createdAt: v.number(),
  }).index('by_facility', ['facilityId']),

  // Logged incident charges — the "don't let it slip through the cracks" record.
  extraCharges: defineTable({
    facilityId: v.id('facilities'),
    serviceId: v.id('extraServices'),
    serviceName: v.string(),
    emoji: v.string(),
    childId: v.optional(v.id('children')),
    childName: v.string(),
    minutes: v.optional(v.number()), // for per-15-min pricing
    amount: v.number(),
    note: v.optional(v.string()),
    by: v.string(), // educator/director who logged it
    status: v.string(), // 'unbilled' | 'billed' | 'waived'
    createdAt: v.number(),
  }).index('by_facility', ['facilityId', 'createdAt']),

  // A child's active monthly add-on plans (sold on top of base tuition).
  planSubscriptions: defineTable({
    facilityId: v.id('facilities'),
    serviceId: v.id('extraServices'),
    serviceName: v.string(),
    emoji: v.string(),
    childId: v.id('children'),
    childName: v.string(),
    monthlyAmount: v.number(),
    active: v.boolean(),
    startedAt: v.number(),
  }).index('by_facility', ['facilityId']),

  // Saved payroll runs (gross-pay prep only — no tax/remittance, no money movement).
  payRuns: defineTable({
    facilityId: v.id('facilities'),
    periodStart: v.string(), // 'YYYY-MM-DD'
    periodEnd: v.string(),
    payPeriod: v.string(),
    createdAt: v.number(),
    createdByName: v.string(),
    note: v.optional(v.string()),
    totalGross: v.number(),
    totalVacation: v.number(),
    headcount: v.number(),
    lines: v.array(
      v.object({
        educatorId: v.optional(v.id('educators')),
        name: v.string(),
        role: v.string(),
        payType: v.string(),
        rate: v.number(),
        regularHours: v.number(),
        otHours: v.number(),
        statPay: v.number(),
        gross: v.number(),
        vacationPct: v.number(),
        vacationAccrued: v.number(),
      }),
    ),
  }).index('by_facility', ['facilityId', 'createdAt']),

  // ── CRM / inquiries (paid add-on) ──────────────────────────────────────────
  // A lead from the daycare's own website (book-a-tour / contact form), the public
  // directory, or added by hand. Directors work these on the Inquiries board.
  inquiries: defineTable({
    facilityId: v.id('facilities'),
    source: v.string(), // 'book-tour' | 'contact-form' | 'directory' | 'manual'
    reason: v.optional(v.string()), // 'tour' | 'package' | 'waitlist' | 'birthday' | 'faq'
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    childAge: v.optional(v.string()),
    preferredSlot: v.optional(v.string()),
    message: v.optional(v.string()),
    status: v.string(), // 'new' | 'contacted' | 'toured' | 'enrolled' | 'lost'
    followUpAt: v.optional(v.number()),
    notes: v.optional(v.array(v.object({ at: v.number(), text: v.string(), by: v.optional(v.string()) }))),
    convertedChildId: v.optional(v.id('children')),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_facility', ['facilityId', 'status'])
    .index('by_facility_created', ['facilityId', 'createdAt']),

  // ── Bookkeeping (paid add-on) ──────────────────────────────────────────────
  // An uploaded receipt/invoice the director files for tax. Manual entry first;
  // AI extraction (vendor/amount/GST/category) fills these in later.
  bookkeepingDocs: defineTable({
    facilityId: v.id('facilities'),
    storageId: v.optional(v.id('_storage')), // the uploaded file
    fileName: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    kind: v.string(), // 'receipt' | 'invoice' | 'statement' | 'other'
    direction: v.optional(v.string()), // 'expense' | 'income'
    vendor: v.optional(v.string()),
    docDate: v.optional(v.string()), // 'YYYY-MM-DD'
    amount: v.optional(v.number()), // total incl. tax
    taxAmount: v.optional(v.number()), // GST/HST portion
    category: v.optional(v.string()), // CRA-style expense category
    status: v.string(), // 'unreviewed' | 'filed'
    notes: v.optional(v.string()),
    aiExtracted: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_facility', ['facilityId', 'status'])
    .index('by_facility_date', ['facilityId', 'docDate']),
})
