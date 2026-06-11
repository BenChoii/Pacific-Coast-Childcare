// Centralized mock data for the Pacific Coast Childcare Academy portal.
// Everything the three role dashboards render comes from here.

export const center = {
  name: 'Pacific Coast Childcare Academy',
  short: 'Pacific Coast',
  tagline: 'A world of learning, closer to home',
  address: 'Vancouver, BC',
  phone: '(604) 014-2200',
  ages: 'Ages 2.5 – 5',
  license: 'BC-CCL-558210',
  enrolling: 'Now enrolling · Fall 2026',
}

// The academy's five signature programs (from the website)
export const programs = [
  { id: 'p1', name: 'Little Leaders', tag: 'Confidence & voice', emoji: '🌟', color: 'from-brand-400 to-brand-600' },
  { id: 'p2', name: 'Global Citizens', tag: 'A new country each month', emoji: '🌍', color: 'from-sky-400 to-brand-500' },
  { id: 'p3', name: 'Real Life Skills', tag: 'Everyday independence', emoji: '🧺', color: 'from-mint-400 to-mint-500' },
  { id: 'p4', name: 'Smart Minds STEM', tag: 'Weekly hands-on science', emoji: '🔬', color: 'from-sunshine-400 to-coral-500' },
  { id: 'p5', name: 'Mindful Hearts', tag: 'Social-emotional learning', emoji: '💛', color: 'from-blush-300 to-blush-500' },
]

// Coastal age-group "rooms"
export const ROOM_COLORS = {
  'Tide Pools': { bg: 'bg-sky-100', text: 'text-brand-600', dot: 'bg-sky-400' },
  Explorers: { bg: 'bg-blush-100', text: 'text-blush-600', dot: 'bg-blush-400' },
  Navigators: { bg: 'bg-brand-100', text: 'text-brand-700', dot: 'bg-brand-500' },
  Lighthouse: { bg: 'bg-sunshine-400/20', text: 'text-amber-600', dot: 'bg-sunshine-500' },
}

export const children = [
  {
    id: 'c1',
    name: 'Mia Rivera',
    first: 'Mia',
    age: '4 yrs',
    room: 'Navigators',
    emoji: '🐬',
    color: 'from-brand-400 to-brand-600',
    parent: 'You',
    allergies: ['Peanuts'],
    status: 'checked-in',
    checkInTime: '8:42 AM',
    mood: 'Happy',
    napMinutes: 95,
    bottlesOz: 0,
    diapers: 0,
    photosToday: 4,
  },
  {
    id: 'c2',
    name: 'Leo Rivera',
    first: 'Leo',
    age: '3 yrs',
    room: 'Explorers',
    emoji: '🐢',
    color: 'from-sky-400 to-brand-500',
    parent: 'You',
    allergies: [],
    status: 'checked-in',
    checkInTime: '8:44 AM',
    mood: 'Curious',
    napMinutes: 70,
    bottlesOz: 0,
    diapers: 0,
    photosToday: 6,
  },
]

// Roster the caregiver sees (their room)
export const roster = [
  { id: 'r1', name: 'Mia Rivera', emoji: '🐬', status: 'checked-in', time: '8:42 AM', mood: 'Happy' },
  { id: 'r2', name: 'Noah Patel', emoji: '🦁', status: 'checked-in', time: '8:15 AM', mood: 'Calm' },
  { id: 'r3', name: 'Ava Chen', emoji: '🦋', status: 'checked-in', time: '8:51 AM', mood: 'Playful' },
  { id: 'r4', name: 'Liam Brooks', emoji: '🐝', status: 'napping', time: '8:30 AM', mood: 'Sleepy' },
  { id: 'r5', name: 'Sofia Garcia', emoji: '🌸', status: 'checked-in', time: '9:02 AM', mood: 'Happy' },
  { id: 'r6', name: 'Ethan Wright', emoji: '🚀', status: 'absent', time: '—', mood: '—' },
  { id: 'r7', name: 'Zoe Kim', emoji: '🐙', status: 'checked-in', time: '8:38 AM', mood: 'Curious' },
  { id: 'r8', name: 'Jack Moore', emoji: '🦊', status: 'checked-out', time: '12:10 PM', mood: 'Happy' },
]

