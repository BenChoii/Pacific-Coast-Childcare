#!/usr/bin/env node
// Static SEO content generator — runs after `vite build` and writes real,
// crawlable HTML pages into dist/: guides, competitor guides, free tools, a
// resources hub, and sitemap.xml. Real HTML (not the SPA) so Google can rank it.
//
// Add a guide: append to GUIDES. Add a competitor: append to COMPETITORS.
// Swap DOMAIN when the custom domain is purchased (one line).

import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const DOMAIN = 'https://mitten.care' // custom domain (keep in sync with public/robots.txt)
const CONVEX_SITE = 'https://glad-rooster-439.convex.site' // prod Convex HTTP actions (AI tool endpoint)
const TODAY = new Date().toISOString().slice(0, 10)

/* ───────────────────────────── shared chrome ───────────────────────────── */

const CSS = `
:root{--ink:#0E4E80;--brand:#0E74C1;--brand-50:#EAF4FB;--slate:#334155;--slate-4:#94a3b8;--slate-5:#64748b;--line:#e2e8f0;--mint:#2eb88a;--coral:#e8604c;--tint:#F4F8FB;--grape:#7c5cbf}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{margin:0;font-family:'Geist',ui-sans-serif,system-ui,-apple-system,sans-serif;color:var(--slate);background:#fff;line-height:1.65;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:'Instrument Serif',Georgia,serif;font-weight:400;letter-spacing:-.01em;color:var(--ink);line-height:1.15}
h1{font-size:clamp(2rem,5vw,3rem);margin:.4em 0 .3em}
h2{font-size:clamp(1.5rem,3.4vw,2rem);margin:1.6em 0 .4em}
h3{font-size:1.25rem;margin:1.3em 0 .3em}
p,li{font-size:1.02rem}
a{color:var(--brand)}
.eyebrow{font-family:'Geist Mono',monospace;font-size:.68rem;letter-spacing:.18em;text-transform:uppercase;color:var(--slate-4);font-weight:500}
.aurora{background:radial-gradient(55rem 55rem at 12% -8%,rgba(191,216,230,.55),transparent 55%),radial-gradient(48rem 48rem at 100% 4%,rgba(242,198,204,.5),transparent 55%),linear-gradient(180deg,#fff,#F4F8FB)}
.wrap{max-width:46rem;margin:0 auto;padding:0 1.25rem}
.wrap-wide{max-width:64rem;margin:0 auto;padding:0 1.25rem}
nav.top{position:sticky;top:0;z-index:40;background:rgba(255,255,255,.72);backdrop-filter:blur(20px) saturate(1.6);-webkit-backdrop-filter:blur(20px) saturate(1.6);box-shadow:inset 0 -.5px 0 rgba(15,23,42,.12)}
nav.top .in{max-width:64rem;margin:0 auto;display:flex;align-items:center;gap:1.2rem;padding:.7rem 1.25rem}
nav.top a{font-size:.88rem;font-weight:600;color:var(--slate-5);text-decoration:none}
nav.top a:hover{color:var(--brand)}
nav.top .logo{display:flex;align-items:center;gap:.5rem;font-family:'Instrument Serif',serif;font-size:1.35rem;color:var(--ink);margin-right:auto}
nav.top img{height:30px;width:30px}
.btn{display:inline-flex;align-items:center;gap:.5rem;border-radius:999px;padding:.6rem 1.3rem;font-size:.9rem;font-weight:600;text-decoration:none;transition:.2s}
.btn-primary{background:var(--brand);color:#fff!important}
.btn-primary:hover{background:#8ec8ed;color:var(--ink)!important;transform:translateY(-2px)}
.btn-ghost{border:1px solid var(--line);background:#fff;color:var(--ink)!important}
.hero{padding:3.5rem 0 2.5rem;text-align:center}
.hero p.sub{max-width:38rem;margin:0 auto;color:var(--slate-5);font-size:1.08rem}
article{padding:1rem 0 3rem}
article ul,article ol{padding-left:1.3rem}
article li{margin:.35rem 0}
table{width:100%;border-collapse:collapse;margin:1.2rem 0;font-size:.92rem}
th,td{border:1px solid var(--line);padding:.6rem .75rem;text-align:left;vertical-align:top}
th{background:var(--tint);font-weight:700;color:var(--ink)}
.card{background:#fff;border:1px solid var(--line);border-radius:1.4rem;box-shadow:0 10px 30px -18px rgba(14,78,128,.25);padding:1.4rem}
.cta{background:linear-gradient(135deg,#0E74C1,#7c5cbf);color:#fff;border-radius:1.6rem;padding:1.8rem;margin:2.2rem 0}
.cta h3{color:#fff;margin-top:0}
.cta p{color:rgba(255,255,255,.92)}
.cta a.btn{background:#fff;color:var(--ink)!important}
.note{background:#FFF8E7;border:1px solid #F4D88A;border-radius:1rem;padding:.9rem 1.1rem;font-size:.92rem}
.grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))}
.tile{display:block;text-decoration:none;color:inherit;border:1px solid var(--line);border-radius:1.3rem;padding:1.2rem;background:#fff;transition:.18s;box-shadow:0 8px 24px -18px rgba(14,78,128,.25)}
.tile:hover{transform:translateY(-3px);border-color:#bcd9ee}
.tile h3{margin:.2rem 0 .3rem;font-size:1.15rem}
.tile p{font-size:.88rem;color:var(--slate-5);margin:0}
.tag{display:inline-block;border-radius:999px;background:var(--brand-50);color:var(--brand);font-size:.7rem;font-weight:700;padding:.18rem .65rem;margin-bottom:.4rem}
footer.site{background:#0f172a;color:#94a3b8;margin-top:3rem;padding:2.5rem 0;text-align:center;font-size:.85rem}
footer.site a{color:#cbd5e1;text-decoration:none;margin:0 .6rem}
footer.site a:hover{color:#fff}
.faq dt{font-weight:700;color:var(--ink);margin-top:1rem}
.faq dd{margin:0.3rem 0 0}
label.f{display:block;font-family:'Geist Mono',monospace;font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;color:var(--slate-4);margin:.9rem 0 .25rem}
input.f,select.f,textarea.f{width:100%;border:1px solid var(--line);background:var(--tint);border-radius:.8rem;padding:.7rem .9rem;font:inherit;font-size:.95rem;color:var(--slate)}
input.f:focus,select.f:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 4px rgba(14,116,193,.12)}
.result{background:var(--tint);border-radius:1.2rem;padding:1.2rem;margin-top:1.2rem}
.big{font-family:'Instrument Serif',serif;font-size:2.2rem;color:var(--brand)}
.bar{height:.7rem;border-radius:999px;background:#e2e8f0;overflow:hidden;margin:.3rem 0 .8rem}
.bar>span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#0E74C1,#7c5cbf);transition:width .6s ease}
.mono{font-family:'Geist Mono',monospace;font-size:.8rem}
.plan-output{white-space:pre-wrap;background:var(--tint);border-radius:1.2rem;padding:1.3rem;font-size:.95rem;display:none}
.spin{display:inline-block;width:1rem;height:1rem;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:sp 0.8s linear infinite;vertical-align:-2px}
@keyframes sp{to{transform:rotate(360deg)}}
@media print{nav.top,footer.site,.cta{display:none}}
`

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function layout({ path, title, desc, h1, sub, tag, body, jsonld = [], wide = false }) {
  const url = `${DOMAIN}${path}`
  const ld = jsonld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="article" /><meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" /><meta property="og:url" content="${url}" />
<meta property="og:site_name" content="Mitten" /><meta name="twitter:card" content="summary" />
<meta name="theme-color" content="#F4F8FB" />
<link rel="icon" type="image/svg+xml" href="/brand/mitten-mark.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
<style>${CSS}</style>
${ld}
</head>
<body>
<nav class="top"><div class="in">
<a class="logo" href="/"><img src="/brand/mitten-mark.svg" alt="Mitten" />Mitten</a>
<a href="/resources">Resources</a><a href="/resources#tools">Free tools</a><a href="/#pricing">Pricing</a><a href="/app">Live demo</a>
<a class="btn btn-primary" href="/signup">Start free</a>
</div></nav>
<div class="aurora"><div class="${wide ? 'wrap-wide' : 'wrap'} hero">
${tag ? `<span class="eyebrow">${esc(tag)}</span>` : ''}
<h1>${h1}</h1>
${sub ? `<p class="sub">${sub}</p>` : ''}
</div></div>
<main class="${wide ? 'wrap-wide' : 'wrap'}"><article>
${body}
</article></main>
<footer class="site"><div class="wrap-wide">
<p><strong style="color:#fff;font-family:'Instrument Serif',serif;font-size:1.2rem">Mitten</strong> — the childcare app built in BC. Free for your first 5 children.</p>
<p><a href="/">Home</a><a href="/resources">Resources</a><a href="/#pricing">Pricing</a><a href="/app">Live demo</a><a href="/signup">Start free</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a></p>
<p>Mitten · 83–7947 209 St, Langley, BC V2Y 0Y6 · <a href="mailto:info@oktd.ca">info@oktd.ca</a></p>
</div></footer>
</body></html>`
}

const cta = (line = 'Mitten does everything in this guide — daily reports, photos, messaging, billing, even payroll prep — free for your first 5 children, then just $20/mo + $2 per child.') => `
<div class="cta"><h3>Run your daycare on Mitten — free to start</h3>
<p>${line}</p>
<a class="btn" href="/signup">Start free — no card needed →</a>&nbsp;&nbsp;<a class="btn" style="background:rgba(255,255,255,.18);color:#fff!important" href="/app">See the live demo</a></div>`

const compareTable = (name, priceNote) => `
<h2>${esc(name)} vs Mitten at a glance</h2>
<table><tr><th></th><th>${esc(name)}</th><th>Mitten</th></tr>
<tr><td><strong>Price</strong></td><td>${priceNote} <em>(verify with the vendor — pricing changes)</em></td><td>Free ≤5 children, then <strong>$20/mo + $2/child</strong> (e.g. 20 kids ≈ $48/mo)</td></tr>
<tr><td><strong>Setup</strong></td><td>Sales call / demo, onboarding sessions</td><td>Self-serve — live in minutes, no call required</td></tr>
<tr><td><strong>Tuition payments</strong></td><td>Often takes a processing cut</td><td>0% platform cut</td></tr>
<tr><td><strong>Payroll prep</strong></td><td>Varies / add-on</td><td>Included — hours → gross pay + stubs</td></tr>
<tr><td><strong>AI daily notes & recaps</strong></td><td>Varies / premium</td><td>Included free</td></tr>
<tr><td><strong>Your data</strong></td><td>Stored on the vendor's terms</td><td>Never sold or shared; full export anytime; Canadian-built</td></tr>
<tr><td><strong>App store</strong></td><td>Parents download an app</td><td>No download — installs to the home screen</td></tr></table>`

const faqBlock = (faqs) => `
<h2>Frequently asked questions</h2><dl class="faq">
${faqs.map(([q, a]) => `<dt>${esc(q)}</dt><dd>${a}</dd>`).join('\n')}</dl>`

const faqLd = (faqs) => ({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') } })),
})
const articleLd = (path, title, desc) => ({
  '@context': 'https://schema.org', '@type': 'Article', headline: title, description: desc,
  datePublished: TODAY, dateModified: TODAY, url: `${DOMAIN}${path}`,
  author: { '@type': 'Organization', name: 'Mitten' }, publisher: { '@type': 'Organization', name: 'Mitten', url: DOMAIN },
})

/* ───────────────────────────── guides ───────────────────────────── */

const GUIDES = [
  {
    slug: 'daycare-taxes-canada',
    tag: 'Money & taxes',
    title: 'Daycare Taxes in Canada (2026 Guide): Deductions Every Provider Should Know',
    desc: 'What Canadian daycare and home childcare providers can deduct, how GST applies to childcare, payroll obligations, and the records CRA expects you to keep.',
    h1: 'Daycare taxes in Canada: what you can deduct',
    sub: 'A plain-English guide for home and centre-based providers — what counts, what doesn’t, and the records to keep.',
    faqs: [
      ['Is childcare GST/HST exempt in Canada?', 'Childcare services for children 14 and under are generally GST/HST-exempt, which means you don’t charge GST on tuition — but you also can’t claim input tax credits on related purchases. Confirm your situation with an accountant.'],
      ['Can I deduct part of my home for a home daycare?', 'Yes — business-use-of-home expenses (a reasonable share of rent or mortgage interest, utilities, insurance, maintenance) based on space and hours used for the daycare. CRA expects a defensible calculation, so keep your math.'],
      ['Do I need to issue receipts to parents?', 'Yes. Parents need receipts to claim child care expenses on their returns, and CRA expects providers to issue them — include your name, address, the amount, the child’s name, and for home providers, your SIN.'],
    ],
    body: `
<p>Running a daycare means you're a business in CRA's eyes — which is mostly good news, because a long list of everyday costs becomes deductible. Here's the practical version. <em>(Educational only, not tax advice — confirm specifics with an accountant.)</em></p>
<h2>Deductions most providers can claim</h2>
<ul>
<li><strong>Food and supplies</strong> — meals and snacks served to children, craft supplies, diapers/wipes, cleaning supplies.</li>
<li><strong>Toys & equipment</strong> — small items expense immediately; bigger purchases (playground structures, furniture, computers) are depreciated as capital cost allowance (CCA).</li>
<li><strong>Business-use-of-home</strong> (home daycares) — a share of rent or mortgage interest, utilities, property tax, insurance and maintenance, prorated by the space used and the hours children are present.</li>
<li><strong>Wages and payroll costs</strong> — staff pay plus the employer share of CPP and EI, and WorkSafeBC premiums in BC.</li>
<li><strong>Professional services & software</strong> — your accountant, licensing fees, training/ECE certification costs, and your childcare management software.</li>
<li><strong>Vehicle costs</strong> — the business share of trips for supplies, field trips, or training (keep a mileage log).</li>
</ul>
<h2>GST/HST: usually exempt</h2>
<p>Childcare for children 14 and under is generally <strong>GST/HST-exempt</strong>. You don't charge tax on tuition, you don't register for GST for the childcare itself, and you can't claim input tax credits on daycare purchases. If you sell something separate (e.g., renting your space out), different rules can apply.</p>
<h2>If you have employees: payroll obligations</h2>
<p>You must withhold income tax, CPP and EI from staff pay, remit them to CRA on schedule, pay the employer share, issue T4s each February, and (in BC) register with WorkSafeBC. See our full <a href="/guides/daycare-payroll-guide-canada">daycare payroll guide</a> — and note Mitten turns your staff's tracked hours into gross pay and pay stubs automatically.</p>
<h2>Records CRA expects</h2>
<ul><li>Receipts for every expense (photos are fine; keep 6 years)</li><li>Attendance records — they support your income figures <em>and</em> your business-use-of-home hours</li><li>Receipts issued to parents</li><li>A separate bank account makes everything cleaner</li></ul>
<p>Digital attendance and billing records make tax season dramatically easier — one export instead of a shoebox of paper.</p>`,
  },
  {
    slug: 'how-to-start-a-daycare-in-bc',
    tag: 'Starting up',
    title: 'How to Start a Daycare in BC (2026): Licensing, Costs & Step-by-Step',
    desc: 'The step-by-step path to opening a licensed daycare in British Columbia — licence types, health authority approval, costs, staffing rules, and your first families.',
    h1: 'How to start a daycare in BC',
    sub: 'Licence types, the approval process, realistic costs, and how to fill your first spots.',
    faqs: [
      ['How many children can I care for without a licence in BC?', 'Unlicensed (registered or unregistered) care in BC is limited to two children or a sibling group, not related to you. Anything more requires a community care facility licence.'],
      ['How long does daycare licensing take in BC?', 'Plan for several months — facility requirements, health authority review, inspections and staff credentials all take time. Starting the conversation with your health authority’s licensing officer early is the single best accelerator.'],
      ['What licence types exist in BC?', 'Common ones: Family Child Care (in your home, up to 7 children), Multi-Age Child Care (up to 8), In-Home Multi-Age (up to 8), Group Child Care (centres, by age band), and Preschool. Each has its own ratio, space, and staffing rules.'],
    ],
    body: `
<p>BC has some of Canada's strongest demand for childcare — most communities have long waitlists. Here's the realistic path from idea to open doors.</p>
<h2>1. Pick your licence type</h2>
<ul>
<li><strong>Family Child Care</strong> — in your own home, up to 7 children (mix-dependent). Lowest startup cost.</li>
<li><strong>Multi-Age / In-Home Multi-Age</strong> — up to 8 children across ages.</li>
<li><strong>Group Child Care</strong> — a centre, licensed per age band (under 36 months / 30 months–school age / school age). Bigger capacity, bigger requirements.</li>
<li><strong>Preschool</strong> — part-day programs for 30 months to school age.</li>
</ul>
<h2>2. Get licensed</h2>
<p>Licensing runs through your regional health authority (e.g. Fraser Health, Vancouver Coastal). Expect: an application, floor plans, criminal record checks, first-aid and ECE credentials, health & safety requirements (fencing, sleep arrangements, sanitation), and inspections. Read the <em>Child Care Licensing Regulation</em> early — it's the rulebook for ratios, space (3.7 m² indoor per child is the common figure), and staffing. Check our <a href="/guides/bc-daycare-staff-ratios">BC ratio guide</a> and <a href="/tools/daycare-staff-ratio-calculator-bc">ratio calculator</a>.</p>
<h2>3. Budget realistically</h2>
<ul><li><strong>Home-based:</strong> often $5k–$20k (safety upgrades, equipment, insurance, fencing).</li>
<li><strong>Centre:</strong> commonly $50k–$250k+ (leasehold improvements, furniture, playground, licensing, staff before revenue).</li>
<li>Look into <strong>ChildCareBC capital funding</strong> and operating programs (CCOF, CCFRI) — they materially change the math. See our <a href="/guides/daycare-tuition-pricing-guide">tuition & funding guide</a>.</li></ul>
<h2>4. Set up operations before you open</h2>
<p>Policies (illness, late pickup, withdrawal), parent contracts, emergency plans, menus — and your software. Setting up digital enrollment, attendance, daily reports and billing from day one is far easier than migrating later. Model your numbers with the free <a href="/tools/daycare-profitability-calculator">profitability calculator</a>.</p>
<h2>5. Fill your first spots</h2>
<p>List on your municipality's childcare registry and the provincial map, create a Google Business Profile, and give parents a professional first impression — a real website and a parent app signal quality the way a tidy classroom does. Word-of-mouth from your first three families is your strongest channel; give them something worth talking about (daily photos and reports do exactly that).</p>`,
  },
  {
    slug: 'bc-daycare-staff-ratios',
    tag: 'Licensing & compliance',
    title: 'BC Daycare Staff Ratios Explained (2026): Group, Multi-Age & School Age',
    desc: 'Staff-to-child ratios for BC licensed child care — group child care by age, multi-age, family child care and school age care, with ECE certification requirements.',
    h1: 'BC daycare staff ratios, explained',
    sub: 'The staff-to-child numbers licensing expects, by licence type — plus a free calculator.',
    faqs: [
      ['What is the infant-toddler ratio in BC?', 'Group child care for children under 36 months runs 1 adult to 4 children, with staffing tiers up to a maximum group size of 12 (1 staff for up to 4, 2 for 5–8, 3 for 9–12) and Infant/Toddler Educator certification requirements.'],
      ['What ratio applies for 3–5 year olds in BC?', 'Group child care (30 months to school age) runs 1:8, up to a maximum of 25 in a group (1 staff for up to 8, 2 for 9–16, 3 for 17–25).'],
      ['Do ratios include the licensee?', 'Staff counted in ratio must meet the certification requirements for that licence type and be working directly with the children. Always confirm specifics with your licensing officer.'],
    ],
    body: `
<p>Ratios are the backbone of BC's <em>Child Care Licensing Regulation</em> — they drive your staffing costs, your capacity, and your compliance. Here's the practical summary. <em>(Confirm details with your health authority licensing officer; rules get updated.)</em></p>
<h2>The common ratios</h2>
<table><tr><th>Licence type</th><th>Ratio</th><th>Max group</th><th>Staff tiers</th></tr>
<tr><td>Group — under 36 months</td><td>1:4</td><td>12</td><td>1 → up to 4 · 2 → 5–8 · 3 → 9–12</td></tr>
<tr><td>Group — 30 months to school age</td><td>1:8</td><td>25</td><td>1 → up to 8 · 2 → 9–16 · 3 → 17–25</td></tr>
<tr><td>Preschool (part-day)</td><td>1:10</td><td>20</td><td>1 → up to 10 · 2 → 11–20</td></tr>
<tr><td>Group — school age</td><td>1:12 (K/Gr 1) · 1:15 (Gr 2+)</td><td>24–30</td><td>by composition</td></tr>
<tr><td>Multi-Age Child Care</td><td>1:8</td><td>8</td><td>ECE required</td></tr>
<tr><td>Family Child Care</td><td>—</td><td>7</td><td>age-mix rules apply</td></tr></table>
<p>Try the free <a href="/tools/daycare-staff-ratio-calculator-bc">BC staff ratio calculator</a> — enter your enrolment and it tells you the staff required.</p>
<h2>Certification matters as much as count</h2>
<p>It's not just <em>how many</em> adults — it's <em>which</em> adults: Infant/Toddler Educator (ITE) requirements for under-36-months rooms, ECE and ECE Assistant mixes for 3–5 rooms, and Responsible Adult qualifications for school age. Track expiry dates; lapsed first-aid certificates are one of the most common inspection findings.</p>
<h2>Ratios are a profitability lever</h2>
<p>Because staffing is ~60–75% of a typical centre's costs, group composition is one of your biggest financial decisions: a 9th child under 36 months requires a 3rd staff member — that one enrolment can <em>reduce</em> margin until the room fills toward 12. Model it in the <a href="/tools/daycare-profitability-calculator">profitability calculator</a> before you commit to a room structure, and track live attendance against ratios through the day so you're never offside at pickup time.</p>`,
  },
  {
    slug: 'how-to-write-daycare-lesson-plans',
    tag: 'Programming',
    title: 'How to Write Daycare Lesson Plans (Templates + Free AI Generator)',
    desc: 'A practical system for writing weekly daycare lesson plans: developmental domains, play-based structure, a reusable template, and a free AI lesson plan generator.',
    h1: 'How to write daycare lesson plans (without losing your evenings)',
    sub: 'A simple weekly structure, what licensing actually looks for, and a free AI generator to draft plans in seconds.',
    faqs: [
      ['What should a daycare lesson plan include?', 'A learning goal, 3–5 activity blocks with times and materials, which developmental domains each activity touches (motor, language, social-emotional, cognitive), and a note on how you’ll observe or document learning.'],
      ['How far ahead should I plan?', 'A weekly rhythm with a monthly theme works for most programs — structured enough for licensing and parents, loose enough to follow children’s interests (emergent curriculum).'],
      ['Is there a free AI lesson plan generator for daycares?', 'Yes — Mitten’s free AI lesson plan generator drafts a multi-day, play-based plan from your age group, theme and learning goals. No signup required.'],
    ],
    body: `
<p>Good lesson plans aren't about paperwork — they're about intention. Here's a system that takes ~30 minutes a week and satisfies parents, licensing, and your own sanity. Or skip ahead and let the <a href="/tools/ai-lesson-plan-generator">free AI generator</a> draft one in 20 seconds.</p>
<h2>The 4-part weekly structure</h2>
<ol>
<li><strong>Theme</strong> — a monthly or biweekly thread (seasons, community helpers, ocean life). Themes make planning faster and give parents a story.</li>
<li><strong>Daily blocks</strong> — anchor each day with 3–5 planned blocks: circle time, a focused activity, outdoor play, story/songs. Keep times honest to your real routine.</li>
<li><strong>Domains</strong> — tag each activity with the development it supports: gross/fine motor, language, social-emotional, cognitive, self-help. BC's Early Learning Framework thinks in these terms, and it keeps your week balanced.</li>
<li><strong>Observation</strong> — one prompt per day ("who initiated pretend play?"). This is where milestones and parent updates come from.</li>
</ol>
<h2>A template that works</h2>
<table><tr><th>Time</th><th>Block</th><th>Activity</th><th>Domains</th><th>Materials</th></tr>
<tr><td>9:00</td><td>Circle</td><td>Weather chart + ocean song</td><td>Language, social</td><td>Felt board</td></tr>
<tr><td>9:30</td><td>Focus</td><td>Sink/float experiment</td><td>Cognitive, fine motor</td><td>Water bin, objects</td></tr>
<tr><td>10:15</td><td>Outdoor</td><td>"Wave" parachute play</td><td>Gross motor, social</td><td>Parachute</td></tr>
<tr><td>11:00</td><td>Story</td><td><em>Commotion in the Ocean</em></td><td>Language</td><td>Book</td></tr></table>
<h2>Make it emergent, not rigid</h2>
<p>Licensing wants to see intention; children want to follow their curiosity. The fix: plan the blocks, hold the activities loosely. If the sink/float bin turns into 40 minutes of pouring practice — that <em>is</em> fine motor development; write down what happened instead.</p>
<h2>Stop rewriting from scratch</h2>
<p>The painful part is the blank page. Two fixes: keep a library of past plans you can remix seasonally, and use AI for the first draft. Our <a href="/tools/ai-lesson-plan-generator">free generator</a> produces a multi-day, play-based plan from your age group + theme — edit 20%, keep 80%. (Inside Mitten, directors author plans once and educators run them live, hour by hour, with per-child participation tracking.)</p>`,
  },
  {
    slug: 'daycare-daily-reports-guide',
    tag: 'Parent experience',
    title: 'Daycare Daily Reports: What to Include (+ Why Digital Beats Paper)',
    desc: 'What belongs in a daycare daily report — meals, naps, activities, photos — with samples, timing tips, and the case for digital reports over paper sheets.',
    h1: 'Daycare daily reports that parents actually love',
    sub: 'What to include, how long it should take, and why the daily report is your best marketing.',
    faqs: [
      ['What should a daycare daily report include?', 'Meals (what and how much), nap times, diapering/toileting where relevant, the day’s activities with a specific moment about the child, any incidents, and supply requests — plus a photo when you can.'],
      ['How long should daily reports take?', 'With a digital tool, 2–4 minutes per child spread through the day (tap-as-you-go). Batch-writing paper sheets at 4pm is where reports go to die.'],
    ],
    body: `
<p>For a parent, the daily report is the product. They can't see your circle time — the report <em>is</em> their window into half their child's waking hours. Centres with great reports keep families longer and get more referrals. Here's the formula.</p>
<h2>The non-negotiables</h2>
<ul><li><strong>Meals</strong> — what was served and roughly how much was eaten ("ate most of lunch, skipped the peas").</li>
<li><strong>Sleep</strong> — nap start/end. Parents plan their whole evening around this.</li>
<li><strong>Toileting/diapers</strong> — for the under-3s, it matters medically and practically.</li>
<li><strong>One specific moment</strong> — the difference between "had a great day!" and "spent 20 minutes building a zoo and named every animal." Specificity is everything; it proves you <em>see</em> their child.</li>
<li><strong>Needs</strong> — diapers running low, extra clothes, sunscreen.</li></ul>
<h2>Timing: log as you go</h2>
<p>The 4pm batch-write produces generic reports and eats your educators' best hour. Tap-as-it-happens logging (right after lunch, as kids settle for nap) takes seconds per entry and produces accurate, specific reports — this alone justifies going digital.</p>
<h2>Paper vs digital</h2>
<table><tr><th></th><th>Paper sheets</th><th>Digital reports</th></tr>
<tr><td>Educator time</td><td>20–40 min/day batch writing</td><td>Seconds per entry, as it happens</td></tr>
<tr><td>Photos</td><td>None</td><td>Attached to the moment</td></tr>
<tr><td>Parent experience</td><td>Crumpled sheet at pickup</td><td>Live feed during the day</td></tr>
<tr><td>Records for licensing</td><td>Boxes of paper</td><td>Searchable history</td></tr></table>
<p>And if writing the note is the bottleneck: Mitten's educators tap an activity and AI drafts the warm parent-ready sentence for them — included free. Parents even get an AI "day in a glance" recap. That's the report writing itself.</p>`,
  },
  {
    slug: 'daycare-tuition-pricing-guide',
    tag: 'Money & taxes',
    title: 'Daycare Tuition Pricing in BC (2026): Setting Rates, CCFRI & Raising Prices',
    desc: 'How to set daycare tuition in BC — market benchmarks, the $10-a-day and CCFRI funding context, cost-based pricing, and how to raise rates without losing families.',
    h1: 'Setting (and raising) your daycare tuition',
    sub: 'Cost-based pricing, the BC funding landscape, and the rate-increase letter that doesn’t lose families.',
    faqs: [
      ['What is CCFRI?', 'The Child Care Fee Reduction Initiative — BC funding that reduces parent fees at participating licensed facilities, paid to the provider. Participating affects how and when you can change your rates, so factor it into pricing decisions.'],
      ['How much should I raise rates each year?', 'Small and predictable beats rare and dramatic: an annual 2–5% adjustment communicated 60+ days ahead, tied to visible costs (wages, food, rent), is widely accepted by families. If you participate in CCFRI, follow its fee-increase rules.'],
    ],
    body: `
<p>Tuition is your only revenue lever, and most providers underprice — usually because rates were set years ago by copying a neighbour. Here's a better process.</p>
<h2>1. Price from costs, not vibes</h2>
<p>Work out your true monthly cost per child: staffing (your biggest line — see <a href="/guides/bc-daycare-staff-ratios">ratios</a>), rent, food, supplies, insurance, admin. Divide by realistic enrolment (90% occupancy, not 100%). Add the margin you need to be sustainable — 10–20% is healthy for centres. The <a href="/tools/daycare-profitability-calculator">free profitability calculator</a> does this math for you.</p>
<h2>2. Know the BC funding context</h2>
<p>BC's childcare funding changes the picture: <strong>CCOF</strong> (base operating funding), <strong>CCFRI</strong> (fee reduction paid to you so parents pay less), the <strong>ECE Wage Enhancement</strong>, and <strong>$10-a-day (ChildCareBC) sites</strong>. If you participate in CCFRI, fee increases follow program rules — plan rate changes around those windows, and always check current program terms.</p>
<h2>3. Raising rates without drama</h2>
<ul><li><strong>Annual + predictable</strong> — families budget around you; a small yearly adjustment lands better than a 15% surprise after three frozen years.</li>
<li><strong>60+ days notice, in writing</strong> — with the reason ("ECE wages increased; we'd rather keep great educators than churn them").</li>
<li><strong>Pair it with visible value</strong> — this is the moment to launch daily photo reports or a parent app. "Fees rise $25; here's the new window into your child's day" reframes the entire conversation.</li></ul>
<h2>4. Stop revenue leaks</h2>
<p>Underpricing is half the problem; the other half is leakage — unfilled spots (see <a href="/guides/daycare-marketing-guide">marketing</a>), late payments without policy teeth, and forgotten extra fees. Automated billing with cards on file fixes most of it quietly.</p>`,
  },
  {
    slug: 'daycare-profit-margin-guide',
    tag: 'Money & taxes',
    title: 'Daycare Profit Margins: What’s Normal & 7 Levers That Move Them',
    desc: 'Typical daycare profit margins, why staffing ratios dominate the math, and seven practical levers — occupancy, room mix, software costs — to improve yours.',
    h1: 'Daycare profit margins: what’s normal, what moves them',
    sub: 'The honest numbers — and the seven levers that actually change them.',
    faqs: [
      ['What is a typical daycare profit margin?', 'Commonly cited ranges run roughly 5–15% for centres, with well-run programs reaching 15–20%+. Home daycares often see higher percentage margins on much smaller revenue.'],
      ['What’s the biggest cost in a daycare?', 'Staffing — typically 60–75% of total costs for licensed group care, which is why ratios and room composition dominate profitability.'],
    ],
    body: `
<p>Childcare is a labour business with regulated ratios — margins are structurally tight, which makes the few real levers matter enormously. Model your own numbers in the <a href="/tools/daycare-profitability-calculator">free calculator</a> as you read.</p>
<h2>The seven levers</h2>
<ol>
<li><strong>Occupancy</strong> — the brutal one. At 75% occupancy most centres lose money; at 95% the same centre is comfortable. Every unfilled spot is pure margin walking out the door; an active waitlist is your insurance. (<a href="/guides/daycare-marketing-guide">Fill spots →</a>)</li>
<li><strong>Room composition</strong> — infant care has the highest fees <em>and</em> the heaviest ratios (1:4 in BC). The margin sweet spot is usually a 3–5 room running near its 1:8 maximum; design your licence around the math, not just demand.</li>
<li><strong>Staff scheduling against actual attendance</strong> — staggered shifts matched to your arrival curve beat everyone working open-to-close. Live attendance data shows you the curve.</li>
<li><strong>Wage stability over churn</strong> — replacing an ECE costs months of disruption and recruiting. Paying slightly above market is usually cheaper than turnover.</li>
<li><strong>Collections</strong> — automated billing, cards on file, and a real late policy. 2–3% of revenue quietly leaks here at most centres.</li>
<li><strong>Funding programs</strong> — in BC, CCOF/CCFRI/wage enhancement materially change the equation. Make sure you're capturing everything you qualify for.</li>
<li><strong>Overhead per child</strong> — your software stack is the easy win: many centres pay $150–$400/mo for childcare software alone. Mitten is free up to 5 children, then $20/mo + $2/child — for a 30-child centre that's <strong>$68/mo vs $200+</strong>, every month, forever.</li>
</ol>
<h2>Know your number weekly, not yearly</h2>
<p>Margins die quietly between annual accountant visits. A live dashboard — revenue, occupancy, payroll hours — turns "we should look into that" into a Tuesday-morning fix. That's exactly what Mitten's director profitability view is for.</p>`,
  },
  {
    slug: 'daycare-payroll-guide-canada',
    tag: 'Money & taxes',
    title: 'Daycare Payroll in Canada (BC Guide): CPP, EI, Vacation Pay & Stat Holidays',
    desc: 'A practical payroll guide for daycare owners in BC — source deductions (CPP, EI, income tax), vacation pay, stat holiday pay, WorkSafeBC, and tools that prep it from tracked hours.',
    h1: 'Daycare payroll, demystified',
    sub: 'What you must withhold, remit and record for your educators — and how to prep it from tracked hours automatically.',
    faqs: [
      ['What payroll deductions do I make for daycare staff in Canada?', 'Withhold income tax, CPP contributions and EI premiums from each pay, add the employer share of CPP and EI, and remit to CRA on your schedule. Issue T4s each February.'],
      ['How does vacation pay work in BC?', 'Minimum 4% of gross wages (rising to 6% after five years of employment) — paid out each cheque or accrued and paid when vacation is taken.'],
      ['What about stat holidays in BC?', 'Eligible employees (30 days employed + worked 15 of the last 30 days) get an average day’s pay for the stat; if they work it, premium pay rules apply.'],
    ],
    body: `
<p>Payroll is where daycare owners lose the most evenings — and where mistakes cost real penalties. Here's the BC owner's map. <em>(Educational only; confirm with your accountant or payroll provider.)</em></p>
<h2>Every pay period</h2>
<ol><li><strong>Gross pay</strong> — hours × rate, overtime at 1.5× past 8 hours/day or 40/week in BC, stat pay where it applies.</li>
<li><strong>Withhold</strong> — income tax, CPP, EI from the employee's pay.</li>
<li><strong>Add employer costs</strong> — matching CPP, 1.4× EI, WorkSafeBC premiums.</li>
<li><strong>Remit to CRA</strong> on your remitter schedule (usually monthly for small employers) — late remittances are the most common and most avoidable penalty.</li>
<li><strong>Keep stubs and records</strong> — employees are entitled to pay statements showing hours, rate, deductions.</li></ol>
<h2>BC specifics that bite</h2>
<ul><li><strong>Vacation pay:</strong> 4% minimum (6% after five years) — accrue it visibly so it never surprises your cash flow.</li>
<li><strong>Stat holidays:</strong> eligibility rules (30 days + 15 of last 30 worked) mean part-timers often qualify — check, don't assume.</li>
<li><strong>ECE Wage Enhancement:</strong> if you receive it, it flows through payroll and must show correctly on pay.</li></ul>
<h2>The workflow that saves hours</h2>
<p>The painful part isn't the math — it's assembling hours from paper timesheets. If your educators clock in/out digitally, payroll prep becomes: review hours → confirm → generate. Mitten does exactly this: staff hours tracked in the app become <strong>gross pay, overtime, stat pay and vacation accrual with printable stubs and a CSV</strong> for your accountant or payroll provider. (Mitten preps gross pay; CRA deductions and remittance stay with you or a licensed payroll provider.) New-hire setup is self-serve too — staff submit their details, banking and SIN through an encrypted onboarding link instead of a paper folder.</p>`,
  },
  {
    slug: 'daycare-parent-communication-guide',
    tag: 'Parent experience',
    title: 'Daycare Parent Communication: Boundaries, Templates & The Right Channel',
    desc: 'How daycares communicate with parents well — choosing channels, setting healthy boundaries, handling hard conversations, and message templates that work.',
    h1: 'Parent communication that builds trust (and boundaries)',
    sub: 'The channel strategy, the boundary-setting, and the templates for the conversations everyone dreads.',
    faqs: [
      ['Should I give parents my personal phone number?', 'It’s the most common regret in the industry. A dedicated channel — a parent app or program phone — keeps responsiveness without 9pm texts to your personal life.'],
      ['How do I tell a parent about a biting incident?', 'Fast, factual, and privately: what happened, how it was handled, what you’re doing to prevent it. Never name the other child. In person or a call beats text for anything emotional.'],
    ],
    body: `
<p>Families don't leave daycares over curriculum — they leave over feeling unseen or surprised. Communication is retention. Here's the system.</p>
<h2>Pick channels deliberately</h2>
<table><tr><th>Message type</th><th>Right channel</th></tr>
<tr><td>Daily life (meals, naps, photos, moments)</td><td>Parent app feed — passive, delightful, zero educator interruptions</td></tr>
<tr><td>Questions & logistics ("can grandma pick up?")</td><td>Two-way messaging, visible to staff who need it</td></tr>
<tr><td>Incidents, sensitive topics</td><td>Phone or face-to-face — always</td></tr>
<tr><td>Program-wide news</td><td>Announcements/newsletter, not 30 separate texts</td></tr></table>
<p>The anti-pattern is everything-by-personal-text: invisible to other staff, impossible to hand off, and it never stops at 6pm.</p>
<h2>Boundaries that stick</h2>
<ul><li>Publish response hours ("messages answered 8am–5pm weekdays") in your handbook <em>and</em> honour them.</li>
<li>Educators shouldn't message parents from personal numbers — it follows them home and out of your oversight.</li>
<li>During care hours, children come first: batch replies at nap time. Parents accept this when the daily feed keeps them fed with photos.</li></ul>
<h2>Templates for the hard ones</h2>
<p><strong>Late pickup:</strong> "Hi {name} — a reminder that pickup is 5:30. After two grace instances we apply the late fee in your contract ($1/min). Thanks for helping our educators get home to their own families."</p>
<p><strong>Behaviour pattern:</strong> "We've noticed {child} struggling with transitions this week. Here's what we're trying at circle time — could we grab 10 minutes Thursday to compare notes on what works at home?"</p>
<p><strong>Rate increase:</strong> see the <a href="/guides/daycare-tuition-pricing-guide">tuition guide</a> — pair the news with visible value.</p>
<p>A parent app does the heavy lifting here: the photo feed answers "how was their day?" before it's asked, threads keep every conversation in one place, and your educators' personal phones stay personal.</p>`,
  },
  {
    slug: 'daycare-marketing-guide',
    tag: 'Growth',
    title: 'Daycare Marketing: How to Fill Spots & Build a Waitlist (2026 Playbook)',
    desc: 'A practical marketing playbook for daycares — Google Business Profile, local SEO, referral engines, tours that convert, and turning your daily reports into marketing.',
    h1: 'How to fill your daycare (and keep a waitlist)',
    sub: 'Local search, referrals, tours that convert — the playbook for owner-operated programs.',
    faqs: [
      ['What’s the most effective marketing for a daycare?', 'Google Business Profile + reviews for discovery, and parent referrals for conversion. Parents search "daycare near me," then trust other parents — win those two and most paid advertising becomes unnecessary.'],
      ['How do I get more daycare reviews?', 'Ask at peak-delight moments — right after a great daily report, a milestone update, or a happy parent comment — with a direct link. Two asks a month compounds fast.'],
    ],
    body: `
<p>Almost every parent journey starts the same way: a "daycare near me" search, a look at reviews, a tour, then a gut call about trust. Optimize those four steps and you'll carry a waitlist.</p>
<h2>1. Win the map pack</h2>
<ul><li>Claim your <strong>Google Business Profile</strong>; fill every field (hours, photos of real classrooms, programs, fees range if you dare).</li>
<li><strong>Reviews are the algorithm and the persuasion</strong> — ask happy parents at delight moments (right after a great photo update). Reply to every review.</li>
<li>Get listed on your municipal childcare registry, the BC childcare map, and local parent groups' resource lists.</li></ul>
<h2>2. A website that doesn't embarrass you</h2>
<p>Parents will judge — fairly or not — your program's care by your website's care. You need: real photos, programs & ages, your philosophy in 100 words, fees or a range, and an obvious "book a tour" button. (This is what we do at OKTD — Mitten founding centres get a professional site rebuilt free.)</p>
<h2>3. Build the referral engine</h2>
<p>Referrals convert at ~10× cold inquiries. Engineer them: a simple thank-you (a month's discount or a gift card), and — more powerful — <strong>give parents something shareable</strong>. Daily photos and milestone updates get shown to grandparents, coworkers, playground friends. Your daily report is quietly your best ad.</p>
<h2>4. Tours that convert</h2>
<ul><li>Reply to inquiries within hours — speed wins more enrolments than polish.</li>
<li>Tour during happy chaos (mid-morning), introduce one educator by name, tell one specific child story (anonymized).</li>
<li>End with the parent app: "this is what your phone looks like at 2pm when we post nap photos." It's consistently the moment parents decide.</li>
<li>Follow up same-day with next steps and the enrolment link.</li></ul>
<h2>5. Keep a real waitlist</h2>
<p>A managed waitlist (collected through your site, acknowledged, updated quarterly) turns vacancy panic into a phone call. Empty spots are the most expensive marketing problem you have — see the <a href="/guides/daycare-profit-margin-guide">margin guide</a> for the math.</p>`,
  },
]

