import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import {
  ShieldCheck, Lock, Server, Ban, DollarSign, Sparkles, ArrowRightLeft, Palette,
  Globe, ArrowRight, Check, Heart, GraduationCap, Building2, Clock, Camera,
  MessageCircle, CreditCard, Star, Smartphone, Download, Bot, Zap, Wand2,
  ClipboardList, Utensils, Bandage, Home, CalendarDays, User,
  TrendingUp, Banknote, UserPlus, BookHeart, BookOpen, ListChecks, Link2, Users, ChevronDown,
} from 'lucide-react'

// Whitelabel platform brand — rename here to rebrand the whole sales page.
const BRAND = 'Mitten'

const fade = (d = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.5, delay: d },
})

export default function Sales() {
  // Tab title + favicon are set by applyBrandHead() in main.jsx.
  return (
    <div className="min-h-screen bg-white text-slate-700">
      <Nav />
      <Hero />
      <TrustBar />
      <PhonesShowcase />
      <EasyCinema />
      <AllFeatures />
      <DirectorShowcase />
      <Privacy />
      <WhySwitch />
      <Whitelabel />
      <Impact />
      <Audience />
      <AIAutomation />
      <Migration />
      <CubsBanner />
      <Pricing />
      <FAQSection />
      <Contact />
      <Footer />
    </div>
  )
}