export const ACTIVITY_TYPES = {
  meal: { label: 'Meal', emoji: '🍎', color: 'bg-coral-500', soft: 'bg-coral-400/15 text-coral-600' },
  nap: { label: 'Rest', emoji: '😴', color: 'bg-grape-500', soft: 'bg-grape-400/15 text-grape-600' },
  diaper: { label: 'Care', emoji: '🧷', color: 'bg-sky-500', soft: 'bg-sky-100 text-brand-600' },
  activity: { label: 'Activity', emoji: '🎨', color: 'bg-sunshine-500', soft: 'bg-sunshine-400/20 text-amber-600' },
  learning: { label: 'Learning', emoji: '📚', color: 'bg-mint-500', soft: 'bg-mint-400/20 text-mint-500' },
  photo: { label: 'Photo', emoji: '📸', color: 'bg-blush-500', soft: 'bg-blush-100 text-blush-600' },
  note: { label: 'Note', emoji: '💬', color: 'bg-slate-500', soft: 'bg-slate-100 text-slate-600' },
  checkin: { label: 'Check-in', emoji: '✅', color: 'bg-mint-500', soft: 'bg-mint-400/20 text-mint-500' },
}

// Daily timeline for the parent view (child = Mia)
export const timeline = [
  { id: 't1', type: 'checkin', time: '8:42 AM', title: 'Checked in by Mom', detail: 'Dropped off with a big smile and her bunny.', by: 'Ms. Dana' },
  { id: 't2', type: 'activity', time: '9:10 AM', title: 'Morning circle time', detail: 'Little Leaders — Mia was today’s line leader!', by: 'Ms. Dana' },
  { id: 't3', type: 'meal', time: '9:30 AM', title: 'Morning snack', detail: 'Ate all of her apple slices & whole-grain crackers.', amount: 'Finished', by: 'Ms. Dana' },
  { id: 't4', type: 'learning', time: '10:05 AM', title: 'Global Citizens: Japan', detail: 'Learned to say “konnichiwa” and tried using chopsticks.', by: 'Mr. Theo' },
  { id: 't5', type: 'activity', time: '10:40 AM', title: 'Smart Minds STEM', detail: 'Explored floating & sinking at the water table.', by: 'Ms. Dana' },
  { id: 't6', type: 'photo', time: '11:15 AM', title: 'Outdoor play', detail: 'Loved the new climbing structure!', by: 'Mr. Theo' },
  { id: 't7', type: 'meal', time: '11:45 AM', title: 'Lunch', detail: 'Chicken, rice & steamed carrots.', amount: 'Most', by: 'Ms. Dana' },
  { id: 't8', type: 'nap', time: '12:30 PM', title: 'Quiet rest', detail: 'Rested calmly for 1h 35m.', amount: '1h 35m', by: 'Mr. Theo' },
]

export const photos = [
  { id: 'p1', emoji: '🎨', caption: 'Finger painting masterpiece', room: 'Navigators', time: '10:42 AM', gradient: 'from-coral-400 to-blush-500', likes: 3 },
  { id: 'p2', emoji: '🧩', caption: 'Puzzle champions', room: 'Navigators', time: '9:50 AM', gradient: 'from-brand-400 to-grape-500', likes: 5 },
  { id: 'p3', emoji: '🌳', caption: 'Exploring the garden', room: 'Navigators', time: '11:18 AM', gradient: 'from-mint-400 to-brand-400', likes: 4 },
  { id: 'p4', emoji: '🎎', caption: 'Japan day — Global Citizens', room: 'Navigators', time: '1:05 PM', gradient: 'from-blush-300 to-blush-500', likes: 2 },
  { id: 'p5', emoji: '🥁', caption: 'Music & movement', room: 'Navigators', time: '2:10 PM', gradient: 'from-sunshine-400 to-coral-500', likes: 6 },
  { id: 'p6', emoji: '🦋', caption: 'Butterfly garden visit', room: 'Navigators', time: '2:45 PM', gradient: 'from-sky-400 to-grape-500', likes: 7 },
]