/* ───────────────────────── competitor guides ───────────────────────── */

const COMPETITORS = [
  {
    slug: 'brightwheel-pricing-and-setup-guide',
    name: 'Brightwheel',
    title: 'Brightwheel Pricing & Setup Guide (2026): Costs, How-To & Alternatives',
    desc: 'What Brightwheel costs, how setup works, what it does well, where owners get frustrated — and a cheaper, simpler Canadian alternative.',
    h1: 'Brightwheel: pricing, setup & what to know before you sign',
    price: 'Quote-based; centres commonly report roughly $150–$400+/mo depending on size and plan',
    body: `
<p><a href="https://mybrightwheel.com" rel="nofollow">Brightwheel</a> is the biggest name in childcare software — check-in, daily reports, messaging, billing and admin in one app, used by tens of thousands of programs. Here's the practical owner's view.</p>
<h2>How Brightwheel pricing works</h2>
<p>Brightwheel doesn't publish simple pricing — plans are quote-based through a sales call, typically per-program subscriptions that scale with size and features. Owners commonly report costs in the <strong>$150–$400+/month</strong> range for centres, plus payment-processing fees on tuition. Always get a current quote; pricing changes.</p>
<h2>Setting it up</h2>
<ol><li>Book a demo/sales call and get your quote.</li><li>Onboarding sessions: import rosters, set rooms and ratios, configure billing plans.</li><li>Invite staff, then send parents app-download invitations.</li><li>Expect a few weeks to fully settle in — the platform is deep, which cuts both ways.</li></ol>
<h2>What it does well — and the common frustrations</h2>
<p><strong>Good:</strong> mature feature set, polished parent app, strong billing. <strong>Frustrations owners cite:</strong> price creep as features move between tiers, payment processing cuts on tuition, sales-call-gated everything, and feeling small in a very big customer base when support matters.</p>`,
  },
  {
    slug: 'himama-lillio-pricing-and-setup-guide',
    name: 'Lillio (HiMama)',
    title: 'HiMama / Lillio Pricing & Setup Guide (2026): Costs, How-To & Alternatives',
    desc: 'What Lillio (formerly HiMama) costs, how setup works, its strengths in documentation, common complaints — and a cheaper Canadian-built alternative.',
    h1: 'Lillio (HiMama): pricing, setup & what to know',
    price: 'Quote-based per classroom/centre; commonly reported around $100–$300+/mo',
    body: `
<p>Lillio — the Canadian platform long known as <strong>HiMama</strong> — built its reputation on daily reports and developmental documentation. It remains a popular choice, especially for programs that lead with learning stories.</p>
<h2>Pricing</h2>
<p>Lillio prices by quote, generally per classroom or centre with feature tiers; owners commonly report <strong>$100–$300+/month</strong> for centres. Like most of the category, expect a demo call before you see your number, and verify current pricing directly.</p>
<h2>Setup</h2>
<ol><li>Demo → quote → onboarding with their team.</li><li>Configure classrooms, import children, set report templates.</li><li>Parents download the app; staff learn the documentation flow.</li></ol>
<h2>Strengths and trade-offs</h2>
<p><strong>Strengths:</strong> excellent daily documentation and child development focus, Canadian roots. <strong>Trade-offs owners mention:</strong> cost at small-centre scale, feature tiers gating things like advanced reports, and the standard big-platform pattern — your program's data lives inside their ecosystem and pricing.</p>`,
  },
  {
    slug: 'procare-pricing-and-setup-guide',
    name: 'Procare',
    title: 'Procare Pricing & Setup Guide (2026): Costs, How-To & Alternatives',
    desc: 'What Procare costs, how setup works, its strength in centre administration and billing, common complaints — and a simpler, cheaper alternative.',
    h1: 'Procare: pricing, setup & what to know',
    price: 'Quote-based; commonly reported from ~$100/mo to several hundred for centres',
    body: `
<p>Procare is the veteran of childcare management — decades old, very strong on the administrative spine: enrolment, billing, agency subsidies, accounting integrations. Many large centres and chains run on it.</p>
<h2>Pricing</h2>
<p>Quote-based, by size and modules; commonly reported from around <strong>$100/month into several hundred</strong> for full-featured centre deployments, plus payment processing. Smaller programs often find they're paying for administrative depth they don't use.</p>
<h2>Setup</h2>
<ol><li>Sales consultation → quote → guided implementation.</li><li>Data migration and billing configuration are the heavy lifts; plan weeks, not days.</li><li>Staff training matters here — the depth means a real learning curve.</li></ol>
<h2>Strengths and trade-offs</h2>
<p><strong>Strengths:</strong> billing/subsidy administration, reporting, maturity. <strong>Trade-offs:</strong> dated feel in places, complexity for small teams, and total cost once modules stack up. If your need is parent experience + simple operations rather than enterprise admin, lighter tools fit better.</p>`,
  },
  {
    slug: 'famly-pricing-and-setup-guide',
    name: 'Famly',
    title: 'Famly Pricing & Setup Guide (2026): Costs, How-To & Alternatives',
    desc: 'What Famly costs, how setup works, its modern design strengths, trade-offs for North American programs — and a cheaper Canadian-built alternative.',
    h1: 'Famly: pricing, setup & what to know',
    price: 'Quote-based tiers; small centres commonly report ~$100–$250/mo',
    body: `
<p>Famly is the design-forward European entrant — a genuinely pleasant interface covering daily logs, messaging, billing and occupancy planning, increasingly marketed to North American programs.</p>
<h2>Pricing</h2>
<p>Tiered and quote-based by centre size; small centres commonly report roughly <strong>$100–$250/month</strong>, with bigger tiers for groups. A free tier exists with limited features. Verify current plans directly.</p>
<h2>Setup</h2>
<ol><li>Demo and tier selection → onboarding support.</li><li>Import families, configure rooms/sessions and billing plans.</li><li>Parent app invitations; staff pick it up quickly — the UX is a real strength.</li></ol>
<h2>Strengths and trade-offs</h2>
<p><strong>Strengths:</strong> modern interface, good occupancy/planning tools. <strong>Trade-offs:</strong> European centre-of-gravity (some North American specifics — like local funding programs or payroll norms — aren't its focus), and pricing that still assumes a sales process.</p>`,
  },
  {
    slug: 'kangarootime-pricing-and-setup-guide',
    name: 'Kangarootime',
    title: 'Kangarootime Pricing & Setup Guide (2026): Costs, How-To & Alternatives',
    desc: 'What Kangarootime costs, how setup works, its automation strengths for larger centres, trade-offs — and a simpler, cheaper alternative for owner-operated programs.',
    h1: 'Kangarootime: pricing, setup & what to know',
    price: 'Quote-based; commonly reported in the ~$2–$4 per child/mo range plus modules',
    body: `
<p>Kangarootime positions itself around automating centre operations — billing, subsidies, staff scheduling, family engagement — aimed primarily at larger centres and multi-site groups.</p>
<h2>Pricing</h2>
<p>Quote-based; commonly discussed in the <strong>$2–$4 per child per month</strong> neighbourhood with modules and minimums on top. As always with quote-gated pricing: your number depends on the sales conversation, so get it in writing and verify what's a module vs included.</p>
<h2>Setup</h2>
<ol><li>Sales process → implementation plan (longer for multi-site).</li><li>Billing/subsidy configuration is the core work.</li><li>Staff scheduling and engagement features layer on after the financial spine works.</li></ol>
<h2>Strengths and trade-offs</h2>
<p><strong>Strengths:</strong> automation depth for big operations, multi-site management. <strong>Trade-offs:</strong> overkill for single-site owner-operated programs — you pay (in money and complexity) for chain-scale capability you may never touch.</p>`,
  },
]

