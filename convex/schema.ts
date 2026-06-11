import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { authTables } from '@convex-dev/auth/server'

// Cubby — multi-tenant childcare portal data model.
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
    slug: v.string(), // url segment: cubbycare.vercel.app/<slug>
    ownerUserId: v.optional(v.id('users')),
    plan: v.string(), // 'free' | 'active' | 'past_due' | 'canceled'
    freeLimit: v.number(), // children allowed before billing starts
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    hasCard: v.optional(v.boolean()), // card on file → can auto-bill
    onboardedAt: v.optional(v.number()), // null until owner finishes the wizard
    isDemo: v.optional(v.boolean()),
    payPeriod: v.optional(v.string()), // payroll: 'weekly' | 'biweekly' | 'semimonthly'
    createdAt: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_subscription', ['stripeSubscriptionId'])
    .index('by_customer', ['stripeCustomerId']),

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
    status: v.string(), // 'due' | 'paid'
    due: v.string(),
    paidOn: v.optional(v.string()),
    items: v.optional(v.array(v.object({ label: v.string(), amt: v.number() }))),
    order: v.number(),
  })
    .index('by_facility', ['facilityId', 'order'])
    .index('by_invId', ['invId']),

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
})
