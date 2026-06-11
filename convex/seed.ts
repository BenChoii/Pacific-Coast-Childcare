import { mutation } from './_generated/server'
import { v } from 'convex/values'
import { FREE_LIMIT } from './lib'

// Tenant-scoped collections. Reset clears orphan rows (pre-tenant migration)
// and the demo facility's rows, then reseeds the demo. Real tenants are left
// untouched. The `users`/auth tables are never wiped.
const DATA_TABLES = [
  'children', 'roster', 'activities', 'conversations', 'messages', 'invoices',
  'photos', 'educators', 'lessonPlans', 'lessonBlocks', 'resources', 'invites', 'payRuns', 'employeeProfiles',
]

// Idempotent seed — only populates when the demo facility doesn't exist yet.
// Run with: npx convex run seed:init
export const init = mutation({
  args: {},
  handler: async (ctx) => {
    const demo = await ctx.db.query('facilities').withIndex('by_slug', (q) => q.eq('slug', 'demo')).first()
    if (demo) return { seeded: false, reason: 'demo already exists' }
    await seedAll(ctx)
    return { seeded: true }
  },
})

// Wipe (orphans + demo) and re-seed the demo facility. Run: npx convex run seed:reset
export const reset = mutation({
  args: {},
  handler: async (ctx) => {
    const demos = await ctx.db.query('facilities').withIndex('by_slug', (q) => q.eq('slug', 'demo')).collect()
    const demoIds = new Set(demos.map((d) => d._id))
    for (const t of DATA_TABLES) {
      const docs = await ctx.db.query(t as any).collect()
      for (const d of docs as any[]) {
        if (d.facilityId === undefined || demoIds.has(d.facilityId)) await ctx.db.delete(d._id)
      }
    }
    for (const d of demos) await ctx.db.delete(d._id)
    await seedAll(ctx)
    return { reset: true }
  },
})

// Admin utility: fully delete a (non-demo) facility and all its scoped data.
// Used to clean up throwaway test facilities. Run: npx convex run seed:purgeFacilityBySlug '{"slug":"..."}' --prod
export const purgeFacilityBySlug = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    if (slug === 'demo') return { skipped: 'refusing to delete the demo facility' }
    const f = await ctx.db.query('facilities').withIndex('by_slug', (q) => q.eq('slug', slug)).first()
    if (!f) return { notFound: true }
    const fid = f._id
    for (const t of DATA_TABLES) {
      const docs = await ctx.db.query(t as any).collect()
      for (const d of docs as any[]) if (d.facilityId === fid) await ctx.db.delete(d._id)
    }
    if (f.ownerUserId) {
      const owner = await ctx.db.get(f.ownerUserId)
      if (owner) await ctx.db.patch(f.ownerUserId, { facilityId: undefined })
    }
    await ctx.db.delete(fid)
    return { purged: slug }
  },
})

// Admin utility: bring every real (non-demo) facility's free tier in line with
// the current FREE_LIMIT constant. Idempotent. Run after changing the free tier:
//   npx convex run seed:normalizeFreeLimits --prod
// The demo facility (freeLimit 999) is deliberately left untouched.
export const normalizeFreeLimits = mutation({
  args: {},
  handler: async (ctx) => {
    const facilities = await ctx.db.query('facilities').collect()
    let updated = 0
    for (const f of facilities) {
      if (f.isDemo) continue
      if (f.freeLimit !== FREE_LIMIT) {
        await ctx.db.patch(f._id, { freeLimit: FREE_LIMIT })
        updated++
      }
    }
    return { target: FREE_LIMIT, total: facilities.length, updated }
  },
})