const ROUNDUP = {
  slug: 'best-brightwheel-alternatives',
  title: 'The 6 Best Brightwheel Alternatives in 2026 (Honest Comparison)',
  desc: 'Looking for a Brightwheel alternative? An honest comparison of Mitten, Lillio (HiMama), Procare, Famly, Kangarootime and Daily Connect — pricing, strengths, and who each fits.',
  h1: 'The best Brightwheel alternatives in 2026',
  sub: 'An honest comparison for owner-operated daycares — including our own app, clearly labelled.',
  body: `
<p>Brightwheel is a capable platform — but quote-gated pricing that commonly lands at <strong>$150–$400+/month</strong>, payment-processing cuts, and big-customer support queues send plenty of owners looking. Here are the six alternatives worth your time. <em>Full disclosure: Mitten (#1) is our product — we've kept the comparison honest anyway.</em></p>

<h2>1. Mitten — best for owner-operated daycares (that's us)</h2>
<p><strong>Free for your first 5 children, then $20/mo + $2 per child</strong> (a 20-child program pays ~$48/mo — published right here, no sales call). Daily photo feeds with per-family privacy, AI-drafted notes and parent recaps included free, milestones & memory books, messaging, attendance, lesson plans, profitability analytics, <strong>payroll prep from tracked hours</strong>, and encrypted employee onboarding. Canadian-built; your data is never sold and exports anytime; parents need no app-store download. Where we're honest about fit: Mitten is built for single-site, owner-operated programs — large multi-site chains needing subsidy-agency administration are better on Procare or Kangarootime. <a href="/signup">Start free →</a> or <a href="/app">poke the live demo</a> (no signup).</p>

<h2>2. Lillio (HiMama) — best for documentation-led programs</h2>
<p>Canadian roots and the deepest child-development documentation culture. Commonly ~$100–$300+/mo by quote. Pick it if learning stories are the centre of your practice and budget isn't tight. <a href="/guides/himama-lillio-pricing-and-setup-guide">Full Lillio guide →</a></p>

<h2>3. Procare — best for enterprise administration</h2>
<p>The veteran. Unmatched billing/subsidy administration for big centres; heavier and costlier than small programs need. <a href="/guides/procare-pricing-and-setup-guide">Full Procare guide →</a></p>

<h2>4. Famly — best interface of the big platforms</h2>
<p>Genuinely lovely UX with occupancy planning; European centre of gravity, ~$100–$250/mo for small centres by quote. <a href="/guides/famly-pricing-and-setup-guide">Full Famly guide →</a></p>

<h2>5. Kangarootime — best for multi-site groups</h2>
<p>Automation for chains: subsidies, scheduling, multi-location dashboards. Overkill for one site. <a href="/guides/kangarootime-pricing-and-setup-guide">Full guide →</a></p>

<h2>6. Daily Connect — best on a shoestring</h2>
<p>A simple, inexpensive daily-log app (roughly ~$1–$2/child/mo as commonly reported). Great if all you need is logging; you'll outgrow it the day you want billing, payroll or analytics.</p>

<h2>Quick comparison</h2>
<table><tr><th>Platform</th><th>Typical cost (verify!)</th><th>Best for</th><th>Watch out for</th></tr>
<tr><td><strong>Mitten</strong></td><td>Free ≤5 kids; $20 + $2/child</td><td>Owner-operated programs</td><td>Not built for multi-site chains</td></tr>
<tr><td>Brightwheel</td><td>~$150–$400+/mo</td><td>Feature breadth</td><td>Quotes, processing cuts</td></tr>
<tr><td>Lillio</td><td>~$100–$300+/mo</td><td>Documentation depth</td><td>Cost at small scale</td></tr>
<tr><td>Procare</td><td>~$100–several hundred</td><td>Enterprise admin</td><td>Complexity</td></tr>
<tr><td>Famly</td><td>~$100–$250/mo</td><td>UX, occupancy</td><td>NA-specifics</td></tr>
<tr><td>Kangarootime</td><td>~$2–4/child + modules</td><td>Multi-site</td><td>Overkill single-site</td></tr>
<tr><td>Daily Connect</td><td>~$1–2/child</td><td>Just logging</td><td>You'll outgrow it</td></tr></table>`,
  faqs: [
    ['What is the cheapest Brightwheel alternative?', 'For very small programs, Mitten is free up to 5 children; beyond that it’s $20/mo + $2 per child — typically a fraction of Brightwheel’s commonly reported $150–$400+/mo. Daily Connect is also inexpensive if you only need daily logging.'],
    ['Can I switch from Brightwheel mid-year?', 'Yes — the practical path is to run both for one week while families move over. Mitten migrates your roster free, and parents join via a link with no app-store download, which makes the switch week dramatically easier.'],
  ],
}