export const conversations = [
  {
    id: 'cv1',
    name: 'Ms. Dana',
    role: 'Lead Educator · Navigators',
    emoji: '👩‍🏫',
    online: true,
    unread: 2,
    messages: [
      { id: 'm1', from: 'them', text: 'Good morning! Mia had a wonderful start today 🌟', time: '9:05 AM' },
      { id: 'm2', from: 'them', text: 'She finished her whole snack and asked for more apples!', time: '9:32 AM' },
      { id: 'm3', from: 'me', text: 'That’s amazing to hear 😊 Thank you Ms. Dana!', time: '9:40 AM' },
      { id: 'm4', from: 'them', text: 'Of course! Quick note — for Japan day Friday, could you send a family photo for our wall?', time: '10:15 AM' },
    ],
  },
  {
    id: 'cv2',
    name: 'Mr. Theo',
    role: 'Educator · Navigators',
    emoji: '👨‍🏫',
    online: false,
    unread: 0,
    messages: [
      { id: 'm5', from: 'them', text: 'Mia rested beautifully today — 1h 35m! 😴', time: '2:10 PM' },
      { id: 'm6', from: 'me', text: 'Perfect, she was up early today. Thanks for the update!', time: '2:14 PM' },
    ],
  },
  {
    id: 'cv3',
    name: 'Front Office',
    role: 'Pacific Coast Admin',
    emoji: '🏫',
    online: true,
    unread: 1,
    messages: [
      { id: 'm7', from: 'them', text: 'Reminder: Fall 2026 enrolment forms are due Friday. Tap Documents to e-sign 📝', time: '8:00 AM' },
    ],
  },
]

export const invoices = [
  { id: 'inv-204', period: 'June 2026', amount: 1180, status: 'due', due: 'Jun 15, 2026', items: [{ label: 'Tuition — Mia (Full-time)', amt: 780 }, { label: 'Tuition — Leo (Part-time)', amt: 360 }, { label: 'Program materials', amt: 40 }] },
  { id: 'inv-198', period: 'May 2026', amount: 1180, status: 'paid', due: 'May 15, 2026', paidOn: 'May 12, 2026' },
  { id: 'inv-191', period: 'April 2026', amount: 1140, status: 'paid', due: 'Apr 15, 2026', paidOn: 'Apr 14, 2026' },
  { id: 'inv-184', period: 'March 2026', amount: 1140, status: 'paid', due: 'Mar 15, 2026', paidOn: 'Mar 13, 2026' },
]

export const calendarEvents = [
  { id: 'e1', date: 'Jun 10', day: 'Wed', title: 'Global Citizens: Japan Day 🎎', tag: 'Programs', color: 'bg-sky-100 text-brand-700', emoji: '🎎' },
  { id: 'e2', date: 'Jun 13', day: 'Sat', title: 'Family Picnic — Stanley Park', tag: 'Family', color: 'bg-mint-400/20 text-mint-500', emoji: '🧺' },
  { id: 'e3', date: 'Jun 15', day: 'Mon', title: 'June tuition due', tag: 'Billing', color: 'bg-brand-100 text-brand-700', emoji: '💳' },
  { id: 'e4', date: 'Jun 19', day: 'Fri', title: 'Smart Minds STEM: Volcano Lab', tag: 'Programs', color: 'bg-sunshine-400/20 text-amber-600', emoji: '🌋' },
  { id: 'e5', date: 'Jun 24', day: 'Wed', title: 'Mindful Hearts: Gratitude Circle', tag: 'Wellbeing', color: 'bg-blush-100 text-blush-600', emoji: '💛' },
]