async function seedAll(ctx: any) {
  // ── Demo facility (powers the public /app + /demo experience) ──
  const fid = await ctx.db.insert('facilities', {
    name: 'Pacific Coast Childcare Academy',
    slug: 'demo',
    plan: 'active',
    freeLimit: 999, // never paywall the demo
    hasCard: false,
    isDemo: true,
    onboardedAt: Date.now(),
    createdAt: Date.now(),
  })

  // Children
  const children = [
    { facilityId: fid, first: 'Mia', name: 'Mia Rivera', age: '4 yrs', room: 'Navigators', emoji: '🐬', color: 'from-brand-400 to-brand-600', parent: 'You', allergies: ['Peanuts'], status: 'checked-in', checkInTime: '8:42 AM', mood: 'Happy', napMinutes: 95, photosToday: 4, order: 0 },
    { facilityId: fid, first: 'Leo', name: 'Leo Rivera', age: '3 yrs', room: 'Explorers', emoji: '🐢', color: 'from-sky-400 to-brand-500', parent: 'You', allergies: [], status: 'checked-in', checkInTime: '8:44 AM', mood: 'Curious', napMinutes: 70, photosToday: 6, order: 1 },
  ]
  for (const c of children) await ctx.db.insert('children', c)

  // Roster
  const roster = [
    { name: 'Mia Rivera', emoji: '🐬', status: 'checked-in', time: '8:42 AM', mood: 'Happy' },
    { name: 'Noah Patel', emoji: '🦁', status: 'checked-in', time: '8:15 AM', mood: 'Calm' },
    { name: 'Ava Chen', emoji: '🦋', status: 'checked-in', time: '8:51 AM', mood: 'Playful' },
    { name: 'Liam Brooks', emoji: '🐝', status: 'napping', time: '8:30 AM', mood: 'Sleepy' },
    { name: 'Sofia Garcia', emoji: '🌸', status: 'checked-in', time: '9:02 AM', mood: 'Happy' },
    { name: 'Ethan Wright', emoji: '🚀', status: 'absent', time: '—', mood: '—' },
    { name: 'Zoe Kim', emoji: '🐙', status: 'checked-in', time: '8:38 AM', mood: 'Curious' },
    { name: 'Jack Moore', emoji: '🦊', status: 'checked-out', time: '12:10 PM', mood: 'Happy' },
  ]
  for (let i = 0; i < roster.length; i++) await ctx.db.insert('roster', { facilityId: fid, ...roster[i], order: i })

  // Activities (oldest→newest so newest sorts to the top of the feed)
  const activities = [
    { type: 'checkin', time: '8:42 AM', title: 'Checked in by Mom', detail: 'Dropped off with a big smile and her bunny.', by: 'Ms. Dana' },
    { type: 'activity', time: '9:10 AM', title: 'Morning circle time', detail: 'Little Leaders — Mia was today’s line leader!', by: 'Ms. Dana' },
    { type: 'meal', time: '9:30 AM', title: 'Morning snack', detail: 'Ate all of her apple slices & whole-grain crackers.', amount: 'Finished', by: 'Ms. Dana' },
    { type: 'learning', time: '10:05 AM', title: 'Global Citizens: Japan', detail: 'Learned to say “konnichiwa” and tried using chopsticks.', by: 'Mr. Theo' },
    { type: 'activity', time: '10:40 AM', title: 'Smart Minds STEM', detail: 'Explored floating & sinking at the water table.', by: 'Ms. Dana' },
    { type: 'photo', time: '11:15 AM', title: 'Outdoor play', detail: 'Loved the new climbing structure!', by: 'Mr. Theo' },
    { type: 'meal', time: '11:45 AM', title: 'Lunch', detail: 'Chicken, rice & steamed carrots.', amount: 'Most', by: 'Ms. Dana' },
    { type: 'nap', time: '12:30 PM', title: 'Quiet rest', detail: 'Rested calmly for 1h 35m.', amount: '1h 35m', by: 'Mr. Theo' },
  ]
  for (const a of activities) await ctx.db.insert('activities', { facilityId: fid, ...a })

  // Conversations + messages
  const dana = await ctx.db.insert('conversations', { facilityId: fid, name: 'Ms. Dana', role: 'Lead Educator · Navigators', emoji: '👩‍🏫', online: true, unread: 2, order: 0 })
  const theo = await ctx.db.insert('conversations', { facilityId: fid, name: 'Mr. Theo', role: 'Educator · Navigators', emoji: '👨‍🏫', online: false, unread: 0, order: 1 })
  const office = await ctx.db.insert('conversations', { facilityId: fid, name: 'Front Office', role: 'Pacific Coast Admin', emoji: '🏫', online: true, unread: 1, order: 2 })

  const messages = [
    { conversationId: dana, from: 'them', text: 'Good morning! Mia had a wonderful start today 🌟', time: '9:05 AM' },
    { conversationId: dana, from: 'them', text: 'She finished her whole snack and asked for more apples!', time: '9:32 AM' },
    { conversationId: dana, from: 'me', text: 'That’s amazing to hear 😊 Thank you Ms. Dana!', time: '9:40 AM' },
    { conversationId: dana, from: 'them', text: 'Of course! Quick note — for Japan day Friday, could you send a family photo for our wall?', time: '10:15 AM' },
    { conversationId: theo, from: 'them', text: 'Mia rested beautifully today — 1h 35m! 😴', time: '2:10 PM' },
    { conversationId: theo, from: 'me', text: 'Perfect, she was up early today. Thanks for the update!', time: '2:14 PM' },
    { conversationId: office, from: 'them', text: 'Reminder: Fall 2026 enrolment forms are due Friday. Tap Documents to e-sign 📝', time: '8:00 AM' },
  ]
  for (const m of messages) await ctx.db.insert('messages', { facilityId: fid, ...m })

  // Invoices
  const invoices = [
    { invId: 'inv-204', period: 'June 2026', amount: 1180, status: 'due', due: 'Jun 15, 2026', items: [{ label: 'Tuition — Mia (Full-time)', amt: 780 }, { label: 'Tuition — Leo (Part-time)', amt: 360 }, { label: 'Program materials', amt: 40 }], order: 0 },
    { invId: 'inv-198', period: 'May 2026', amount: 1180, status: 'paid', due: 'May 15, 2026', paidOn: 'May 12, 2026', order: 1 },
    { invId: 'inv-191', period: 'April 2026', amount: 1140, status: 'paid', due: 'Apr 15, 2026', paidOn: 'Apr 14, 2026', order: 2 },
    { invId: 'inv-184', period: 'March 2026', amount: 1140, status: 'paid', due: 'Mar 15, 2026', paidOn: 'Mar 13, 2026', order: 3 },
  ]
  for (const iv of invoices) await ctx.db.insert('invoices', { facilityId: fid, ...iv })

  // Photos — highest order shows first (desc)
  const photos = [
    { emoji: '🎨', caption: 'Finger painting masterpiece', room: 'Navigators', time: '10:42 AM', gradient: 'from-coral-400 to-blush-500', likes: 3 },
    { emoji: '🧩', caption: 'Puzzle champions', room: 'Navigators', time: '9:50 AM', gradient: 'from-brand-400 to-grape-500', likes: 5 },
    { emoji: '🌳', caption: 'Exploring the garden', room: 'Navigators', time: '11:18 AM', gradient: 'from-mint-400 to-brand-400', likes: 4 },
    { emoji: '🎎', caption: 'Japan day — Global Citizens', room: 'Navigators', time: '1:05 PM', gradient: 'from-blush-300 to-blush-500', likes: 2 },
    { emoji: '🥁', caption: 'Music & movement', room: 'Navigators', time: '2:10 PM', gradient: 'from-sunshine-400 to-coral-500', likes: 6 },
    { emoji: '🦋', caption: 'Butterfly garden visit', room: 'Navigators', time: '2:45 PM', gradient: 'from-sky-400 to-grape-500', likes: 7 },
  ]
  for (let i = 0; i < photos.length; i++) {
    await ctx.db.insert('photos', { facilityId: fid, ...photos[i], liked: false, order: photos.length - i })
  }

  // Educators with live clock-in state
  const now = Date.now()
  const educators = [
    { name: 'Dana Okafor', role: 'Lead Educator', room: 'Navigators', emoji: '👩‍🏫', hireDate: 'Aug 2021', certifications: ['ECE License', 'CPR & First Aid', 'Food Handler'], status: 'in', clockInAt: now - 25 * 60 * 1000, todaySeconds: 0, punches: [{ type: 'in', time: '7:30 AM' }], hoursWeek: 32, hoursTarget: 38, pto: '3 days' },
    { name: 'Theo Nguyen', role: 'Educator', room: 'Navigators', emoji: '👨‍🏫', hireDate: 'Jan 2023', certifications: ['ECE Assistant', 'CPR & First Aid'], status: 'in', clockInAt: now - 2.5 * 3600 * 1000, todaySeconds: 0, punches: [{ type: 'in', time: '8:00 AM' }], hoursWeek: 36, hoursTarget: 40, pto: '5 days' },
    { name: 'Priya Shah', role: 'Lead Educator', room: 'Tide Pools', emoji: '🧑‍🏫', hireDate: 'Mar 2020', certifications: ['ECE License', 'Infant Care', 'CPR & First Aid'], status: 'out', todaySeconds: 3.2 * 3600, punches: [{ type: 'in', time: '7:00 AM' }, { type: 'out', time: '10:12 AM' }], hoursWeek: 30, hoursTarget: 37, pto: '2 days' },
    { name: 'Marcus Lee', role: 'Lead Educator', room: 'Explorers', emoji: '👨‍🏫', hireDate: 'Sep 2022', certifications: ['ECE License', 'CPR & First Aid', 'Behaviour Support'], status: 'in', clockInAt: now - 1.75 * 3600 * 1000, todaySeconds: 0, punches: [{ type: 'in', time: '8:30 AM' }], hoursWeek: 38, hoursTarget: 40, pto: '7 days' },
    { name: 'Sofia Romano', role: 'Floater', room: 'All rooms', emoji: '🧑‍🏫', hireDate: 'Feb 2024', certifications: ['ECE Assistant', 'CPR & First Aid'], status: 'in', clockInAt: now - 50 * 60 * 1000, todaySeconds: 0, punches: [{ type: 'in', time: '9:00 AM' }], hoursWeek: 28, hoursTarget: 35, pto: '4 days' },
    { name: 'Grace Kim', role: 'Educator', room: 'Lighthouse', emoji: '👩‍🏫', hireDate: 'Jun 2023', certifications: ['ECE Assistant', 'CPR & First Aid'], status: 'out', todaySeconds: 0, punches: [], hoursWeek: 0, hoursTarget: 32, pto: '6 days' },
  ]
  for (let i = 0; i < educators.length; i++) {
    await ctx.db.insert('educators', { facilityId: fid, ...educators[i], order: i })
  }

  // Lesson plan (theme) + time-based, program-based blocks
  await ctx.db.insert('lessonPlans', { facilityId: fid, room: 'Navigators', week: 'Week of June 8', theme: 'Global Citizens · Japan 🎎' })

  const L = (day: string, time: string, title: string, detail: string, program: string, materials: string[] = [], objectives: string[] = []) => ({ day, time, title, detail, program, materials, objectives })
  const lessonBlocks = [
    L('Mon', '8:30 AM', 'Arrival & free play', 'Greet families, settle in, open centers.', 'Routine'),
    L('Mon', '9:00 AM', 'Morning circle', 'Greeting song, calendar, today’s helper.', 'Little Leaders', ['Circle mat', 'Calendar'], ['Turn-taking', 'Daily routine']),
    L('Mon', '9:30 AM', 'Morning snack', 'Wash hands, family-style snack.', 'Routine'),
    L('Mon', '10:00 AM', 'Hello, Japan!', 'Find Japan on the globe, learn the flag, practice “konnichiwa”.', 'Global Citizens', ['World map', 'Japan flag', 'Globe'], ['Geography awareness', 'New greeting', 'Respect for cultures']),
    L('Mon', '10:45 AM', 'Outdoor play', 'Gross-motor time in the yard.', 'Routine'),
    L('Mon', '11:45 AM', 'Lunch', 'Family-style lunch & conversation.', 'Routine'),
    L('Mon', '12:30 PM', 'Quiet rest', 'Rest / quiet activities.', 'Routine'),
    L('Mon', '2:15 PM', 'Story: Crane & the cherry tree', 'Read a Japanese folktale; discuss kindness.', 'Mindful Hearts', ['Picture book'], ['Listening', 'Empathy']),
    L('Tue', '9:00 AM', 'Morning circle', 'Weather, feelings check-in, helper of the day.', 'Mindful Hearts', ['Feelings chart'], ['Emotional vocabulary']),
    L('Tue', '10:00 AM', 'Chopstick practice', 'Use child-safe chopsticks to move pom-poms — fine motor + Japan culture.', 'Real Life Skills', ['Training chopsticks', 'Pom-poms', 'Bowls'], ['Fine-motor control', 'Independence', 'Persistence']),
    L('Tue', '10:45 AM', 'Origami folding', 'Fold a simple paper crane with step cards.', 'Smart Minds STEM', ['Origami paper', 'Step cards'], ['Following sequence', 'Spatial reasoning']),
    L('Tue', '11:45 AM', 'Lunch', 'Family-style lunch.', 'Routine'),
    L('Tue', '2:15 PM', 'Music: Japanese rhythms', 'Drum simple taiko rhythms together.', 'Global Citizens', ['Hand drums'], ['Rhythm', 'Group participation']),
    L('Wed', '9:00 AM', 'Morning circle', 'Calendar, song, today’s plan.', 'Little Leaders', ['Calendar'], ['Routine', 'Confidence']),
    L('Wed', '10:00 AM', 'Floating & sinking lab', 'Predict and test which objects float in the water table.', 'Smart Minds STEM', ['Water table', 'Assorted objects', 'Prediction chart'], ['Hypothesis & testing', 'Observation', 'Vocabulary: float/sink']),
    L('Wed', '10:45 AM', 'Build a paper boat', 'Design a boat and test how many “cargo” it holds.', 'Smart Minds STEM', ['Paper', 'Tape', 'Coins'], ['Engineering design', 'Cause & effect']),
    L('Wed', '11:45 AM', 'Lunch', 'Family-style lunch.', 'Routine'),
    L('Wed', '2:15 PM', 'Outdoor exploration', 'Nature walk & loose-parts play.', 'Routine'),
    L('Thu', '9:00 AM', 'Morning circle', 'Gratitude share — one thing we’re thankful for.', 'Mindful Hearts', [], ['Gratitude', 'Speaking in a group']),
    L('Thu', '10:00 AM', 'Cherry-blossom art', 'Create blossom trees with cotton-bud painting.', 'Global Citizens', ['Paint', 'Cotton buds', 'Paper'], ['Creative expression', 'Color mixing']),
    L('Thu', '10:45 AM', 'Calm corner & breathing', 'Practice “smell the flower, blow the candle” breathing.', 'Mindful Hearts', ['Breathing cards'], ['Self-regulation', 'Calm-down strategy']),
    L('Thu', '11:45 AM', 'Lunch', 'Family-style lunch.', 'Routine'),
    L('Thu', '2:15 PM', 'Free choice centers', 'Child-led play across learning centers.', 'Routine'),
    L('Fri', '9:00 AM', 'Morning circle', 'Review the week; preview Japan celebration.', 'Little Leaders', [], ['Recall', 'Confidence']),
    L('Fri', '10:00 AM', 'Japan celebration day', 'Kimono dress-up, family photo wall, taste-test rice balls.', 'Global Citizens', ['Dress-up clothes', 'Family photos', 'Rice balls'], ['Cultural appreciation', 'Sharing']),
    L('Fri', '10:45 AM', 'Show & tell', 'Each child shares their favorite moment of the week.', 'Little Leaders', [], ['Public speaking', 'Confidence', 'Listening']),
    L('Fri', '11:45 AM', 'Lunch', 'Family-style lunch.', 'Routine'),
    L('Fri', '2:15 PM', 'Reflection circle', 'What did we learn about Japan? Gratitude close-out.', 'Mindful Hearts', [], ['Reflection', 'Gratitude']),
  ]
  const dayCounter: Record<string, number> = {}
  for (const b of lessonBlocks) {
    const order = dayCounter[b.day] = (dayCounter[b.day] ?? -1) + 1
    await ctx.db.insert('lessonBlocks', { facilityId: fid, room: 'Navigators', ...b, order, status: 'planned', doneChildren: [] })
  }

  // Training & learning resources for educators
  const resources = [
    { title: 'Serve & Return: How brains are built', url: 'https://www.youtube.com/watch?v=KNrnZag17Ek', type: 'video', note: 'Harvard Center — the back-and-forth interactions that build young brains.', category: 'Child development' },
    { title: 'Supporting Dual-Language Learners', url: 'https://eclkc.ohs.acf.hhs.gov/culture-language', type: 'article', note: 'Practical strategies for multilingual classrooms.', category: 'Inclusion' },
    { title: 'Positive guidance & big feelings', url: 'https://www.youtube.com/watch?v=hY9wx5g6f3o', type: 'video', note: 'Calm, respectful techniques for redirection.', category: 'Behaviour' },
    { title: 'BC Early Learning Framework', url: 'https://www2.gov.bc.ca/gov/content/education-training/early-learning/teach/early-learning-framework', type: 'link', note: 'The provincial curriculum foundation we build on.', category: 'Curriculum' },
    { title: 'Sensory play that teaches', url: 'https://www.youtube.com/watch?v=2b6f8tj1n0w', type: 'video', note: 'Low-cost sensory bin ideas organized by age.', category: 'Activities' },
  ]
  for (let i = 0; i < resources.length; i++) await ctx.db.insert('resources', { facilityId: fid, ...resources[i], order: i })
}