/* ───────────────────────────── tools ───────────────────────────── */

const TOOL_PROFIT = {
  slug: 'daycare-profitability-calculator',
  title: 'Free Daycare Profitability Calculator (2026) — Margin, Break-Even & Per-Child Profit',
  desc: 'Free interactive daycare profitability calculator: enter enrolment, tuition, wages and costs to see monthly profit, margin, per-child profit and your break-even point.',
  h1: 'Daycare profitability calculator',
  sub: 'Enter your numbers — see monthly profit, margin, per-child profit and break-even. Free, no signup.',
  body: `
<div class="card">
<div style="display:grid;gap:0 1.2rem;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))">
<div><label class="f" for="kids">Enrolled children</label><input class="f" id="kids" type="number" value="20" min="1" /></div>
<div><label class="f" for="fee">Average monthly tuition ($/child)</label><input class="f" id="fee" type="number" value="1100" min="0" /></div>
<div><label class="f" for="staff">Staff (FTE)</label><input class="f" id="staff" type="number" value="3" min="0" step="0.5" /></div>
<div><label class="f" for="wage">Average wage ($/hour)</label><input class="f" id="wage" type="number" value="24" min="0" step="0.5" /></div>
<div><label class="f" for="rent">Rent / mortgage ($/mo)</label><input class="f" id="rent" type="number" value="3500" min="0" /></div>
<div><label class="f" for="other">Food, supplies, insurance & other ($/mo)</label><input class="f" id="other" type="number" value="2200" min="0" /></div>
</div>
<div class="result" id="out"></div>
</div>
<p class="note" style="margin-top:1rem">Estimates only — payroll burden is approximated at +12% for employer CPP/EI/WorkSafeBC, staff at 160 hours/FTE/month. Model funding (CCOF/CCFRI) as higher effective tuition.</p>
<h2>How to read your numbers</h2>
<ul>
<li><strong>Margin under 5%?</strong> You're one vacancy from losing money — see the <a href="/guides/daycare-profit-margin-guide">margin levers guide</a>.</li>
<li><strong>Break-even close to your enrolment?</strong> Occupancy is your problem — see <a href="/guides/daycare-marketing-guide">filling spots</a>.</li>
<li><strong>Wages above 70% of revenue?</strong> Check your <a href="/guides/bc-daycare-staff-ratios">room composition against BC ratios</a>.</li>
</ul>
<script>
const $=id=>document.getElementById(id);const fmt=n=>'$'+Math.round(n).toLocaleString();
function calc(){const k=+$('kids').value||0,f=+$('fee').value||0,s=+$('staff').value||0,w=+$('wage').value||0,r=+$('rent').value||0,o=+$('other').value||0;
const rev=k*f;const pay=s*w*160*1.12;const cost=pay+r+o;const profit=rev-cost;const margin=rev>0?profit/rev*100:0;
const fixed=pay+r+o;const be=f>0?Math.ceil(fixed/f):0;const pc=k>0?profit/k:0;
$('out').innerHTML='<div style="display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))">'
+'<div><div class="eyebrow">Monthly revenue</div><div class="big">'+fmt(rev)+'</div></div>'
+'<div><div class="eyebrow">Monthly costs</div><div class="big" style="color:#e8604c">'+fmt(cost)+'</div></div>'
+'<div><div class="eyebrow">Monthly profit</div><div class="big" style="color:'+(profit>=0?'#2eb88a':'#e8604c')+'">'+fmt(profit)+'</div></div>'
+'<div><div class="eyebrow">Margin</div><div class="big">'+margin.toFixed(1)+'%</div></div></div>'
+'<div style="margin-top:1rem"><div class="eyebrow">Cost breakdown</div>'
+'<div class="mono">Staffing '+fmt(pay)+' ('+(cost>0?(pay/cost*100).toFixed(0):0)+'%)</div><div class="bar"><span style="width:'+(cost>0?pay/cost*100:0)+'%"></span></div>'
+'<div class="mono">Rent '+fmt(r)+'</div><div class="bar"><span style="width:'+(cost>0?r/cost*100:0)+'%"></span></div>'
+'<div class="mono">Other '+fmt(o)+'</div><div class="bar"><span style="width:'+(cost>0?o/cost*100:0)+'%"></span></div></div>'
+'<p style="margin:0.6rem 0 0"><strong>Break-even: '+be+' children</strong> · per-child profit '+fmt(pc)+'/mo</p>';}
['kids','fee','staff','wage','rent','other'].forEach(id=>$(id).addEventListener('input',calc));calc();
</script>`,
  faqs: [
    ['How do I calculate daycare profitability?', 'Monthly revenue (children × average tuition) minus monthly costs (staffing including ~12% employer payroll burden, rent, food, supplies, insurance, admin). Divide profit by revenue for your margin; divide fixed costs by tuition for your break-even enrolment.'],
    ['What profit margin should a daycare aim for?', 'A commonly cited healthy range is 10–20% for owner-operated centres. Under 5% means one vacancy or one repair can put you underwater.'],
  ],
}