export const lessonPlan = {
  theme: 'Global Citizens · Japan 🎎',
  week: 'Week of June 8',
  days: [
    { day: 'Mon', focus: 'Hello, Japan!', activities: ['Map & flag exploration', 'Say “konnichiwa”', 'Story: Crane & the cherry tree'] },
    { day: 'Tue', focus: 'Tastes & traditions', activities: ['Chopstick practice (Real Life Skills)', 'Rice ball craft', 'Origami folding'] },
    { day: 'Wed', focus: 'Smart Minds STEM', activities: ['Floating & sinking water lab', 'Build a paper boat', 'Predict & test'] },
    { day: 'Thu', focus: 'Music & movement', activities: ['Taiko drum rhythms', 'Cherry-blossom dance', 'Mindful Hearts breathing'] },
    { day: 'Fri', focus: 'Japan celebration day', activities: ['Family photo wall', 'Kimono dress-up', 'Little Leaders show & tell'] },
  ],
}

// ---- Admin data ----
export const enrollmentPipeline = [
  { stage: 'Inquiry', color: 'bg-slate-400', count: 14, leads: ['Olivia M. (Tide Pools)', 'Mateo R. (Explorers)', 'Aria S. (Navigators)'] },
  { stage: 'Tour Booked', color: 'bg-brand-500', count: 8, leads: ['Hudson P. (Explorers)', 'Lily W. (Navigators)'] },
  { stage: 'Application', color: 'bg-grape-500', count: 5, leads: ['Ezra T. (Tide Pools)', 'Maya K. (Navigators)'] },
  { stage: 'Enrolled', color: 'bg-mint-500', count: 6, leads: ['Mia R. ✓', 'Leo R. ✓', 'Zoe K. ✓'] },
]

export const staffSchedule = [
  { id: 's1', name: 'Dana Okafor', role: 'Lead Educator', room: 'Navigators', emoji: '👩‍🏫', shift: '7:30a – 4:00p', status: 'On floor', hours: 38 },
  { id: 's2', name: 'Theo Nguyen', role: 'Educator', room: 'Navigators', emoji: '👨‍🏫', shift: '8:00a – 5:00p', status: 'On floor', hours: 40 },
  { id: 's3', name: 'Priya Shah', role: 'Lead Educator', room: 'Tide Pools', emoji: '🧑‍🏫', shift: '7:00a – 3:30p', status: 'Break', hours: 37 },
  { id: 's4', name: 'Marcus Lee', role: 'Lead Educator', room: 'Explorers', emoji: '👨‍🏫', shift: '8:30a – 5:30p', status: 'On floor', hours: 40 },
  { id: 's5', name: 'Sofia Romano', role: 'Floater', room: 'All rooms', emoji: '🧑‍🏫', shift: '9:00a – 6:00p', status: 'On floor', hours: 35 },
  { id: 's6', name: 'Grace Kim', role: 'Educator', room: 'Lighthouse', emoji: '👩‍🏫', shift: 'Off today', status: 'Off', hours: 0 },
]

export const rooms = [
  { name: 'Tide Pools', age: 'Ages 2.5–3', enrolled: 8, capacity: 10, ratio: '1:4', staff: 2 },
  { name: 'Explorers', age: 'Ages 3–4', enrolled: 12, capacity: 12, ratio: '1:6', staff: 2 },
  { name: 'Navigators', age: 'Ages 4–5', enrolled: 18, capacity: 20, ratio: '1:8', staff: 2 },
  { name: 'Lighthouse', age: 'Pre-K', enrolled: 15, capacity: 18, ratio: '1:10', staff: 2 },
]

// Charts
export const attendanceTrend = [
  { day: 'Mon', present: 48, capacity: 60 },
  { day: 'Tue', present: 52, capacity: 60 },
  { day: 'Wed', present: 55, capacity: 60 },
  { day: 'Thu', present: 50, capacity: 60 },
  { day: 'Fri', present: 44, capacity: 60 },
]

export const revenueTrend = [
  { month: 'Jan', revenue: 58 },
  { month: 'Feb', revenue: 61 },
  { month: 'Mar', revenue: 63 },
  { month: 'Apr', revenue: 66 },
  { month: 'May', revenue: 69 },
  { month: 'Jun', revenue: 72 },
]