/* ---------------- AI automation (premium) ---------------- */
function AIAutomation() {
  const [hrs, setHrs] = useState(12)
  const savedPerMonth = Math.round(hrs * 4.33 * 0.6)
  const valuePerMonth = savedPerMonth * 35
  const tools = [
    ['QuickBooks', 'Bookkeeping & invoicing', 'bg-mint-500'],
    ['Gmail', 'Parent comms & drafting', 'bg-coral-500'],
    ['Google Drive', 'Forms & documents', 'bg-sunshine-500'],
    [`Your ${BRAND} app`, 'Your childcare platform', 'bg-brand-500'],
  ]
  return (
    <section id="ai" className="relative overflow-hidden bg-slate-900 text-white">
      <div className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-grape-500/30 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-5 py-20">
        <motion.div {...fade()} className="mx-auto max-w-2xl text-center">
          <span className="pill-mono border-white/20 bg-white/10 text-white"><Wand2 size={12} /> Premium · AI business automation</span>
          <h2 className="mt-5 text-4xl text-white sm:text-5xl">Run your whole business with AI — <span className="italic text-brand-300">set up for you.</span></h2>
          <p className="mt-4 text-lg font-medium text-slate-300">
            As a premium add-on, we map exactly how your childcare business can use AI to cut admin hours and increase output —
            then connect <span className="font-bold text-white">Claude</span> to your tools so the busywork runs itself, managed from the Claude desktop app.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {/* ROI estimator */}
          <motion.div {...fade(0.05)} className="rounded-4xl border border-white/10 bg-white/5 p-7 backdrop-blur">
            <p className="eyebrow text-slate-400">Hours saved vs. spend</p>
            <h3 className="mt-1 text-2xl text-white">What would you get back?</h3>
            <label className="mt-5 block text-sm font-bold text-slate-300">
              Hours you spend on admin each week: <span className="text-brand-300">{hrs}h</span>
            </label>
            <input type="range" min="4" max="40" value={hrs} onChange={(e) => setHrs(+e.target.value)} className="mt-3 w-full accent-brand-400" />
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-3xl bg-white/5 p-5 text-center">
                <div className="font-display text-4xl text-mint-300">~{savedPerMonth}h</div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">Saved / month</div>
              </div>
              <div className="rounded-3xl bg-white/5 p-5 text-center">
                <div className="font-display text-4xl text-brand-300">${valuePerMonth.toLocaleString()}</div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">Of your time / month</div>
              </div>
            </div>
            <p className="mt-4 text-center text-sm font-semibold text-slate-300">
              …for <span className="font-extrabold text-white">$60/month</span> all-in. That’s your time back, every month.
            </p>
          </motion.div>

          {/* What's included + pricing */}
          <motion.div {...fade(0.12)} className="flex flex-col gap-4">
            <div className="rounded-4xl border border-white/10 bg-white/5 p-7">
              <p className="eyebrow text-slate-400">We connect Claude to</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {tools.map(([t, d, dot]) => (
                  <div key={t} className="flex items-center gap-2.5 rounded-2xl bg-white/5 p-3">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-white">{t}</div>
                      <div className="truncate text-[11px] font-semibold text-slate-400">{d}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
                <Bot size={16} className="text-brand-300" /> Managed from the Claude desktop app — no new dashboards to learn.
              </div>
            </div>

            <div className="rounded-4xl bg-gradient-to-br from-brand-500 to-grape-600 p-7">
              <div className="flex items-end justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/80">One-time setup</p>
                  <div className="font-display text-5xl text-white">$750</div>
                </div>
                <Zap size={32} className="text-white/80" />
              </div>
              <p className="mt-2 text-sm font-semibold text-white/90">Full business-automation setup through Claude for Small Business.</p>
              <div className="mt-4 space-y-1.5 border-t border-white/20 pt-4 text-sm font-bold text-white/90">
                <div className="flex items-center justify-between"><span>Then · Claude subscription</span><span>$30/mo</span></div>
                <div className="flex items-center justify-between"><span>Then · our maintenance</span><span>$30/mo</span></div>
                <div className="flex items-center justify-between text-white/70"><span className="font-semibold">Cancel anytime once you’re self-sufficient</span></div>
              </div>
              <a href="#demo" className="btn mt-5 w-full bg-white text-brand-700 hover:-translate-y-0.5"><Wand2 size={17} /> Book your automation setup</a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* ---------------- Nav ---------------- */
function Nav() {
  const links = [
    ['Features', '#features'],
    ['Directors', '#directors'],
    ['Privacy', '#privacy'],
    ['Pricing', '#pricing'],
    ['Migrate', '#migrate'],
    ['Resources', '/resources'],
  ]
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <a href="#top" className="flex items-center gap-2">
          <img src="/brand/mitten-mark.svg" alt="Mitten" className="h-9 w-9" />
          <span className="text-2xl font-display text-brand-700">{BRAND}</span>
        </a>
        <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-500 md:flex">
          {links.map(([l, h]) => (
            <a key={l} href={h} className="transition hover:text-brand-600">{l}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a href="/app" className="hidden text-sm font-bold text-brand-600 sm:inline">See live demo</a>
          <a href="/signup" className="btn-primary !py-2 text-sm">Start free</a>
        </div>
      </div>
    </header>
  )
}

/* ---------------- Cinematic hero ---------------- */
// Full-bleed knit-world film loop (Higgsfield). Poster carries mobile +
// reduced-motion; the mp4 only loads ≥768px so phones never pay for it.
function useCinemaVideo() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 768px)')
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setOn(wide.matches && !still.matches)
    update()
    wide.addEventListener('change', update)
    still.addEventListener('change', update)
    return () => { wide.removeEventListener('change', update); still.removeEventListener('change', update) }
  }, [])
  return on
}

function Hero() {
  const video = useCinemaVideo()
  return (
    <section id="top" className="relative flex min-h-[88svh] items-center overflow-hidden bg-[#fdf3e3]">
      {/* film layer */}
      {video ? (
        <video
          className="absolute inset-0 h-full w-full object-cover [object-position:74%_50%]"
          autoPlay muted loop playsInline
          poster="/cinema/hero-poster.webp"
          src="/cinema/hero-loop.mp4"
        />
      ) : (
        <img src="/cinema/hero-poster.webp" alt="" className="absolute inset-0 h-full w-full object-cover [object-position:74%_50%]" />
      )}
      {/* legibility scrims — keep the cub clear on the right */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/45 to-transparent sm:via-white/25" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-white" />

      <div className="relative mx-auto w-full max-w-6xl px-5 pb-24 pt-16">
        <div className="max-w-xl text-left">
          <motion.span {...fade()} className="pill-mono !bg-white/80 backdrop-blur">
            <ShieldCheck size={12} /> Whitelabel childcare platform
          </motion.span>
          <motion.h1 {...fade(0.05)} className="mt-5 text-5xl leading-[1.04] text-brand-700 sm:text-6xl lg:text-7xl">
            Your academy deserves <span className="text-shimmer italic">its own app</span> — not someone else’s platform.
          </motion.h1>
          <motion.p {...fade(0.12)} className="mt-5 max-w-lg text-lg font-medium text-slate-600">
            {BRAND} runs your whole daycare — daily photos, reports, messaging, milestones, check-in,
            lesson plans, analytics, even payroll prep and employee onboarding. Your data stays exclusively
            yours, at a fraction of the big platforms' price, with free migration from whatever you use today.
          </motion.p>
          <motion.div {...fade(0.2)} className="mt-7 flex flex-wrap items-center gap-3">
            <a href="/signup" className="btn-primary px-7 py-3 text-base">Start free <ArrowRight size={18} /></a>
            <a href="#demo" className="btn-ghost !bg-white/80 px-7 py-3 text-base backdrop-blur">Book a demo</a>
          </motion.div>
          <motion.p {...fade(0.24)} className="mt-3 text-sm font-semibold text-slate-500">
            Free for up to 5 children · no card needed · live in minutes
          </motion.p>

          {/* glass proof chips */}
          <motion.div {...fade(0.3)} className="mt-9 grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [<CountUp key="a" to={5} />, 'children free, forever'],
              [<span key="b">$<CountUp to={20} /></span>, '/mo when you grow'],
              [<span key="c"><CountUp to={0} />%</span>, 'cut of your tuition'],
              [<span key="d"><CountUp to={2} /> min</span>, 'to go live'],
            ].map(([v, l], i) => (
              <div key={i} className="rounded-3xl border border-white/80 bg-white/80 px-3 py-3.5 shadow-sm backdrop-blur-md">
                <div className="font-display text-2xl text-brand-700 sm:text-3xl">{v}</div>
                <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">{l}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* scroll cue */}
      <motion.a
        href="#phones" aria-label="Scroll to see the app"
        className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 text-brand-600"
        animate={{ y: [0, 7, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ChevronDown size={26} />
      </motion.a>
    </section>
  )
}

/* What families & educators see — the phones, on the old aurora stage */
function PhonesShowcase() {
  return (
    <section id="phones" className="aurora relative overflow-hidden">
      <div className="blob blob-a left-[-6rem] top-[-4rem] h-80 w-80 bg-sky-300/70" />
      <div className="blob blob-b right-[-5rem] top-24 h-72 w-72 bg-blush-300/70" />
      <div className="relative mx-auto max-w-6xl px-5 pt-14 text-center">
        <motion.p {...fade()} className="eyebrow">What your families &amp; educators see</motion.p>
      </div>
      <PhoneRow />
    </section>
  )
}

/* ---------------- Ease-of-use cinema (parallax knit valley) ---------------- */
function EasyCinema() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['-10%', '10%'])
  const steps = [
    [Building2, 'Create your daycare', 'Two minutes, no credit card. Name it, add your rooms, and your app exists.'],
    [Link2, 'Share one link', 'Families and educators join themselves from a single invite link — no spreadsheets, no IT.'],
    [Camera, 'Run your day', 'Photos, daily reports, check-in, even billing — all flowing by snack time.'],
  ]
  return (
    <section ref={ref} id="easy" className="relative overflow-hidden">
      {/* parallax film backdrop */}
      <motion.img
        src="/cinema/valley.webp" alt="" aria-hidden
        style={{ y }}
        className="absolute -top-[10%] left-0 h-[120%] w-full object-cover"
      />
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-white via-white/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/90 to-transparent" />

      <div className="relative mx-auto max-w-6xl px-5 pb-24 pt-16 sm:pt-20">
        <motion.div {...fade()} className="mx-auto max-w-2xl text-center">
          <p className="eyebrow !text-slate-500">Up and running before nap time</p>
          <h2 className="mt-2 text-4xl text-brand-700 sm:text-5xl">Live in minutes. <span className="italic">Not months.</span></h2>
        </motion.div>

        <div className="mt-56 grid gap-5 sm:mt-64 md:grid-cols-3">
          {steps.map(([Icon, t, d], i) => (
            <motion.div
              {...fade(i * 0.12)}
              key={t}
              className="rounded-4xl border border-white/70 bg-white/75 p-6 shadow-lg backdrop-blur-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-grape-500 font-display text-lg text-white shadow-md">{i + 1}</span>
                <Icon size={20} className="text-brand-500" />
              </div>
              <h3 className="mt-4 text-xl text-slate-800">{t}</h3>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-600">{d}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------- "First five free" cinema banner ---------------- */
function CubsBanner() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <motion.div {...fade()} className="relative overflow-hidden rounded-4xl border border-line shadow-xl">
          <img
            src="/cinema/cubs.webp" alt="Five knitted bear cubs in a row"
            className="absolute inset-0 h-full w-full object-cover [object-position:50%_72%]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/85 via-white/35 to-transparent" />
          <div className="relative px-6 pb-56 pt-12 text-center sm:pb-64 sm:pt-14">
            <p className="eyebrow !text-slate-500">Count them</p>
            <h2 className="mx-auto mt-2 max-w-2xl text-4xl text-brand-700 sm:text-5xl">
              Your first five children are <span className="italic">free. Forever.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base font-medium text-slate-600">
              Start small, pay nothing. {BRAND} only costs money once your sixth child enrolls — and even then it’s $20/month.
            </p>
            <a href="/signup" className="btn-primary mt-6 px-7 py-3 text-base">Start free <ArrowRight size={18} /></a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ---------------- Phone mockups ---------------- */
function Phone({ children, className = '', lift = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: lift }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className={`relative h-[460px] w-[226px] shrink-0 rounded-[2.4rem] border-[6px] border-slate-900 bg-slate-900 shadow-2xl ${className}`}
    >
      <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-slate-900" />
      <div className="h-full w-full overflow-hidden rounded-[1.9rem] bg-tint">{children}</div>
    </motion.div>
  )
}

function PhoneRow() {
  return (
    <div className="mx-auto flex max-w-6xl items-end justify-center gap-4 overflow-x-auto px-5 pb-16 pt-4 sm:gap-6">
      <div className="bob-slow hidden sm:block"><Phone lift={20}><FeedScreen /></Phone></div>
      <div className="bob-slower z-10"><Phone><DashScreen /></Phone></div>
      <div className="bob-slow hidden sm:block"><Phone lift={20}><ChatScreen /></Phone></div>
    </div>
  )
}

function ScreenTop({ title }) {
  return (
    <div className="flex items-center justify-between px-4 pb-2 pt-4">
      <div className="font-mono text-[9px] font-bold text-slate-500">9:41</div>
      <div className="text-[10px] font-extrabold text-brand-700">{title}</div>
      <div className="h-2.5 w-6 rounded-sm bg-slate-300" />
    </div>
  )
}
const DOCK_ITEMS = [
  { id: 'Home', Icon: Home },
  { id: 'Day', Icon: CalendarDays },
  { id: 'Chat', Icon: MessageCircle },
  { id: 'Me', Icon: User },
]
function MiniDock({ active }) {
  return (
    <div className="absolute inset-x-2 bottom-2 flex items-stretch rounded-2xl border border-line bg-white/90 px-1 py-1 shadow-[0_8px_22px_-10px_rgba(14,78,128,0.3)] backdrop-blur-md">
      {DOCK_ITEMS.map(({ id, Icon }) => {
        const on = id === active
        return (
          <div key={id} className={`flex flex-1 flex-col items-center gap-[1px] text-[7px] font-bold ${on ? 'text-brand-600' : 'text-slate-400'}`}>
            <span className={`flex h-5 w-8 items-center justify-center rounded-[10px] ${on ? 'bg-brand-50' : ''}`}>
              <Icon size={12} strokeWidth={on ? 2.6 : 2} />
            </span>
            {id}
          </div>
        )
      })}
    </div>
  )
}
// Real stock photos of children in daycare (Pexels — same source as the marketing site).
const PX = (id, w = 500) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`
const KID_IDS = [7605825, 8363102, 8364641, 8613089, 8422142, 8612967]
const FEED_AVATARS = KID_IDS.slice(0, 5).map((id) => PX(id, 120))
const FEED_POSTS = [
  { img: PX(8422142), cap: 'Ms. Dana · circle time 🌟' },
  { img: PX(8364641), cap: 'Mr. Theo · sensory play' },
  { img: PX(7605825), cap: 'Ms. Dana · little scientists 🔬' },
]
function FeedScreen() {
  const [i, setI] = useState(0)
  const [likes, setLikes] = useState(6)
  useEffect(() => {
    const t = setInterval(() => { setI((p) => (p + 1) % FEED_POSTS.length); setLikes(4 + Math.floor(Math.random() * 6)) }, 2600)
    return () => clearInterval(t)
  }, [])
  const post = FEED_POSTS[i]
  return (
    <div className="relative h-full bg-tint">
      <ScreenTop title="Home" />
      <div className="px-2.5">
        {/* child avatar row — real photos with live status rings */}
        <div className="mb-2 flex gap-1.5">
          {FEED_AVATARS.map((src, k) => (
            <div key={k} className={`h-9 w-9 shrink-0 rounded-full p-[1.5px] ring-2 ${k === 3 ? 'ring-coral-300' : 'ring-mint-400'}`}>
              <img src={src} alt="" loading="lazy" className="h-full w-full rounded-full object-cover" />
            </div>
          ))}
        </div>
        <div className="mb-1 text-[10px] font-extrabold text-slate-700">Activity feed</div>
        {/* post card */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex items-center gap-1.5 p-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-grape-500 text-[7px] font-extrabold text-white">D</span>
            <span className="truncate text-[8px] font-bold text-slate-600">{post.cap}</span>
          </div>
          <div className="relative h-[106px] overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.img key={i} src={post.img} alt="" loading="lazy"
                initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}
                className="absolute inset-0 h-full w-full object-cover" />
            </AnimatePresence>
            <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-black/35 px-1.5 py-0.5 text-[7px] font-bold text-white backdrop-blur">
              <Camera size={8} /> Photo
            </div>
          </div>
          <div className="flex items-center gap-1.5 p-1.5 text-[7.5px] font-bold text-slate-400">
            just now
            <motion.span key={likes} initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="ml-auto flex items-center gap-0.5 text-coral-500">
              <Heart size={9} className="fill-coral-500" /> {likes}
            </motion.span>
            <span className="flex items-center gap-0.5"><MessageCircle size={9} /> 2</span>
          </div>
        </div>
        {/* a logged care moment */}
        <div className="mt-1.5 flex items-center gap-1.5 rounded-2xl bg-white p-1.5 shadow-sm">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-mint-400/20 text-[9px]">🍎</span>
          <span className="text-[8px] font-bold text-slate-600">Lunch · ate most</span>
          <span className="ml-auto text-[7px] font-bold text-slate-300">12:05</span>
        </div>
      </div>
      <MiniDock active="Home" />
    </div>
  )
}

const DASH_TILES = [
  [ClipboardList, 'from-grape-400 to-grape-600'],
  [Utensils, 'from-coral-400 to-coral-600'],
  [Bandage, 'from-blush-400 to-blush-600'],
  [Camera, 'from-sunshine-400 to-sunshine-500'],
]
const DASH_KIDS = [
  { name: 'Mia R.', img: PX(7605825, 120) },
  { name: 'Noah P.', img: PX(8364641, 120) },
  { name: 'Liam B.', img: PX(8363102, 120), toggles: true },
]
function DashScreen() {
  const [sec, setSec] = useState(0)
  useEffect(() => { const t = setInterval(() => setSec((s) => s + 1), 1000); return () => clearInterval(t) }, [])
  const tot = 2 * 3600 + 41 * 60 + sec
  const h = Math.floor(tot / 3600), m = Math.floor((tot % 3600) / 60), s = tot % 60
  const liamOut = Math.floor(sec / 4) % 2 === 1
  const pressTile = Math.floor(sec / 2) % 4
  return (
    <div className="relative h-full bg-tint">
      <ScreenTop title="Dashboard" />
      <div className="px-2.5">
        <div className="mb-0.5 font-mono text-[8px] uppercase tracking-wide text-slate-400">Wednesday · Jun 8</div>
        <div className="mb-2 text-sm font-display text-slate-800">Good afternoon 👋</div>
        <div className="mb-2 flex items-center justify-between rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-2.5 text-white shadow-sm">
          <div>
            <div className="flex items-center gap-1 font-mono text-[7px] uppercase tracking-wider text-white/80">
              <motion.span animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.4, repeat: Infinity }} className="h-1 w-1 rounded-full bg-mint-300" /> Clocked in
            </div>
            <div className="font-display text-xl leading-none">{h}h {m}m <span className="font-mono text-[9px] text-white/70">{String(s).padStart(2, '0')}s</span></div>
          </div>
          <div className="rounded-full bg-white px-2.5 py-1 text-[8px] font-bold text-coral-600">Clock Out</div>
        </div>
        <div className="mb-2 grid grid-cols-4 gap-1.5">
          {DASH_TILES.map(([Icon, g], k) => (
            <motion.div key={k} animate={{ scale: pressTile === k ? 0.88 : 1 }} className={`flex aspect-square items-center justify-center rounded-2xl bg-gradient-to-br ${g} text-white shadow-sm`}>
              <Icon size={15} strokeWidth={2.2} />
            </motion.div>
          ))}
        </div>
        <div className="mb-1 flex items-center justify-between text-[8px] font-extrabold text-slate-600">
          <span>Children</span>
          <span className="text-mint-500">● 17 in</span>
        </div>
        <div className="rounded-2xl bg-white p-1.5 shadow-sm">
          {DASH_KIDS.map((kid, k) => {
            const out = kid.toggles && liamOut
            return (
              <div key={k} className="flex items-center gap-2 border-b border-line py-1 last:border-0">
                <span className="relative h-6 w-6 shrink-0">
                  <img src={kid.img} alt="" loading="lazy" className="h-6 w-6 rounded-lg object-cover" />
                  <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-white ${out ? 'bg-coral-500' : 'bg-mint-500'}`} />
                </span>
                <span className="text-[8.5px] font-bold text-slate-600">{kid.name}</span>
                <AnimatePresence mode="wait">
                  <motion.span key={out ? 'out' : 'in'} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                    className={`ml-auto rounded-full px-1.5 text-[7px] font-bold ${out ? 'bg-coral-400/15 text-coral-600' : 'bg-mint-400/15 text-mint-500'}`}>{out ? 'Checked out' : 'In'}</motion.span>
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
      <MiniDock active="Home" />
    </div>
  )
}

const CHAT_MSGS = [
  { from: 'them', text: 'Nora had an amazing day! 😊' },
  { from: 'me', text: 'She painted this masterpiece 🎨', img: PX(8364641, 320) },
  { from: 'them', text: 'I love it — framing that one!' },
  { from: 'me', text: 'Heads up, we’re low on sunscreen 🧴' },
]
function ChatScreen() {
  const [n, setN] = useState(1)
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    let timer
    if (n < CHAT_MSGS.length) {
      if (CHAT_MSGS[n].from === 'them') { setTyping(true); timer = setTimeout(() => { setTyping(false); setN(n + 1) }, 1200) }
      else timer = setTimeout(() => setN(n + 1), 1000)
    } else {
      timer = setTimeout(() => setN(1), 2600)
    }
    return () => clearTimeout(timer)
  }, [n])
  return (
    <div className="relative h-full bg-tint">
      <ScreenTop title="Messages" />
      {/* conversation header */}
      <div className="mx-2.5 mb-2 flex items-center gap-2 rounded-2xl bg-white p-1.5 shadow-sm">
        <img src={PX(8613089, 120)} alt="" loading="lazy" className="h-7 w-7 rounded-full object-cover" />
        <div className="min-w-0">
          <div className="text-[9px] font-extrabold leading-none text-slate-700">Amanda Wilson</div>
          <div className="text-[7px] font-bold text-mint-500">● Nora’s mom</div>
        </div>
      </div>
      <div className="space-y-1.5 px-3">
        <AnimatePresence>
          {CHAT_MSGS.slice(0, n).map((m, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 8, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
              className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[82%] overflow-hidden text-[8.5px] font-semibold shadow-sm ${m.from === 'me' ? 'rounded-2xl rounded-br-md bg-brand-600 text-white' : 'rounded-2xl rounded-bl-md bg-white text-slate-600'}`}>
                {m.img && <img src={m.img} alt="" loading="lazy" className="h-20 w-full object-cover" />}
                <div className="px-2.5 py-1.5">{m.text}</div>
              </div>
            </motion.div>
          ))}
          {typing && (
            <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-start">
              <div className="flex gap-1 rounded-2xl rounded-bl-md bg-white px-3 py-2 shadow-sm">
                {[0, 1, 2].map((d) => (
                  <motion.span key={d} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.2 }} className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="absolute inset-x-3 bottom-12 flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5">
        <span className="text-[8.5px] text-slate-400">Message…</span>
        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">↑</span>
      </div>
      <MiniDock active="Chat" />
    </div>
  )
}

/* ---------------- All features (the full tour) ---------------- */
const FEATURES = [
  [Camera, 'Daily photos & moments', 'Snap with the camera or upload. Share to the whole class or privately to one family — privacy controls built in.', 'from-blush-400 to-coral-500'],
  [ClipboardList, 'Daily reports & activity log', 'Meals, naps, activities and learning moments — logged in a tap, visible to parents instantly.', 'from-brand-400 to-brand-600'],
  [Wand2, 'AI notes & daily recaps', 'Educators draft warm parent notes in one tap; parents get an AI "day in a glance" summary. Included free.', 'from-grape-400 to-grape-600'],
  [BookHeart, 'Milestones & Memory Book', 'Track development across motor, language, social & more. Families keep a memory book they’ll treasure.', 'from-blush-400 to-grape-500'],
  [MessageCircle, 'Family messaging', 'A private thread with every family — no more lost pickup notes or scattered group texts.', 'from-sky-400 to-brand-500'],
  [ListChecks, 'Attendance & check-in', 'One-tap check-in and check-out with a live "who’s here" view across every room.', 'from-mint-400 to-mint-500'],
  [Clock, 'Staff time tracking', 'Educators clock in and out on their phones — live hours that feed straight into payroll.', 'from-sunshine-400 to-coral-500'],
  [Banknote, 'Payroll prep & pay stubs', 'Tracked hours become gross pay, overtime and vacation accrual — printable stubs + CSV for your accountant.', 'from-mint-400 to-brand-500'],
  [UserPlus, 'Employee self-onboarding', 'Send new hires one link: personal details, banking & SIN (encrypted) and documents — collected for you.', 'from-brand-400 to-grape-500'],
  [BookOpen, 'Lesson plans & curriculum', 'Directors author hour-by-hour plans; educators run them live in class. Training library included.', 'from-grape-400 to-blush-500'],
  [TrendingUp, 'Profitability analytics', 'Revenue, tuition coverage and per-room insight — always current, never a spreadsheet.', 'from-sky-400 to-grape-500'],
  [Link2, 'Self-serve family invites', 'Parents and staff join through your own link — no setup calls, no CSV imports, live in minutes.', 'from-coral-400 to-sunshine-500'],
  [Heart, 'Calm Corner breathing for kids', 'Screen-led breathwork the class follows together — balloon breaths to box breathing, 1–5 minute sessions, logged to the family feed.', 'from-sky-400 to-mint-500'],
]

function AllFeatures() {
  return (
    <section id="features" className="bg-white">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <motion.div {...fade()} className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">The full tour</p>
          <h2 className="mt-2 text-4xl text-brand-700 sm:text-5xl">Every tool a daycare needs. One calm app.</h2>
          <p className="mt-4 text-lg font-medium text-slate-500">
            No add-on modules, no "premium tiers" for basics. Everything below is included — even while you're free.
          </p>
        </motion.div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([Icon, t, d, g], i) => (
            <motion.div {...fade(Math.min(i * 0.04, 0.3))} key={t} className="card feature-glow p-6 transition-all hover:-translate-y-1 hover:shadow-playful">
              <span className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${g} text-white shadow-md`}>
                <Icon size={22} />
              </span>
              <h3 className="text-xl text-slate-800">{t}</h3>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-500">{d}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------- Director showcase (interactive desktop) ---------------- */
const DESK_TABS = [
  { id: 'dash', label: 'Dashboard', icon: Home, blurb: 'Everything happening right now — children in, ratios, the live feed, money and messages.' },
  { id: 'profit', label: 'Profitability', icon: TrendingUp, blurb: 'Revenue vs cost per room, six-month trend, margin and extras — live, not a month-old spreadsheet.' },
  { id: 'payroll', label: 'Payroll', icon: Banknote, blurb: 'Tracked hours become regular, overtime, vacation accrual and gross — stubs and CSV in two clicks.' },
  { id: 'enroll', label: 'Enrollment', icon: Users, blurb: 'Inquiry funnel, room capacity and an actionable waitlist — fill spots without the phone tag.' },
  { id: 'families', label: 'Families', icon: Heart, blurb: 'Every child, allergy, tuition and parent link in one roster — with today’s last update at a glance.' },
]

function DeskStat({ label, value, delta, up = true, tone }) {
  return (
    <div className="rounded-xl bg-white p-2 shadow-sm">
      <div className="flex items-baseline gap-1">
        <span className={`text-[15px] font-extrabold leading-none ${tone}`}>{value}</span>
        {delta && <span className={`text-[8px] font-extrabold ${up ? 'text-mint-500' : 'text-coral-500'}`}>{up ? '▲' : '▼'}{delta}</span>}
      </div>
      <div className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  )
}
function DeskBar({ label, pct, money: m, color, delay = 0, thin = false }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-[9.5px] font-bold text-slate-500"><span>{label}</span><span>{m}</span></div>
      <div className={`${thin ? 'h-1.5' : 'h-2'} w-full overflow-hidden rounded-full bg-slate-100`}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay, ease: 'easeOut' }} className={`h-full rounded-full ${color}`} />
      </div>
    </div>
  )
}
const ROOM_CHIP = 'rounded-full px-1.5 py-px text-[7.5px] font-extrabold'

function DeskDash() {
  const feed = [
    { img: PX(8422142, 80), t: 'Ms. Dana posted 4 photos to Sunbeams', s: 'circle time 🌟', time: 'now' },
    { emoji: '🍎', t: 'Lunch logged · Explorers — 7 of 7 ate well', s: 'Mr. Theo', time: '12:05' },
    { img: PX(7605825, 80), t: 'Mia R. checked in by grandma (authorized)', s: 'Sunbeams · 8:42 arrival', time: '8:42' },
    { emoji: '⏰', t: 'Late pickup logged · Liam B. · 20 min · $30', s: 'auto-added to extras ledger', time: 'Mon' },
  ]
  return (
    <div className="grid grid-cols-5 gap-2">
      <div className="col-span-3 space-y-2">
        <div className="grid grid-cols-3 gap-1.5">
          <DeskStat label="Children in" value="18/22" delta="2" tone="text-mint-500" />
          <DeskStat label="Staff on floor" value="4" delta="ratio ✓" tone="text-brand-600" />
          <DeskStat label="Unread" value="3" tone="text-coral-500" />
        </div>
        <div className="rounded-xl bg-white p-2.5 shadow-sm">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[8.5px] font-extrabold uppercase tracking-wide text-slate-400">Rooms right now</span>
            <span className="text-[8px] font-bold text-mint-500">all ratios ✓</span>
          </div>
          <div className="space-y-1.5">
            {[['Sunbeams', '8/8', 100, '2 staff', 'from-mint-400 to-mint-500'], ['Explorers', '6/8', 75, '1 staff', 'from-brand-400 to-brand-500'], ['Navigators', '4/6', 67, '1 staff', 'from-grape-400 to-grape-500']].map(([n, c, p, s, g], i) => (
              <div key={n}>
                <div className="mb-0.5 flex items-center justify-between text-[9px] font-bold text-slate-500">
                  <span>{n} · {c} in</span>
                  <span className={`${ROOM_CHIP} bg-slate-100 text-slate-400`}>{s}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${p}%` }} transition={{ duration: 0.7, delay: i * 0.08 }} className={`h-full rounded-full bg-gradient-to-r ${g}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-white p-2.5 shadow-sm">
          <div className="mb-1 text-[8.5px] font-extrabold uppercase tracking-wide text-slate-400">Today</div>
          <div className="flex flex-wrap gap-1">
            {['9:00 Circle', '10:30 Outdoor', '12:00 Lunch', '1:00 Nap', '3:15 Calm Corner 🫧'].map((b) => (
              <span key={b} className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[8px] font-bold text-brand-700">{b}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="col-span-2 rounded-xl bg-white p-2.5 shadow-sm">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[8.5px] font-extrabold uppercase tracking-wide text-slate-400">Live feed</span>
          <span className="flex items-center gap-1 text-[8px] font-bold text-mint-500"><span className="h-1 w-1 animate-pulse rounded-full bg-mint-400" />live</span>
        </div>
        <div className="space-y-1.5">
          {feed.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.1 }} className="flex items-start gap-1.5">
              {f.img ? <img src={f.img} alt="" loading="lazy" className="h-5 w-5 shrink-0 rounded-md object-cover" /> : <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px]">{f.emoji}</span>}
              <div className="min-w-0">
                <div className="truncate text-[8.5px] font-extrabold leading-tight text-slate-700">{f.t}</div>
                <div className="truncate text-[7.5px] font-semibold text-slate-400">{f.s} · {f.time}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DeskProfit() {
  const trend = [62, 68, 64, 73, 81, 88]
  const rooms = [
    ['Sunbeams', 8400, 5460, 'from-brand-400 to-brand-600'],
    ['Explorers', 6440, 4180, 'from-grape-400 to-grape-600'],
    ['Navigators', 4400, 3120, 'from-coral-400 to-blush-500'],
  ]
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1.5">
        <DeskStat label="Revenue" value="$19,240" delta="8%" tone="text-brand-700" />
        <DeskStat label="Costs" value="$13,860" delta="2%" up={false} tone="text-slate-700" />
        <DeskStat label="Profit" value="$5,380" delta="14%" tone="text-mint-500" />
        <DeskStat label="Margin" value="28%" tone="text-grape-600" />
      </div>
      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-3 rounded-xl bg-white p-2.5 shadow-sm">
          <div className="mb-1.5 flex justify-between text-[8.5px] font-extrabold uppercase tracking-wide text-slate-400"><span>Revenue vs cost by room</span><span className="normal-case text-slate-300">rev / cost</span></div>
          <div className="space-y-2">
            {rooms.map(([n, rev, cost, g], i) => (
              <div key={n}>
                <div className="mb-0.5 flex justify-between text-[9px] font-bold text-slate-500"><span>{n}</span><span>${rev.toLocaleString()} / <span className="text-slate-400">${cost.toLocaleString()}</span></span></div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(rev / 9000) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.08 }} className={`h-full rounded-full bg-gradient-to-r ${g}`} />
                </div>
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(cost / 9000) * 100}%` }} transition={{ duration: 0.7, delay: 0.1 + i * 0.08 }} className="h-full rounded-full bg-slate-300" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-2 rounded-xl bg-white p-2.5 shadow-sm">
          <div className="mb-1.5 text-[8.5px] font-extrabold uppercase tracking-wide text-slate-400">6-month profit trend</div>
          <div className="flex h-16 items-end gap-1">
            {trend.map((h, i) => (
              <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ duration: 0.5, delay: i * 0.07 }}
                className={`flex-1 rounded-t ${i === trend.length - 1 ? 'bg-gradient-to-t from-brand-500 to-grape-400' : 'bg-brand-100'}`} />
            ))}
          </div>
          <div className="mt-1 flex justify-between font-mono text-[7px] font-bold text-slate-300"><span>Jan</span><span>Jun</span></div>
          <div className="mt-1.5 rounded-lg bg-mint-400/10 px-1.5 py-1 text-center text-[8px] font-extrabold text-mint-600">extras + plans: $480/mo ▲</div>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-white px-2.5 py-1.5 text-[8.5px] font-bold shadow-sm">
        <span className="text-slate-500">17/18 tuition set · 94% coverage</span>
        <span className="text-slate-400">0% payment cut</span>
        <span className="text-mint-600">Mitten cost: $52/mo</span>
      </div>
    </div>
  )
}

function DeskPayroll() {
  const rows = [
    ['Marcus Lee', 'Lead Educator', '🧑‍🏫', 80, 4, '$82.56', '$2,064.00'],
    ['Priya Sharma', 'ECE Assistant', '👩‍🏫', 75, 0, '$90.00', '$1,500.00'],
    ['Dana Whitfield', 'ECE', '🧑‍🎨', 80, 0, '$73.60', '$1,840.00'],
    ['Sam Ortiz', 'OSC Leader', '🧗', 64, 2, '$59.52', '$1,488.00'],
  ]
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {['Apr 30 – May 13 ✓', 'May 14 – 27 ✓', 'May 28 – Jun 10'].map((p, i) => (
          <span key={p} className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${i === 2 ? 'bg-brand-600 text-white' : 'bg-white text-slate-400 shadow-sm'}`}>{p}</span>
        ))}
        <span className="ml-auto rounded-full bg-brand-50 px-2 py-0.5 text-[8px] font-bold text-brand-700">Bi-weekly</span>
      </div>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="grid grid-cols-[1fr_repeat(4,auto)] gap-x-3 border-b border-line bg-slate-50/60 px-2.5 py-1 text-[7.5px] font-extrabold uppercase tracking-wide text-slate-400">
          <span>Educator</span><span>Reg</span><span>OT</span><span>Vac accr.</span><span>Gross</span>
        </div>
        {rows.map(([n, role, em, reg, ot, vac, g], i) => (
          <motion.div key={n} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
            className="grid grid-cols-[1fr_repeat(4,auto)] items-center gap-x-3 border-b border-line/60 px-2.5 py-1.5 last:border-0">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-400 to-grape-500 text-[10px]">{em}</span>
              <span className="min-w-0">
                <span className="block truncate text-[9px] font-extrabold leading-tight text-slate-700">{n}</span>
                <span className="block text-[7px] font-bold text-slate-400">{role}</span>
              </span>
            </span>
            <span className="text-[9px] font-bold text-slate-600">{reg}h</span>
            <span className={`text-[9px] font-bold ${ot ? 'text-sunshine-600' : 'text-slate-300'}`}>{ot ? `${ot}h` : '—'}</span>
            <span className="text-[9px] font-bold text-mint-600">{vac}</span>
            <span className="text-[9.5px] font-extrabold text-slate-800">{g}</span>
          </motion.div>
        ))}
        <div className="flex items-center justify-between bg-slate-50/60 px-2.5 py-1.5">
          <span className="text-[8px] font-extrabold uppercase tracking-wide text-slate-400">Totals · 4 educators</span>
          <span className="flex items-center gap-2">
            <span className="text-[8.5px] font-bold text-mint-600">$305.68 vac</span>
            <span className="font-display text-sm text-brand-700"><CountUp to={6892} prefix="$" /></span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="rounded-full bg-brand-600 px-2.5 py-1 text-[8.5px] font-bold text-white">Generate stubs</span>
        <span className="rounded-full bg-white px-2.5 py-1 text-[8.5px] font-bold text-slate-500 shadow-sm">CSV ↓</span>
        <span className="ml-auto truncate text-[8px] font-bold text-grape-600">🔒 new-hire onboarding: SIN & banking encrypted, by link</span>
      </div>
    </div>
  )
}

function DeskEnroll() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 rounded-xl bg-white p-2 shadow-sm">
        {[['Inquiries', 9], ['Tours booked', 5], ['Offers out', 2], ['Enrolled', 3]].map(([l, n], i, a) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className="rounded-lg bg-slate-50 px-2 py-1 text-center">
              <span className="block text-[13px] font-extrabold leading-none text-brand-700">{n}</span>
              <span className="block text-[6.5px] font-bold uppercase tracking-wide text-slate-400">{l}</span>
            </span>
            {i < a.length - 1 && <span className="text-[10px] text-slate-300">→</span>}
          </span>
        ))}
        <span className="ml-auto rounded-full bg-mint-400/15 px-2 py-1 text-[8px] font-extrabold text-mint-600">this month</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white p-2.5 shadow-sm">
          <div className="mb-1.5 text-[8.5px] font-extrabold uppercase tracking-wide text-slate-400">Capacity</div>
          <div className="space-y-1.5">
            <DeskBar thin label="Sunbeams (0–3)" pct={100} money="8/8 full" color="bg-gradient-to-r from-mint-400 to-mint-500" />
            <DeskBar thin label="Explorers (3–5)" pct={88} money="7/8 · 1 spot" color="bg-gradient-to-r from-brand-400 to-brand-500" delay={0.08} />
            <DeskBar thin label="Navigators (OSC)" pct={67} money="4/6 · 2 spots" color="bg-gradient-to-r from-sunshine-400 to-coral-500" delay={0.16} />
          </div>
          <div className="mt-1.5 rounded-lg bg-sunshine-400/10 px-1.5 py-1 text-[7.5px] font-bold text-sunshine-700">3 open spots ≈ $3,300/mo unfilled revenue</div>
        </div>
        <div className="rounded-xl bg-white p-2.5 shadow-sm">
          <div className="mb-1.5 text-[8.5px] font-extrabold uppercase tracking-wide text-slate-400">Waitlist · 6</div>
          <div className="space-y-1">
            {[['Theo M.', '14 mo', 'fits Sunbeams in Jan'], ['Aria K.', '3 yr', 'fits Explorers now'], ['Jun P.', '4 yr', 'fits Explorers now']].map(([n, a, fit]) => (
              <div key={n} className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[9px] font-extrabold leading-tight text-slate-700">{n} <span className="font-bold text-slate-400">· {a}</span></span>
                  <span className="block truncate text-[7px] font-bold text-mint-600">{fit}</span>
                </span>
                <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[7.5px] font-extrabold text-brand-600">Offer spot</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-brand-50 p-2">
        <Link2 size={11} className="shrink-0 text-brand-500" />
        <span className="truncate font-mono text-[8.5px] font-bold text-brand-700">mitten.care/yourdaycare</span>
        <span className="text-[7.5px] font-semibold text-slate-400">families join themselves</span>
        <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[8px] font-bold text-brand-600 shadow-sm">Copy</span>
      </div>
    </div>
  )
}

function DeskFamilies() {
  const kids = [
    { img: PX(7605825, 80), n: 'Mia Rodriguez', r: 'Sunbeams', al: 'peanuts', t: '$1,250', last: '2:10 PM · nap 1h 20m' },
    { img: PX(8364641, 80), n: 'Noah Patel', r: 'Explorers', al: null, t: '$1,100', last: '1:45 PM · 3 photos' },
    { img: PX(8363102, 80), n: 'Liam Brooks', r: 'Navigators', al: 'dairy', t: '$640 + plan', last: '12:05 PM · lunch' },
    { img: PX(8613089, 80), n: 'Nora Wilson', r: 'Explorers', al: null, t: '$1,100', last: '11:30 AM · milestone ⭐' },
  ]
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {[['18', 'families'], ['94%', 'tuition set'], ['3', 'allergies tracked'], ['100%', 'parents linked']].map(([v, l]) => (
          <span key={l} className="flex-1 rounded-xl bg-white px-2 py-1.5 text-center shadow-sm">
            <span className="block text-[13px] font-extrabold leading-none text-brand-700">{v}</span>
            <span className="block text-[6.5px] font-bold uppercase tracking-wide text-slate-400">{l}</span>
          </span>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 border-b border-line bg-slate-50/60 px-2.5 py-1 text-[7.5px] font-extrabold uppercase tracking-wide text-slate-400">
          <span>Child</span><span>Allergies</span><span>Tuition</span><span>Last update</span>
        </div>
        {kids.map((k, i) => (
          <motion.div key={k.n} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
            className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 border-b border-line/60 px-2.5 py-1.5 last:border-0">
            <span className="flex min-w-0 items-center gap-1.5">
              <img src={k.img} alt="" loading="lazy" className="h-5 w-5 shrink-0 rounded-md object-cover" />
              <span className="min-w-0">
                <span className="block truncate text-[9px] font-extrabold leading-tight text-slate-700">{k.n}</span>
                <span className="block text-[7px] font-bold text-slate-400">{k.r} · parent linked ✓</span>
              </span>
            </span>
            <span>{k.al ? <span className="rounded-full bg-coral-400/15 px-1.5 py-px text-[7.5px] font-extrabold text-coral-600">{k.al}</span> : <span className="text-[8px] text-slate-300">—</span>}</span>
            <span className="text-[9px] font-extrabold text-slate-700">{k.t}</span>
            <span className="text-[7.5px] font-bold text-slate-400">{k.last}</span>
          </motion.div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-grape-500/10 px-2.5 py-1.5 text-[8.5px] font-bold text-grape-600">
        <span>📋 Intake desk: paper form → AI fills this roster + creates the parent login</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[8px] font-extrabold shadow-sm">Scan a form</span>
      </div>
    </div>
  )
}

function DirectorShowcase() {
  const [tab, setTab] = useState(0)
  const manualAt = useRef(0)
  useEffect(() => {
    const t = setInterval(() => {
      if (Date.now() - manualAt.current > 9000) setTab((p) => (p + 1) % DESK_TABS.length)
    }, 4500)
    return () => clearInterval(t)
  }, [])
  const pick = (i) => { manualAt.current = Date.now(); setTab(i) }
  const active = DESK_TABS[tab]
  const Pane = [DeskDash, DeskProfit, DeskPayroll, DeskEnroll, DeskFamilies][tab]

  return (
    <section id="directors" className="bg-tint">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <motion.div {...fade()} className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">For directors &amp; owners</p>
          <h2 className="mt-2 text-4xl text-brand-700 sm:text-5xl">The business side, on one screen.</h2>
          <p className="mt-4 text-lg font-medium text-slate-500">
            Parents live in the app on their phones — you run the academy from a real desktop dashboard.
            <span className="font-bold text-brand-600"> Click through a director's day:</span>
          </p>
        </motion.div>

        {/* Tab pills */}
        <motion.div {...fade(0.08)} className="mt-8 flex flex-wrap justify-center gap-2">
          {DESK_TABS.map((t, i) => (
            <button key={t.id} onClick={() => pick(i)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all ${i === tab ? 'bg-brand-600 text-white shadow-md' : 'bg-white text-slate-500 hover:text-brand-600'}`}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </motion.div>

        {/* Laptop — true MacBook 16:10 screen ratio */}
        <motion.div {...fade(0.12)} className="mx-auto mt-8 max-w-3xl">
          <div className="rounded-t-2xl border-[10px] border-b-0 border-slate-900 bg-slate-900 shadow-2xl">
            <div className="flex aspect-[16/10] flex-col overflow-hidden rounded-t-lg bg-tint">
              {/* window chrome */}
              <div className="flex items-center gap-2 border-b border-line bg-white px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-coral-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-sunshine-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-mint-400" />
                <span className="mx-auto flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-0.5 font-mono text-[9px] font-bold text-slate-400">
                  <Lock size={9} /> mitten.care/app
                </span>
              </div>
              <div className="flex min-h-0 flex-1">
                {/* sidebar */}
                <div className="hidden w-36 shrink-0 flex-col gap-1 border-r border-line bg-white p-2 sm:flex">
                  <div className="mb-1 flex items-center gap-1.5 px-1.5 py-1">
                    <img src="/brand/mitten-mark.svg" alt="" className="h-5 w-5" />
                    <span className="font-display text-sm text-brand-700">Mitten</span>
                  </div>
                  {DESK_TABS.map((t, i) => (
                    <button key={t.id} onClick={() => pick(i)}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-bold transition ${i === tab ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                      <t.icon size={13} /> {t.label}
                    </button>
                  ))}
                  <div className="mt-auto rounded-lg bg-slate-50 px-2 py-1.5 text-[9px] font-bold text-slate-400">🏫 Sam · Director</div>
                </div>
                {/* content — keyed remount (no AnimatePresence: mode="wait" deadlocks under StrictMode) */}
                <div className="min-w-0 flex-1 overflow-hidden p-3.5">
                  <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                    <div className="mb-2.5 flex items-center justify-between">
                      <h3 className="font-display text-lg text-slate-800">{active.label}</h3>
                      <span className="font-mono text-[9px] uppercase tracking-wide text-slate-400">live · demo data</span>
                    </div>
                    <Pane />
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
          <div className="mx-auto h-3.5 w-[112%] -translate-x-[5.5%] rounded-b-2xl bg-gradient-to-b from-slate-800 to-slate-900 shadow-xl" />
          <motion.p key={`blurb-${tab}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto mt-5 max-w-xl text-center text-sm font-semibold text-slate-500">
            {active.blurb}
          </motion.p>
          <div className="mt-6 text-center">
            <a href="/app" className="btn-ghost px-6 py-2.5">Open the full live demo <ArrowRight size={16} /></a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ---------------- Trust bar ---------------- */
function TrustBar() {
  const items = [
    [ShieldCheck, 'Your data, never shared'],
    [DollarSign, 'Free for 5 kids · then $20/mo'],
    [Sparkles, 'Free custom features'],
    [ArrowRightLeft, 'Free data migration'],
    [Smartphone, 'No app store needed'],
    [Banknote, 'Payroll prep built in'],
    [Wand2, 'AI notes & recaps included'],
    [Lock, 'Encrypted staff onboarding'],
  ]
  const row = (key) => (
    <div key={key} className="flex shrink-0 items-center">
      {items.map(([Icon, label]) => (
        <span key={key + label} className="mx-6 inline-flex items-center gap-2 whitespace-nowrap text-sm font-bold text-slate-600">
          <Icon size={16} className="text-brand-500" /> {label}
        </span>
      ))}
    </div>
  )
  return (
    <section className="overflow-hidden border-y border-line bg-white py-5" aria-label="Mitten highlights">
      <div className="marquee-track">{row('a')}{row('b')}</div>
    </section>
  )
}

/* ---------------- Privacy ---------------- */
function Privacy() {
  const points = [
    [Server, 'Your own private instance', 'Each facility runs on its own isolated database. Your families’ information never sits in a shared pool with other centers.'],
    [Ban, 'Never sold. Never shared. Never trained on.', 'We don’t monetize your data, sell it to advertisers, or feed it to AI models. That’s written into your contract.'],
    [Download, 'You own it — export anytime', 'Full data export on demand, in open formats. No lock-in, no ransom. Leave with everything if you ever want to.'],
    [Lock, 'Built for compliance', 'Encryption in transit and at rest, role-based access, and audit logs — designed around child-data privacy from day one.'],
  ]
  return (
    <section id="privacy" className="bg-tint">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <motion.div {...fade()} className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Data sovereignty</p>
          <h2 className="mt-2 text-4xl text-brand-700 sm:text-5xl">Your data stays yours. Full stop.</h2>
          <p className="mt-4 text-lg font-medium text-slate-500">
            The biggest names sell convenience and quietly pool your families’ data. {BRAND} flips that:
            your information stays exclusively in your control.
          </p>
        </motion.div>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {points.map(([Icon, t, d], i) => (
            <motion.div {...fade(i * 0.06)} key={t} className="card flex gap-4 p-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-grape-500 text-white shadow-md">
                <Icon size={22} />
              </span>
              <div>
                <h3 className="text-xl text-slate-800">{t}</h3>
                <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500">{d}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------- Why switch ---------------- */
function WhySwitch() {
  const cards = [
    [DollarSign, 'A fraction of the price', 'Free for your first 5 children, then just $20/mo plus $2 per child — far less than the $4–6 per child the big platforms charge, and we never take a cut of your tuition payments.', 'from-mint-400 to-brand-500'],
    [Sparkles, 'Custom features — free', 'Need a specific form, report, or workflow? Just ask. We build features to fit how your facility actually runs, at no extra charge.', 'from-grape-400 to-grape-600'],
    [ArrowRightLeft, 'Free onboarding & migration', 'Switching from NestliCare, Brightwheel, Procare or paper? We move your children, families, billing and history across for you — free.', 'from-coral-400 to-blush-500'],
  ]
  return (
    <section id="why" className="bg-white">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <motion.div {...fade()} className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Why facilities switch</p>
          <h2 className="mt-2 text-4xl text-brand-700 sm:text-5xl">Everything the big platforms do — for less, and on your terms.</h2>
        </motion.div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {cards.map(([Icon, t, d, g], i) => (
            <motion.div {...fade(i * 0.08)} key={t} className="card p-7">
              <span className={`mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${g} text-white shadow-md`}>
                <Icon size={24} />
              </span>
              <h3 className="text-2xl text-slate-800">{t}</h3>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">{d}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------- Whitelabel (live re-branding phone) ---------------- */
const WL_BRANDS = [
  { name: 'Sunshine Kids', mark: '🌞', domain: 'sunshinekids.app', g: 'from-sunshine-400 to-coral-500', soft: 'bg-sunshine-400/15', ink: 'text-coral-600', ring: 'ring-coral-300' },
  { name: 'Little Pines', mark: '🌲', domain: 'littlepines.app', g: 'from-mint-400 to-brand-500', soft: 'bg-mint-400/15', ink: 'text-mint-600', ring: 'ring-mint-400' },
  { name: 'Pacific Coast', mark: '🌊', domain: 'pacificcoast.app', g: 'from-brand-400 to-grape-500', soft: 'bg-brand-50', ink: 'text-brand-600', ring: 'ring-sky-300' },
  { name: 'Your Academy', mark: '✨', domain: 'youracademy.app', g: 'from-blush-400 to-grape-500', soft: 'bg-blush-300/20', ink: 'text-grape-600', ring: 'ring-blush-300' },
]

function BrandedScreen({ b }) {
  return (
    <div className="relative h-full bg-tint">
      <ScreenTop title="" />
      {/* brand header */}
      <div className="flex items-center gap-1.5 px-3 pb-2">
        <motion.span key={`mark-${b.name}`} initial={{ scale: 0.4, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}
          className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${b.g} text-sm shadow-md`}>{b.mark}</motion.span>
        <motion.div key={`nm-${b.name}`} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="min-w-0">
          <div className="truncate font-display text-[13px] leading-none text-slate-800">{b.name}</div>
          <div className={`font-mono text-[6.5px] font-bold uppercase tracking-wider ${b.ink}`}>{b.domain}</div>
        </motion.div>
        <span className="ml-auto h-5 w-5 rounded-full bg-white shadow-sm" />
      </div>
      {/* hero card — gradient crossfades between brands */}
      <div className="relative mx-2.5 h-[88px] overflow-hidden rounded-2xl shadow-sm">
        <motion.div key={`hero-${b.name}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7 }} className={`absolute inset-0 bg-gradient-to-br ${b.g}`} />
        <div className="relative p-2.5 text-white">
          <div className="font-mono text-[7px] uppercase tracking-wider text-white/80">Good afternoon 👋</div>
          <div className="mt-0.5 font-display text-[15px] leading-tight">Nora is having<br />a great day!</div>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[7px] font-bold backdrop-blur"><Camera size={7} /> 4 new photos</span>
        </div>
      </div>
      {/* avatar row with brand ring */}
      <div className="mt-2 flex gap-1.5 px-3">
        {FEED_AVATARS.slice(0, 4).map((src, k) => (
          <div key={k} className={`h-8 w-8 shrink-0 rounded-full p-[1.5px] ring-2 transition-all duration-700 ${b.ring}`}>
            <img src={src} alt="" loading="lazy" className="h-full w-full rounded-full object-cover" />
          </div>
        ))}
        <motion.span key={`plus-${b.name}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-extrabold ${b.soft} ${b.ink}`}>+14</motion.span>
      </div>
      {/* feed card */}
      <div className="mx-2.5 mt-2 overflow-hidden rounded-2xl bg-white shadow-sm">
        <img src={PX(8364641, 320)} alt="" loading="lazy" className="h-[68px] w-full object-cover" />
        <div className="flex items-center gap-1 p-1.5 text-[7.5px] font-bold text-slate-500">
          Painting masterpieces 🎨
          <motion.span key={`like-${b.name}`} initial={{ scale: 0.5 }} animate={{ scale: 1 }} className={`ml-auto flex items-center gap-0.5 ${b.ink}`}><Heart size={8} className="fill-current" /> 6</motion.span>
        </div>
      </div>
      {/* dock with brand-tinted active tab */}
      <div className="absolute inset-x-2 bottom-2 flex items-stretch rounded-2xl border border-line bg-white/90 px-1 py-1 shadow-md backdrop-blur-md">
        {DOCK_ITEMS.map(({ id, Icon }, i) => (
          <div key={id} className={`flex flex-1 flex-col items-center gap-[1px] text-[7px] font-bold ${i === 0 ? b.ink : 'text-slate-400'}`}>
            <span className={`flex h-5 w-8 items-center justify-center rounded-[10px] transition-colors duration-500 ${i === 0 ? b.soft : ''}`}>
              <Icon size={12} strokeWidth={i === 0 ? 2.6 : 2} />
            </span>
            {id}
          </div>
        ))}
      </div>
    </div>
  )
}

function Whitelabel() {
  const bullets = ['Your logo, colors & academy name', 'Your own web address', 'Installs to the home screen — no app store', 'Families only ever see your brand, never ours']
  const [bi, setBi] = useState(0)
  const manualAt = useRef(0)
  useEffect(() => {
    const t = setInterval(() => {
      if (Date.now() - manualAt.current > 8000) setBi((p) => (p + 1) % WL_BRANDS.length)
    }, 2800)
    return () => clearInterval(t)
  }, [])
  const b = WL_BRANDS[bi]
  return (
    <section className="overflow-hidden bg-tint">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 md:grid-cols-2">
        <motion.div {...fade()}>
          <p className="eyebrow flex items-center gap-2"><Palette size={13} /> Whitelabel</p>
          <h2 className="mt-2 text-4xl text-brand-700 sm:text-5xl">It’s your app. We just build &amp; run it.</h2>
          <p className="mt-4 text-lg font-medium text-slate-500">
            {BRAND} is invisible. Parents open <em>your</em> academy’s app, see <em>your</em> brand, and trust <em>you</em> with their child’s day.
            Watch the same app wear four different daycares <ArrowRight size={15} className="inline text-brand-400" />
          </p>
          <ul className="mt-6 space-y-3">
            {bullets.map((bl) => (
              <li key={bl} className="flex items-center gap-3 font-semibold text-slate-600">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-mint-400/20 text-mint-500"><Check size={14} /></span>
                {bl}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div {...fade(0.1)} className="flex flex-col items-center">
          <div className="relative">
            {/* brand-tinted glow behind the phone */}
            <motion.div key={`glow-${b.name}`} initial={{ opacity: 0 }} animate={{ opacity: 0.55 }} transition={{ duration: 0.8 }}
              className={`absolute -inset-8 rounded-full bg-gradient-to-br ${b.g} blur-3xl`} />
            <div className="bob-slower relative">
              <Phone><BrandedScreen b={b} /></Phone>
            </div>
            {/* floating chips */}
            <motion.span key={`chipA-${b.name}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="absolute -left-16 top-12 hidden rounded-2xl border border-white/70 bg-white/80 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 shadow-md backdrop-blur sm:block">
              <Globe size={10} className={`mr-1 inline ${b.ink}`} /> {b.domain}
            </motion.span>
            <span className="absolute -right-14 bottom-20 hidden rounded-2xl border border-white/70 bg-white/80 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 shadow-md backdrop-blur sm:block">
              <Smartphone size={10} className="mr-1 inline text-mint-500" /> No app store
            </span>
          </div>
          {/* brand picker */}
          <div className="relative mt-6 flex flex-wrap justify-center gap-2">
            {WL_BRANDS.map((br, i) => (
              <button key={br.name} onClick={() => { manualAt.current = Date.now(); setBi(i) }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${i === bi ? `bg-gradient-to-r ${br.g} text-white shadow-md scale-105` : 'bg-white text-slate-500 border border-line'}`}>
                {br.mark} {br.name}
              </button>
            ))}
          </div>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">same app · your brand in one tap</p>
        </motion.div>
      </div>
    </section>
  )
}

/* ---------------- Audience ---------------- */
/* ---------------- Impact (time saved / money) ---------------- */
function CountUp({ to, prefix = '', suffix = '', dur = 1300 }) {
  const [n, setN] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        const start = performance.now()
        const tick = (t) => {
          const p = Math.min(1, (t - start) / dur)
          setN(Math.round(to * (1 - Math.pow(1 - p, 3))))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
        io.disconnect()
      }
    }, { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [to, dur])
  return <span ref={ref}>{prefix}{n.toLocaleString()}{suffix}</span>
}

function Bar({ pct, color, delay = 0, horizontal = false }) {
  const common = { viewport: { once: true }, transition: { duration: 0.9, delay, ease: 'easeOut' } }
  if (horizontal) {
    return (
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <motion.div initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} {...common} className={`h-full rounded-full ${color}`} />
      </div>
    )
  }
  return (
    <div className="flex h-28 w-10 items-end overflow-hidden rounded-xl bg-slate-100">
      <motion.div initial={{ height: 0 }} whileInView={{ height: `${pct}%` }} {...common} className={`w-full rounded-xl ${color}`} />
    </div>
  )
}

function Impact() {
  return (
    <section className="bg-tint">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <motion.div {...fade()} className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">The payoff</p>
          <h2 className="mt-2 text-4xl text-brand-700 sm:text-5xl">Less admin. Lower bills. More kept.</h2>
          <p className="mt-4 text-lg font-medium text-slate-500">What switching to {BRAND} looks like for a typical 40-child center.</p>
        </motion.div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {/* Hours saved */}
          <motion.div {...fade(0.05)} className="card p-7">
            <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-mint-400 to-brand-500 text-white shadow-md"><Clock size={22} /></span>
            <h3 className="text-2xl text-slate-800">Hours back</h3>
            <p className="mt-1 text-sm font-medium text-slate-500">Digital attendance, billing, reports &amp; messaging replace the paperwork.</p>
            <div className="mt-5 flex items-end gap-5">
              <div className="text-center">
                <Bar pct={100} color="bg-coral-300" />
                <div className="mt-2 text-[11px] font-bold text-slate-400">Manual<br />~30h/mo</div>
              </div>
              <div className="text-center">
                <Bar pct={34} color="bg-gradient-to-t from-brand-500 to-mint-400" delay={0.25} />
                <div className="mt-2 text-[11px] font-bold text-brand-600">Mitten<br />~10h/mo</div>
              </div>
              <div className="ml-auto text-right">
                <div className="font-display text-4xl text-mint-500"><CountUp to={20} suffix="h" /></div>
                <div className="text-xs font-bold uppercase tracking-wide text-slate-400">saved / month</div>
              </div>
            </div>
          </motion.div>

          {/* Software bill */}
          <motion.div {...fade(0.1)} className="card p-7">
            <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-grape-500 text-white shadow-md"><DollarSign size={22} /></span>
            <h3 className="text-2xl text-slate-800">Far lower bill</h3>
            <p className="mt-1 text-sm font-medium text-slate-500">$20/mo + $2/child vs ~$4/child on comparable platforms.</p>
            <div className="mt-6 space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-xs font-bold text-slate-400"><span>Comparable</span><span>$160/mo</span></div>
                <Bar pct={100} color="bg-coral-300" horizontal />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs font-bold text-brand-600"><span>Mitten</span><span>$88/mo</span></div>
                <Bar pct={55} color="bg-gradient-to-r from-brand-500 to-grape-500" horizontal delay={0.2} />
              </div>
            </div>
            <div className="mt-5 text-right">
              <div className="font-display text-4xl text-brand-600"><CountUp to={864} prefix="$" /></div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">saved / year</div>
            </div>
          </motion.div>

          {/* Tuition kept */}
          <motion.div {...fade(0.15)} className="card flex flex-col p-7">
            <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sunshine-400 to-coral-500 text-white shadow-md"><CreditCard size={22} /></span>
            <h3 className="text-2xl text-slate-800">Tuition you keep</h3>
            <p className="mt-1 text-sm font-medium text-slate-500">Others skim 2–3% off every payment. We take <span className="font-bold text-mint-500">0%</span>.</p>
            <div className="mt-auto pt-6 text-center">
              <div className="font-display text-5xl text-mint-500"><CountUp to={7500} prefix="$" suffix="+" /></div>
              <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">kept / year on payment fees</div>
              <div className="mt-2 text-[11px] font-semibold text-slate-400">(on ~$25k monthly tuition)</div>
            </div>
          </motion.div>
        </div>

        <motion.p {...fade(0.2)} className="mt-8 text-center text-sm font-semibold text-slate-400">
          Most facilities clear their setup cost in the first few months — then it’s money back, every month.
        </motion.p>
      </div>
    </section>
  )
}

function Audience() {
  const groups = [
    [Heart, 'Parents', 'from-blush-300 to-blush-500', ['Live daily reports & photos', 'AI "day in a glance" recaps', 'Milestones & Memory Book', 'Message teachers', 'Pay tuition in a tap']],
    [GraduationCap, 'Educators', 'from-brand-400 to-brand-600', ['One-tap attendance', 'Log meals, naps & activities', 'AI-drafted parent notes', 'Calm Corner kids’ breathing', 'Lesson plans, hour by hour']],
    [Building2, 'Directors', 'from-sky-400 to-brand-500', ['Profitability per room', 'Payroll prep & pay stubs', 'Employee self-onboarding', 'Live staff time tracking', 'Enrollment & tuition']],
  ]
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <motion.div {...fade()} className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">One app, three experiences</p>
          <h2 className="mt-2 text-4xl text-brand-700 sm:text-5xl">Loved by everyone in your building.</h2>
        </motion.div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {groups.map(([Icon, t, g, items], i) => (
            <motion.div {...fade(i * 0.08)} key={t} className="card p-7">
              <span className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${g} text-white shadow-md`}><Icon size={22} /></span>
              <h3 className="text-2xl text-slate-800">{t}</h3>
              <ul className="mt-3 space-y-2">
                {items.map((it) => (
                  <li key={it} className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                    <Check size={15} className="text-mint-500" /> {it}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------- Migration ---------------- */
function Migration() {
  const steps = [
    ['1', 'Quick audit', 'We look at your current setup and what data you have — wherever it lives today.'],
    ['2', 'We migrate, free', 'Our team transfers children, families, billing, documents and history. You don’t lift a finger.'],
    ['3', 'Go live in days', 'Your branded app launches to staff and parents, with hands-on onboarding included.'],
  ]
  return (
    <section id="migrate" className="bg-tint">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <motion.div {...fade()} className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Switching is easy</p>
          <h2 className="mt-2 text-4xl text-brand-700 sm:text-5xl">From your old app to yours — for free.</h2>
        </motion.div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map(([n, t, d], i) => (
            <motion.div {...fade(i * 0.08)} key={n} className="relative card p-7">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 font-display text-xl text-white">{n}</span>
              <h3 className="text-xl text-slate-800">{t}</h3>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">{d}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------- Pricing ---------------- */
// ---- Pricing knobs (change here to reprice everything) ----
const FREE_LIMIT = 5 // free while ramping up
const BASE_PRICE = 20 // $/mo at the first billable child (the 6th)
const PER_CHILD = 2 // +$/mo per child beyond the 6th
const COMPETITOR = 4 // benchmark comparable-platform $/child/mo
const YEARLY_MONTHS = 10 // pay for 10 months when annual → 2 months free
// Mirrors convex/lib.ts monthlyCents: free ≤5, then $20 base + $2/child after.
const baseMonthlyFor = (k) => (k <= FREE_LIMIT ? 0 : BASE_PRICE + (k - (FREE_LIMIT + 1)) * PER_CHILD)
const fmt = (n) => '$' + Math.round(n).toLocaleString()

function Pricing() {
  const [kids, setKids] = useState(40)
  const [yearly, setYearly] = useState(false)
  const baseMonthly = baseMonthlyFor(kids)
  const effMonthly = yearly ? (baseMonthly * YEARLY_MONTHS) / 12 : baseMonthly
  const perYear = yearly ? baseMonthly * YEARLY_MONTHS : baseMonthly * 12
  const compMonthly = kids * COMPETITOR
  const saveMonthly = compMonthly - effMonthly
  const savePct = Math.round((saveMonthly / compMonthly) * 100)

  return (
    <section id="pricing" className="bg-white">
      <div className="mx-auto max-w-5xl px-5 py-20">
        <motion.div {...fade()} className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Pricing</p>
          <h2 className="mt-2 text-4xl text-brand-700 sm:text-5xl">Free to start. Simple as you grow.</h2>
          <p className="mt-4 text-lg font-medium text-slate-500">
            Comparable platforms charge about <span className="font-bold text-slate-600">$4–6 per enrolled child</span> a month
            (Brightwheel-class runs $5–7) and take a cut of every payment. {BRAND} is{' '}
            <span className="font-bold text-brand-600">free for your first 5 children</span>, then a simple{' '}
            <span className="font-bold text-brand-600">$20/mo + $2 per child</span> after that — always a fraction of the big platforms, and never a cut of your tuition.
          </p>
        </motion.div>

        {/* Billing toggle */}
        <div className="mt-8 flex justify-center">
          <div className="inline-flex items-center rounded-2xl bg-slate-100 p-1">
            {[['monthly', 'Monthly'], ['yearly', 'Yearly']].map(([id, label]) => (
              <button key={id} onClick={() => setYearly(id === 'yearly')}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold transition ${(yearly ? 'yearly' : 'monthly') === id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>
                {label}
                {id === 'yearly' && <span className="rounded-full bg-mint-400/20 px-2 py-0.5 text-[10px] font-extrabold text-mint-500">2 months free</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Live calculator */}
          <motion.div {...fade(0.05)} className="card p-7">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Your price</p>
              <span className="pill bg-brand-50 text-brand-700">${BASE_PRICE} base · +${PER_CHILD}/child</span>
            </div>
            <label className="mt-3 block text-sm font-bold text-slate-600">
              Enrolled children: <span className="text-brand-600">{kids}</span>
            </label>
            <input type="range" min="6" max="220" step="1" value={kids} onChange={(e) => setKids(+e.target.value)} className="mt-3 w-full accent-brand-500" />
            <div className="mt-6 flex items-end gap-2">
              <span className="font-display text-6xl text-brand-700">{fmt(effMonthly)}</span>
              <span className="mb-1.5 text-lg font-bold text-slate-400">/month</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-400">
              {kids <= FREE_LIMIT + 1 ? `$${BASE_PRICE}/mo for your first ${FREE_LIMIT + 1} children` : `$${BASE_PRICE} base + $${PER_CHILD} × ${kids - (FREE_LIMIT + 1)} more children`}
              {yearly ? ` · billed ${fmt(perYear)}/year` : ' · cancel anytime'}
            </p>
            <div className="mt-5 rounded-2xl bg-mint-400/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
                <span className="text-slate-500">Comparable ≈ <span className="line-through decoration-coral-400/60">{fmt(compMonthly)}/mo</span></span>
                <span className="text-mint-500">You save ~{fmt(saveMonthly)}/mo · {savePct}%</span>
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-400">≈ {fmt(saveMonthly * 12)} kept every year{yearly ? ' (yearly plan included)' : ''}</div>
            </div>
          </motion.div>

          {/* Volume tiers + included */}
          <motion.div {...fade(0.12)} className="overflow-hidden rounded-4xl border border-line shadow-card">
            <div className="bg-gradient-to-br from-brand-50 to-blush-100 p-6">
              <p className="eyebrow text-brand-600">How pricing works</p>
              <div className="mt-3 space-y-1.5">
                <div className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-bold ${kids <= FREE_LIMIT ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>
                  <span>Your first {FREE_LIMIT} children</span>
                  <span className="text-mint-500">Free</span>
                </div>
                <div className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-bold ${kids === FREE_LIMIT + 1 ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>
                  <span>Child #{FREE_LIMIT + 1}</span>
                  <span>${BASE_PRICE}<span className="text-xs font-semibold text-slate-400">/mo</span></span>
                </div>
                <div className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-bold ${kids > FREE_LIMIT + 1 ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>
                  <span>Each child after</span>
                  <span>+${PER_CHILD}<span className="text-xs font-semibold text-slate-400">/mo each</span></span>
                </div>
              </div>
            </div>
            <div className="p-6">
              <ul className="space-y-2.5 text-sm font-bold text-slate-600">
                {['Unlimited educators & admins', 'No cut of your tuition payments', 'Custom features included', 'Free migration & onboarding', 'Your own private instance', `Free up to ${FREE_LIMIT} kids · then $${BASE_PRICE}/mo + $${PER_CHILD}/child`].map((f) => (
                  <li key={f} className="flex items-center gap-2"><Check size={15} className="text-mint-500" /> {f}</li>
                ))}
              </ul>
              <a href="/signup" className="btn-primary mt-5 w-full">Start free — no card needed</a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* ---------------- FAQ ---------------- */
const FAQS = [
  ['Do I need a credit card to start?', 'No. Mitten is completely free while you have 5 or fewer children enrolled — no card, no trial clock. We only ask for a card at the moment you enroll your 6th child, and you see the exact monthly price before confirming anything.'],
  ['How long does setup actually take?', 'Minutes, genuinely. Create your daycare, add your children, and share one link with families and staff — they join themselves. No sales call, no onboarding sessions, no CSV imports.'],
  ['Do parents have to download an app?', 'No app store needed. Parents open your link and add Mitten to their home screen — it looks and feels like a native app, with none of the download friction.'],
  ['Does Mitten take a cut of tuition payments?', 'Never. If you collect tuition by card through Mitten, 100% of standard processing goes to the processor and 0% to us — unlike platforms that skim 2–3% of every payment.'],
  ['What happens to our data if we ever leave?', 'It’s yours. Full export anytime, in open formats. We never sell or share your families’ information — that’s in writing in our terms.'],
  ['Can you migrate us from Brightwheel, HiMama or paper?', 'Yes — free. We move your roster and families across, and because parents join by link, the switch usually takes one afternoon.'],
]

function FAQSection() {
  const [open, setOpen] = useState(0)
  return (
    <section id="faq" className="bg-tint">
      <div className="mx-auto max-w-3xl px-5 py-20">
        <motion.div {...fade()} className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Questions</p>
          <h2 className="mt-2 text-4xl text-brand-700 sm:text-5xl">Asked by every owner. Answered honestly.</h2>
        </motion.div>
        <motion.div {...fade(0.08)} className="mt-10 space-y-3">
          {FAQS.map(([q, a], i) => {
            const isOpen = open === i
            return (
              <div key={q} className={`card overflow-hidden transition-shadow ${isOpen ? 'shadow-playful' : ''}`}>
                <button onClick={() => setOpen(isOpen ? -1 : i)} className="flex w-full items-center gap-3 p-5 text-left">
                  <span className="flex-1 text-lg font-extrabold text-slate-800">{q}</span>
                  <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.25 }} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isOpen ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <ChevronDown size={17} />
                  </motion.span>
                </button>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} transition={{ duration: 0.28, ease: 'easeOut' }}>
                    <p className="px-5 pb-5 text-[15px] font-medium leading-relaxed text-slate-500">{a}</p>
                  </motion.div>
                )}
              </div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}

/* ---------------- Contact ---------------- */
function Contact() {
  const [sent, setSent] = useState(false)
  return (
    <section id="demo" className="bg-tint">
      <div className="mx-auto max-w-3xl px-5 py-20">
        <motion.div {...fade()} className="card overflow-hidden p-0">
          <div className="bg-gradient-to-br from-brand-500 via-brand-600 to-grape-600 p-8 text-center text-white">
            <h2 className="text-4xl">Book a 20-minute demo</h2>
            <p className="mt-2 font-medium text-white/85">See your own branded app — and get a free migration plan from your current software.</p>
          </div>
          <div className="p-7">
            {sent ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mint-400/15 text-mint-500"><Check size={30} /></span>
                <h3 className="text-2xl text-slate-800">Thank you! 🎉</h3>
                <p className="font-medium text-slate-500">We’ll reach out within one business day to schedule your demo.</p>
              </div>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); setSent(true) }}
                className="grid gap-4 sm:grid-cols-2"
              >
                <Field label="Your name"><input required className="input" placeholder="Jane Doe" /></Field>
                <Field label="Facility name"><input required className="input" placeholder="Sunshine Daycare" /></Field>
                <Field label="Email"><input required type="email" className="input" placeholder="jane@facility.com" /></Field>
                <Field label="Current software"><input className="input" placeholder="NestliCare / Brightwheel / paper…" /></Field>
                <div className="sm:col-span-2">
                  <button type="submit" className="btn-primary w-full py-3 text-base">Request my demo <ArrowRight size={18} /></button>
                  <p className="mt-3 text-center text-xs font-medium text-slate-400">No commitment. We’ll bring a migration plan for your data.</p>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
function Field({ label, children }) {
  return (
    <label className="block">
      <span className="eyebrow mb-1.5 block">{label}</span>
      {children}
    </label>
  )
}

/* ---------------- Footer ---------------- */
function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-10 text-center">
        <div className="flex items-center gap-2">
          <img src="/brand/mitten-mark.svg" alt="Mitten" className="h-8 w-8" />
          <span className="font-display text-xl text-white">{BRAND}</span>
        </div>
        <p className="max-w-md text-sm font-medium text-slate-400">
          Private, whitelabel childcare apps. Your families’ data stays exclusively in your control — never sold, never shared.
        </p>
        <div className="flex flex-wrap justify-center gap-5 text-sm font-semibold">
          <a href="/signup" className="hover:text-white">Start free</a>
          <a href="/app" className="hover:text-white">Live demo</a>
          <a href="#pricing" className="hover:text-white">Pricing</a>
          <a href="/resources" className="hover:text-white">Free tools & guides</a>
          <a href="/terms" className="hover:text-white">Terms</a>
          <a href="/privacy" className="hover:text-white">Privacy</a>
          <a href="#demo" className="hover:text-white">Book a demo</a>
        </div>
        <p className="max-w-md text-xs font-medium text-slate-500">
          Mitten · 83–7947 209 St, Langley, BC V2Y 0Y6 ·{' '}
          <a href="mailto:info@oktd.ca" className="underline hover:text-white">info@oktd.ca</a>
          <br />Prefer not to hear from us? Reply STOP to any text, or email us to opt out.
        </p>
        <p className="text-xs font-medium text-slate-500">© 2026 {BRAND} · The platform behind Pacific Coast Childcare Academy</p>
      </div>
    </footer>
  )
}