const TOOL_AI = {
  slug: 'ai-lesson-plan-generator',
  title: 'Free AI Lesson Plan Generator for Daycares & Preschools (No Signup)',
  desc: 'Generate a play-based, multi-day daycare lesson plan in seconds with free AI — age group, theme, developmental domains. No signup, unlimited use.',
  h1: 'AI lesson plan generator for daycares',
  sub: 'A play-based, multi-day plan in ~20 seconds. Free, no signup — built by the Mitten team.',
  body: `
<div class="card">
<div style="display:grid;gap:0 1.2rem;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))">
<div><label class="f" for="age">Age group</label><select class="f" id="age"><option>Infants & toddlers (0–3)</option><option selected>3–5 years</option><option>Multi-age (0–5)</option><option>School age (5–12)</option></select></div>
<div><label class="f" for="theme">Theme</label><input class="f" id="theme" value="Under the sea" maxlength="80" /></div>
<div><label class="f" for="days">Days</label><select class="f" id="days"><option>1</option><option>2</option><option selected>3</option><option>5</option></select></div>
<div><label class="f" for="domains">Focus (optional)</label><input class="f" id="domains" placeholder="e.g. fine motor, early literacy" maxlength="120" /></div>
</div>
<button class="btn btn-primary" id="gen" style="margin-top:1.1rem;border:0;cursor:pointer;font-size:1rem">✨ Generate my lesson plan</button>
<span id="status" style="margin-left:.8rem;font-size:.88rem;color:var(--slate-5)"></span>
<div class="plan-output" id="plan"></div>
<button class="btn btn-ghost" id="copy" style="display:none;margin-top:.8rem;border:1px solid var(--line);cursor:pointer">Copy plan</button>
</div>
<h2>How it works</h2>
<p>Describe your group and theme; the generator drafts a realistic, play-based plan — daily learning goals, timed activity blocks with cheap common materials, and an observation prompt for your educators. Edit 20%, keep 80%. For the thinking behind a great plan, read <a href="/guides/how-to-write-daycare-lesson-plans">our lesson-planning guide</a>.</p>
<p class="note">Inside <a href="/">Mitten</a>, this goes further: directors author plans once, educators run them hour-by-hour in class with per-child participation — and AI drafts the parent-facing notes too. Free up to 5 children.</p>
<script>
const $=id=>document.getElementById(id);
$('gen').addEventListener('click',async()=>{
  const btn=$('gen'),st=$('status'),out=$('plan'),cp=$('copy');
  btn.disabled=true;st.innerHTML='<span class="spin" style="border-color:#0E74C1;border-top-color:transparent"></span> Writing your plan… (~20s on free AI)';out.style.display='none';cp.style.display='none';
  try{
    const r=await fetch('${CONVEX_SITE}/tools/lesson-plan',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ageGroup:$('age').value,theme:$('theme').value,days:$('days').value,domains:$('domains').value,setting:'a licensed daycare'})});
    const j=await r.json();
    if(j.plan){out.textContent=j.plan;out.style.display='block';cp.style.display='inline-flex';st.textContent='';}
    else{st.textContent=j.error||'The free AI is busy — try again in a minute.';}
  }catch(e){st.textContent='Network hiccup — please try again.';}
  btn.disabled=false;
});
$('copy').addEventListener('click',()=>{navigator.clipboard.writeText($('plan').textContent);$('copy').textContent='Copied ✓';setTimeout(()=>$('copy').textContent='Copy plan',1500);});
</script>`,
  faqs: [
    ['Is this lesson plan generator really free?', 'Yes — free and unlimited, no signup. It runs on free AI models, so at busy moments a generation can take a little longer or need a retry.'],
    ['Are the plans aligned with early-learning frameworks?', 'Plans are play-based and organized by developmental domains (motor, language, social-emotional, cognitive), the same lens used by frameworks like BC’s Early Learning Framework. Treat them as a strong first draft for your professional judgment.'],
  ],
}