export const enrollmentByRoom = [
  { name: 'Tide Pools', value: 8, color: '#9CC0D6' },
  { name: 'Explorers', value: 12, color: '#E5A3AD' },
  { name: 'Navigators', value: 18, color: '#0E74C1' },
  { name: 'Lighthouse', value: 15, color: '#DBB35A' },
]

export const billingSummary = {
  collected: 64200,
  outstanding: 8740,
  overdue: 2120,
  autopayRate: 78,
}

// ---- Profitability / financial analytics (director) ----
export const financials = {
  kpis: {
    revenue: 72100, // this month
    cost: 49800,
    profit: 22300,
    marginPct: 31,
    revPerChild: 1325,
    costPerChild: 915,
    occupancyPct: 86,
    ytdProfit: 121400,
  },
  // $000s per month
  monthly: [
    { month: 'Jan', revenue: 58.0, cost: 43.1, profit: 14.9 },
    { month: 'Feb', revenue: 61.0, cost: 44.6, profit: 16.4 },
    { month: 'Mar', revenue: 63.0, cost: 45.2, profit: 17.8 },
    { month: 'Apr', revenue: 66.0, cost: 46.8, profit: 19.2 },
    { month: 'May', revenue: 69.0, cost: 48.1, profit: 20.9 },
    { month: 'Jun', revenue: 72.1, cost: 49.8, profit: 22.3 },
  ],
  // monthly $000s per program
  perProgram: [
    { program: 'Tide Pools', children: 8, revenue: 11.2, cost: 8.6, color: '#9CC0D6' },
    { program: 'Explorers', children: 12, revenue: 15.6, cost: 10.9, color: '#E5A3AD' },
    { program: 'Navigators', children: 18, revenue: 23.0, cost: 15.4, color: '#0E74C1' },
    { program: 'Lighthouse', children: 15, revenue: 22.3, cost: 14.9, color: '#DBB35A' },
  ],
  // per-enrolment monthly economics ($)
  perChild: [
    { name: 'Mia Rivera', program: 'Navigators', plan: 'Full-time', revenue: 1300, cost: 855 },
    { name: 'Leo Rivera', program: 'Explorers', plan: 'Part-time', revenue: 980, cost: 690 },
    { name: 'Noah Patel', program: 'Navigators', plan: 'Full-time', revenue: 1300, cost: 870 },
    { name: 'Ava Chen', program: 'Navigators', plan: 'Full-time', revenue: 1300, cost: 845 },
    { name: 'Liam Brooks', program: 'Explorers', plan: 'Full-time', revenue: 1180, cost: 905 },
    { name: 'Sofia Garcia', program: 'Tide Pools', plan: 'Full-time', revenue: 1400, cost: 1075 },
    { name: 'Zoe Kim', program: 'Lighthouse', plan: 'Full-time', revenue: 1490, cost: 980 },
    { name: 'Jack Moore', program: 'Lighthouse', plan: 'Part-time', revenue: 1050, cost: 815 },
  ],
}

// ---- Deep child profiles (director) ----
const STD_IMMUNIZATIONS = [
  { name: 'DTaP', date: 'Jan 2026', status: 'Up to date' },
  { name: 'MMR', date: 'Nov 2025', status: 'Up to date' },
  { name: 'Polio (IPV)', date: 'Jan 2026', status: 'Up to date' },
  { name: 'Varicella', date: 'Nov 2025', status: 'Up to date' },
  { name: 'Hib', date: 'Sep 2025', status: 'Up to date' },
]
const MILESTONES = (over) => [
  { label: 'Language & communication', status: over?.lang || 'On track' },
  { label: 'Gross motor', status: over?.gross || 'Mastered' },
  { label: 'Fine motor', status: over?.fine || 'On track' },
  { label: 'Social-emotional', status: over?.social || 'On track' },
  { label: 'Early literacy', status: over?.lit || 'Emerging' },
]
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export const childProfiles = [
  {
    id: 'c1', first: 'Mia', name: 'Mia Rivera', emoji: '🐬', color: 'from-brand-400 to-brand-600',
    dob: 'Mar 14, 2022', age: '4 yrs', program: 'Navigators', status: 'Enrolled', enrolledSince: 'Sep 2024',
    schedule: 'Full-time · Mon–Fri', tuition: 1300, balance: 0,
    guardians: [
      { name: 'Jordan Rivera', relation: 'Mother', phone: '(604) 014-9921', email: 'jordan.rivera@email.com', primary: true },
      { name: 'Casey Rivera', relation: 'Father', phone: '(604) 014-9922', email: 'casey.rivera@email.com' },
    ],
    emergency: [{ name: 'Robin Doyle', relation: 'Grandmother', phone: '(604) 014-7733' }],
    pickups: ['Jordan Rivera', 'Casey Rivera', 'Robin Doyle (Grandmother)'],
    allergies: [{ name: 'Peanuts', severity: 'Severe', plan: 'EpiPen on site · nut-free table' }],
    medications: [],
    immunizations: STD_IMMUNIZATIONS,
    physician: { name: 'Dr. Lin · Harbour Pediatrics', phone: '(604) 555-3300' },
    milestones: MILESTONES({ lit: 'On track' }),
    attendanceRate: 96,
    attendance: [{ d: 'Mon', v: 1 }, { d: 'Tue', v: 1 }, { d: 'Wed', v: 1 }, { d: 'Thu', v: 0 }, { d: 'Fri', v: 1 }],
    trends: { naps: WEEK.map((d, i) => ({ d, min: [95, 85, 100, 90, 80][i] })), meals: WEEK.map((d, i) => ({ d, pct: [100, 80, 100, 90, 100][i] })) },
    notes: [
      { date: 'Jun 5', by: 'Ms. Dana', type: 'Note', text: 'Showed real leadership in circle time — helped a new friend settle in.' },
      { date: 'May 28', by: 'Mr. Theo', type: 'Incident', text: 'Minor scrape on knee at outdoor play. Cleaned & bandaged, parent notified.' },
    ],
    documents: [
      { name: 'Enrollment agreement', status: 'Signed' },
      { name: 'Immunization record', status: 'On file' },
      { name: 'Photo consent', status: 'Signed' },
      { name: 'Summer 2026 form', status: 'Action needed' },
    ],
  },
  {
    id: 'c2', first: 'Leo', name: 'Leo Rivera', emoji: '🐢', color: 'from-sky-400 to-brand-500',
    dob: 'Jul 2, 2023', age: '3 yrs', program: 'Explorers', status: 'Enrolled', enrolledSince: 'Jan 2025',
    schedule: 'Part-time · Mon/Wed/Fri', tuition: 980, balance: 0,
    guardians: [
      { name: 'Jordan Rivera', relation: 'Mother', phone: '(604) 014-9921', email: 'jordan.rivera@email.com', primary: true },
      { name: 'Casey Rivera', relation: 'Father', phone: '(604) 014-9922', email: 'casey.rivera@email.com' },
    ],
    emergency: [{ name: 'Robin Doyle', relation: 'Grandmother', phone: '(604) 014-7733' }],
    pickups: ['Jordan Rivera', 'Casey Rivera'],
    allergies: [],
    medications: [],
    immunizations: STD_IMMUNIZATIONS,
    physician: { name: 'Dr. Lin · Harbour Pediatrics', phone: '(604) 555-3300' },
    milestones: MILESTONES({ lang: 'Emerging', lit: 'Emerging' }),
    attendanceRate: 92,
    attendance: [{ d: 'Mon', v: 1 }, { d: 'Tue', v: 0 }, { d: 'Wed', v: 1 }, { d: 'Thu', v: 0 }, { d: 'Fri', v: 1 }],
    trends: { naps: WEEK.map((d, i) => ({ d, min: [120, 0, 110, 0, 130][i] })), meals: WEEK.map((d, i) => ({ d, pct: [80, 0, 90, 0, 70][i] })) },
    notes: [{ date: 'Jun 3', by: 'Mr. Marcus', type: 'Note', text: 'Loved the sensory bin — stacked cups independently for the first time!' }],
    documents: [
      { name: 'Enrollment agreement', status: 'Signed' },
      { name: 'Immunization record', status: 'On file' },
      { name: 'Photo consent', status: 'Signed' },
    ],
  },
  {
    id: 'c3', first: 'Noah', name: 'Noah Patel', emoji: '🦁', color: 'from-sunshine-400 to-coral-500',
    dob: 'Feb 9, 2022', age: '4 yrs', program: 'Navigators', status: 'Enrolled', enrolledSince: 'Sep 2024',
    schedule: 'Full-time · Mon–Fri', tuition: 1300, balance: 0,
    guardians: [{ name: 'Anika Patel', relation: 'Mother', phone: '(604) 014-5510', email: 'anika.patel@email.com', primary: true }],
    emergency: [{ name: 'Raj Patel', relation: 'Uncle', phone: '(604) 014-5511' }],
    pickups: ['Anika Patel', 'Raj Patel (Uncle)'],
    allergies: [{ name: 'Dairy', severity: 'Mild', plan: 'Dairy-free meals provided' }],
    medications: [{ name: 'Inhaler (asthma)', dose: '2 puffs', schedule: 'As needed' }],
    immunizations: STD_IMMUNIZATIONS,
    physician: { name: 'Dr. Owens · Bayview Clinic', phone: '(604) 555-7710' },
    milestones: MILESTONES({ social: 'Emerging' }),
    attendanceRate: 89,
    attendance: [{ d: 'Mon', v: 1 }, { d: 'Tue', v: 1 }, { d: 'Wed', v: 1 }, { d: 'Thu', v: 1 }, { d: 'Fri', v: 0 }],
    trends: { naps: WEEK.map((d, i) => ({ d, min: [70, 80, 60, 75, 0][i] })), meals: WEEK.map((d, i) => ({ d, pct: [100, 90, 80, 100, 0][i] })) },
    notes: [{ date: 'Jun 4', by: 'Ms. Dana', type: 'Note', text: 'Practiced sharing during block play — big progress this week.' }],
    documents: [{ name: 'Enrollment agreement', status: 'Signed' }, { name: 'Immunization record', status: 'On file' }, { name: 'Asthma action plan', status: 'On file' }],
  },
  {
    id: 'c4', first: 'Ava', name: 'Ava Chen', emoji: '🦋', color: 'from-grape-400 to-grape-600',
    dob: 'May 20, 2022', age: '4 yrs', program: 'Navigators', status: 'Enrolled', enrolledSince: 'Jan 2024',
    schedule: 'Full-time · Mon–Fri', tuition: 1300, balance: 0,
    guardians: [{ name: 'Wei Chen', relation: 'Father', phone: '(604) 014-2201', email: 'wei.chen@email.com', primary: true }],
    emergency: [{ name: 'Mei Chen', relation: 'Mother', phone: '(604) 014-2202' }],
    pickups: ['Wei Chen', 'Mei Chen'],
    allergies: [],
    medications: [],
    immunizations: STD_IMMUNIZATIONS,
    physician: { name: 'Dr. Lin · Harbour Pediatrics', phone: '(604) 555-3300' },
    milestones: MILESTONES({ fine: 'Mastered', lit: 'On track' }),
    attendanceRate: 98,
    attendance: [{ d: 'Mon', v: 1 }, { d: 'Tue', v: 1 }, { d: 'Wed', v: 1 }, { d: 'Thu', v: 1 }, { d: 'Fri', v: 1 }],
    trends: { naps: WEEK.map((d, i) => ({ d, min: [90, 95, 85, 100, 90][i] })), meals: WEEK.map((d, i) => ({ d, pct: [90, 100, 100, 90, 100][i] })) },
    notes: [{ date: 'Jun 6', by: 'Mr. Theo', type: 'Note', text: 'Created a detailed butterfly painting — wonderful fine-motor control.' }],
    documents: [{ name: 'Enrollment agreement', status: 'Signed' }, { name: 'Immunization record', status: 'On file' }, { name: 'Photo consent', status: 'Signed' }],
  },
  {
    id: 'c7', first: 'Zoe', name: 'Zoe Kim', emoji: '🐙', color: 'from-mint-400 to-brand-400',
    dob: 'Oct 1, 2021', age: '4 yrs', program: 'Lighthouse', status: 'Enrolled', enrolledSince: 'Sep 2023',
    schedule: 'Full-time · Mon–Fri', tuition: 1490, balance: 120,
    guardians: [{ name: 'Grace Kim', relation: 'Mother', phone: '(604) 014-8120', email: 'grace.kim@email.com', primary: true }],
    emergency: [{ name: 'Daniel Kim', relation: 'Father', phone: '(604) 014-8121' }],
    pickups: ['Grace Kim', 'Daniel Kim'],
    allergies: [],
    medications: [],
    immunizations: STD_IMMUNIZATIONS,
    physician: { name: 'Dr. Owens · Bayview Clinic', phone: '(604) 555-7710' },
    milestones: MILESTONES({ lit: 'Mastered', lang: 'Mastered' }),
    attendanceRate: 94,
    attendance: [{ d: 'Mon', v: 1 }, { d: 'Tue', v: 1 }, { d: 'Wed', v: 0 }, { d: 'Thu', v: 1 }, { d: 'Fri', v: 1 }],
    trends: { naps: WEEK.map((d, i) => ({ d, min: [60, 55, 0, 65, 50][i] })), meals: WEEK.map((d, i) => ({ d, pct: [100, 100, 0, 90, 100][i] })) },
    notes: [{ date: 'Jun 2', by: 'Ms. Grace', type: 'Note', text: 'Reading three-letter words — ready for Pre-K reading group.' }],
    documents: [{ name: 'Enrollment agreement', status: 'Signed' }, { name: 'Immunization record', status: 'On file' }, { name: 'Kindergarten readiness', status: 'In progress' }],
  },
]