const TOOL_RATIO = {
  slug: 'daycare-staff-ratio-calculator-bc',
  title: 'BC Daycare Staff Ratio Calculator (Free) — How Many Staff Do You Need?',
  desc: 'Free BC child care ratio calculator: pick your licence type and enrolment to see required staff under the Child Care Licensing Regulation, with group maximums.',
  h1: 'BC daycare staff ratio calculator',
  sub: 'Pick your licence type, enter enrolment — see the staff required and your group maximum.',
  body: `
<div class="card">
<div style="display:grid;gap:0 1.2rem;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))">
<div><label class="f" for="type">Licence type</label><select class="f" id="type">
<option value="it">Group — under 36 months</option>
<option value="g35" selected>Group — 30 months to school age</option>
<option value="pre">Preschool (part-day)</option>
<option value="sa">Group — school age</option>
<option value="ma">Multi-Age Child Care</option></select></div>
<div><label class="f" for="count">Children attending</label><input class="f" id="count" type="number" value="16" min="1" /></div>
</div>
<div class="result" id="rout"></div>
</div>
<p class="note" style="margin-top:1rem">Summary of the BC <em>Child Care Licensing Regulation</em> for guidance only — certification requirements (ECE / ITE / Responsible Adult) also apply, and rules change. Always confirm with your health authority licensing officer.</p>
<h2>Behind the numbers</h2>
<p>Full ratio tables and certification notes are in our <a href="/guides/bc-daycare-staff-ratios">BC staff ratios guide</a>. To see what a staffing change does to your bottom line, run the <a href="/tools/daycare-profitability-calculator">profitability calculator</a> next.</p>
<script>
const RULES={it:{name:'Group under 36 months',ratio:4,max:12},g35:{name:'Group 30 months–school age',ratio:8,max:25},pre:{name:'Preschool',ratio:10,max:20},sa:{name:'Group school age',ratio:12,max:30},ma:{name:'Multi-Age',ratio:8,max:8}};
const $=id=>document.getElementById(id);
function rc(){const r=RULES[$('type').value];const n=+$('count').value||0;const need=Math.max(1,Math.ceil(n/r.ratio));const over=n>r.max;
$('rout').innerHTML='<div style="display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))">'
+'<div><div class="eyebrow">Staff required</div><div class="big">'+(over?'—':need)+'</div></div>'
+'<div><div class="eyebrow">Ratio</div><div class="big">1:'+r.ratio+'</div></div>'
+'<div><div class="eyebrow">Group maximum</div><div class="big" style="color:'+(over?'#e8604c':'#2eb88a')+'">'+r.max+'</div></div></div>'
+(over?'<p style="color:#e8604c;font-weight:700;margin:.8rem 0 0">'+n+' children exceeds the maximum group size of '+r.max+' for '+r.name+' — this enrolment needs an additional licensed group/room.</p>'
:'<p style="margin:.8rem 0 0">For <strong>'+n+'</strong> children in <strong>'+r.name+'</strong> care you need at least <strong>'+need+' qualified staff</strong> present. Certification requirements apply.</p>');}
$('type').addEventListener('change',rc);$('count').addEventListener('input',rc);rc();
</script>`,
  faqs: [
    ['How many staff do I need for 12 toddlers in BC?', 'Group child care under 36 months runs 1:4 with a max group of 12 — so 12 toddlers require 3 qualified staff, including Infant/Toddler Educator certification requirements.'],
    ['Do these ratios apply during nap time?', 'Licensing has specific provisions around supervision during sleep; reduced active staffing may be possible in limited circumstances, but confirm directly with your licensing officer before relying on it.'],
  ],
}