// ---- Families (director) ----
export const families = [
  { id: 'f1', name: 'Rivera Family', children: ['Mia', 'Leo'], primary: 'Jordan Rivera', email: 'jordan.rivera@email.com', phone: '(604) 014-9921', plan: 'Sibling discount', balance: 0, autopay: true, method: 'Visa •••• 4242', comms: 28, lastContact: 'Today' },
  { id: 'f2', name: 'Patel Family', children: ['Noah'], primary: 'Anika Patel', email: 'anika.patel@email.com', phone: '(604) 014-5510', plan: 'Full-time', balance: 0, autopay: true, method: 'Mastercard •••• 8810', comms: 14, lastContact: 'Yesterday' },
  { id: 'f3', name: 'Chen Family', children: ['Ava'], primary: 'Wei Chen', email: 'wei.chen@email.com', phone: '(604) 014-2201', plan: 'Full-time', balance: 0, autopay: true, method: 'Visa •••• 1180', comms: 9, lastContact: '2 days ago' },
  { id: 'f4', name: 'Kim Family', children: ['Zoe'], primary: 'Grace Kim', email: 'grace.kim@email.com', phone: '(604) 014-8120', plan: 'Full-time', balance: 120, autopay: false, method: 'ACH · TD Canada', comms: 21, lastContact: '3 days ago' },
  { id: 'f5', name: 'Brooks Family', children: ['Liam'], primary: 'Hannah Brooks', email: 'hannah.brooks@email.com', phone: '(604) 014-3340', plan: 'Full-time', balance: 1060, autopay: false, method: 'Invoice', comms: 6, lastContact: '1 week ago' },
]

// Quick-add activity options for caregiver logging
export const quickMeals = ['All', 'Most', 'Some', 'None', 'Refused']
export const quickMoods = ['Happy 😊', 'Calm 😌', 'Playful 🤸', 'Sleepy 😴', 'Fussy 😣', 'Curious 🧐']
export const diaperOptions = ['Bathroom ✓', 'Reminder', 'Accident', 'Independent']