const TOOLS = [TOOL_PROFIT, TOOL_AI, TOOL_RATIO]

/* ───────────────────────────── hub + writing ───────────────────────────── */

function hubPage() {
  const tools = TOOLS.map((t) => `<a class="tile" href="/tools/${t.slug}"><span class="tag">Free tool</span><h3>${esc(t.h1)}</h3><p>${esc(t.sub)}</p></a>`).join('')
  const guides = GUIDES.map((g) => `<a class="tile" href="/guides/${g.slug}"><span class="tag">${esc(g.tag)}</span><h3>${esc(g.h1)}</h3><p>${esc(g.desc.slice(0, 110))}…</p></a>`).join('')
  const comps = [...COMPETITORS.map((c) => `<a class="tile" href="/guides/${c.slug}"><span class="tag">Software guide</span><h3>${esc(c.name)}: pricing & setup</h3><p>${esc(c.desc.slice(0, 110))}…</p></a>`), `<a class="tile" href="/guides/${ROUNDUP.slug}"><span class="tag">Comparison</span><h3>Best Brightwheel alternatives</h3><p>${esc(ROUNDUP.desc.slice(0, 110))}…</p></a>`].join('')
  return layout({
    path: '/resources', wide: true,
    title: 'Free Daycare Tools & Guides — Mitten Resources',
    desc: 'Free tools and practical guides for daycare owners: profitability calculator, AI lesson plan generator, BC ratio calculator, tax & payroll guides, and honest software comparisons.',
    h1: 'Free tools & guides for daycare owners',
    sub: 'Built by the team behind Mitten — free to use, no signup. The same care we put in the app.',
    tag: 'Mitten resources',
    jsonld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Mitten Resources', url: `${DOMAIN}/resources` }],
    body: `
<h2 id="tools">Free tools</h2><div class="grid">${tools}</div>
<h2>Guides for daycare owners</h2><div class="grid">${guides}</div>
<h2>Childcare software guides & comparisons</h2><div class="grid">${comps}</div>
${cta('Everything these guides recommend — daily reports, billing, payroll prep, parent messaging — is one app.')}`,
  })
}

function write(relPath, html) {
  const full = join(DIST, relPath)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, html)
}

if (!existsSync(DIST)) {
  console.error('dist/ not found — run `vite build` first.')
  process.exit(1)
}

const urls = ['/', '/resources']

for (const g of GUIDES) {
  const path = `/guides/${g.slug}`
  urls.push(path)
  write(`guides/${g.slug}.html`, layout({
    path, title: g.title, desc: g.desc, h1: g.h1, sub: g.sub, tag: g.tag,
    jsonld: [articleLd(path, g.title, g.desc), faqLd(g.faqs)],
    body: g.body + cta() + faqBlock(g.faqs),
  }))
}

for (const c of COMPETITORS) {
  const path = `/guides/${c.slug}`
  urls.push(path)
  const faqs = [
    [`How much does ${c.name} cost?`, `${c.price}. Pricing is quote-based and changes — always confirm with the vendor. For comparison, Mitten publishes its pricing: free up to 5 children, then $20/mo + $2 per child.`],
    [`Is there a cheaper alternative to ${c.name}?`, `Mitten is typically a fraction of the cost — free for your first 5 children, then $20/mo + $2/child, with payroll prep and AI notes included and no payment-processing cut on tuition.`],
  ]
  write(`guides/${c.slug}.html`, layout({
    path, title: c.title, desc: c.desc, h1: c.h1, tag: 'Software guide',
    sub: `An honest owner's guide — and what it costs compared to simpler options.`,
    jsonld: [articleLd(path, c.title, c.desc), faqLd(faqs)],
    body: c.body + compareTable(c.name, c.price) + cta(`Switching is free — we migrate your roster from ${c.name}, parents join via a link (no app-store download), and you're live in an afternoon.`) + faqBlock(faqs),
  }))
}

{
  const path = `/guides/${ROUNDUP.slug}`
  urls.push(path)
  write(`guides/${ROUNDUP.slug}.html`, layout({
    path, title: ROUNDUP.title, desc: ROUNDUP.desc, h1: ROUNDUP.h1, sub: ROUNDUP.sub, tag: 'Comparison',
    jsonld: [articleLd(path, ROUNDUP.title, ROUNDUP.desc), faqLd(ROUNDUP.faqs)],
    body: ROUNDUP.body + cta('See why owner-operated daycares pick Mitten — free up to 5 children, live in minutes, no sales call.') + faqBlock(ROUNDUP.faqs),
  }))
}

for (const t of TOOLS) {
  const path = `/tools/${t.slug}`
  urls.push(path)
  write(`tools/${t.slug}.html`, layout({
    path, title: t.title, desc: t.desc, h1: t.h1, sub: t.sub, tag: 'Free tool',
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'WebApplication', name: t.h1, url: `${DOMAIN}${path}`, applicationCategory: 'BusinessApplication', offers: { '@type': 'Offer', price: '0', priceCurrency: 'CAD' }, publisher: { '@type': 'Organization', name: 'Mitten' } },
      faqLd(t.faqs),
    ],
    body: t.body + cta() + faqBlock(t.faqs),
  }))
}

write('resources/index.html', hubPage())

write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${DOMAIN}${u}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}
</urlset>`)

console.log(`✓ content built: ${GUIDES.length} guides, ${COMPETITORS.length + 1} competitor pages, ${TOOLS.length} tools, hub + sitemap (${urls.length} URLs)`)
