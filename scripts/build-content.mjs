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

function layout({ path, title, desc, h1, sub, tag, body, jsonld = [], wide = false, heroHtml = '' }) {
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
<a href="/childcare">Find a daycare</a><a href="/resources">Resources</a><a href="/resources#tools">Free tools</a><a href="/#pricing">Pricing</a><a href="/app">Live demo</a>
<a class="btn btn-primary" href="/signup">Start free</a>
</div></nav>
${heroHtml || `<div class="aurora"><div class="${wide ? 'wrap-wide' : 'wrap'} hero">
${tag ? `<span class="eyebrow">${esc(tag)}</span>` : ''}
<h1>${h1}</h1>
${sub ? `<p class="sub">${sub}</p>` : ''}
</div></div>`}
<main class="${wide ? 'wrap-wide' : 'wrap'}"><article>
${body}
</article></main>
<footer class="site"><div class="wrap-wide">
<p><strong style="color:#fff;font-family:'Instrument Serif',serif;font-size:1.2rem">Mitten</strong> — the childcare app built in BC. Free for your first 5 children.</p>
<p><a href="/">Home</a><a href="/childcare">Find a daycare</a><a href="/resources">Resources</a><a href="/research">Research</a><a href="/about">About</a><a href="/#pricing">Pricing</a><a href="/app">Live demo</a><a href="/signup">Start free</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a></p>
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
// Real, verifiable E-E-A-T identities. Author is a named human (the founder),
// publisher carries the org, founder, logo + Langley address.
const AUTHOR = {
  '@type': 'Person', name: 'Ben Choi', jobTitle: 'Founder, Mitten',
  url: `${DOMAIN}/about`, worksFor: { '@type': 'Organization', name: 'Mitten' },
}
const PUBLISHER = {
  '@type': 'Organization', name: 'Mitten', url: DOMAIN,
  logo: { '@type': 'ImageObject', url: `${DOMAIN}/brand/mitten-mark.svg` },
  founder: { '@type': 'Person', name: 'Ben Choi' },
  parentOrganization: { '@type': 'Organization', name: 'OKTD', url: 'https://oktd.ca' },
  address: { '@type': 'PostalAddress', streetAddress: '83–7947 209 St', addressLocality: 'Langley', addressRegion: 'BC', postalCode: 'V2Y 0Y6', addressCountry: 'CA' },
}
const articleLd = (path, title, desc) => ({
  '@context': 'https://schema.org', '@type': 'Article', headline: title, description: desc,
  datePublished: TODAY, dateModified: TODAY, url: `${DOMAIN}${path}`, mainEntityOfPage: `${DOMAIN}${path}`,
  author: AUTHOR, publisher: PUBLISHER,
})

/* ───────────────────────────── guides ───────────────────────────── */

const GUIDES = [
  {
    slug: 'free-daycare-management-software',
    tag: 'Software',
    title: 'Free Daycare Management Software in Canada (2026): What’s Actually Free',
    desc: 'An honest look at free daycare and childcare management software in Canada — what’s genuinely free vs a trial, the features a small program needs, and how Mitten compares to Brightwheel and Lillio.',
    h1: 'Free daycare management software (Canada)',
    sub: 'What’s truly free vs a 30-day trial, the features a small or home program actually needs, and where each tool quietly draws the paywall.',
    faqs: [
      ['Is there genuinely free daycare management software?', 'Yes, but read the fine print. Most “free” childcare apps are a 14–30-day trial or a freemium tier that paywalls the parts you need — billing, data export, or more than a handful of children. Mitten is the rare one with a real free tier: the full feature set free for up to 5 children, then $20/month plus $2 per child after that, published openly on the site.'],
      ['What is the best free daycare management software in Canada?', 'For a small or home program (5 children or fewer) Mitten is free with everything included — attendance, daily reports with photos, parent messaging, invoicing, and Canadian subsidy and tax handling. Brightwheel and Lillio (formerly HiMama) have limited free or trial tiers but paywall billing and key exports, and neither is built around Canadian CWELCC and CRA requirements.'],
      ['Is Brightwheel free?', 'Brightwheel has a limited free option and a trial, but the features most programs rely on — billing, premium reporting, integrations — sit on paid plans, and the price is quote-based rather than published. For a small Canadian program, a tool with a real free tier and published pricing is usually the better fit.'],
      ['Are “free” daycare apps actually free, or just a free trial?', 'Often a trial. The tells: a credit card required up front, a child or staff cap lower than your room, “billing” or “export” greyed out, or pricing you can only get by booking a demo. A genuinely free tool states its limits and its paid pricing in the open.'],
      ['Can I run a home daycare for free?', 'Yes — a home daycare with five children or fewer runs entirely free on Mitten, with no trial clock and no credit card. Attendance, daily reports, photos, parent messaging and invoicing are all included.'],
    ],
    body: `
<p>Search <em>“free daycare management software”</em> and you’ll get a wall of apps that all say “free” — and a lot of them aren’t, quite. Here’s the honest version: what’s genuinely free, what’s a trial with a countdown, and what a small Canadian program actually needs. <em>Last reviewed June 2026.</em></p>
<h2>“Free” usually means one of three things</h2>
<ul>
<li><strong>A free trial</strong> — full features for 14–30 days, then a paywall (and often a card required up front).</li>
<li><strong>Freemium</strong> — free forever, but the parts you actually use (billing, data export, more than a few children) live on a paid plan.</li>
<li><strong>Genuinely free for small programs</strong> — a real free tier with the everyday features included, and paid pricing published openly for when you grow. That’s the one worth finding.</li>
</ul>
<h2>The features a small program actually needs</h2>
<p>Ignore the 200-row feature matrices. Day to day, an owner-operated or home daycare needs five things: <strong>attendance / check-in</strong>, <strong>daily reports with photos</strong> for parents, <strong>messaging</strong>, <strong>invoicing</strong> (with a real way to get paid), and — in Canada — <strong>subsidy and tax handling</strong>. If “free” means any of those are locked, it isn’t free <em>for you</em>.</p>
<h2>How the main options compare</h2>
<table>
<thead><tr><th>Tool</th><th>Real free tier?</th><th>Built for Canada</th><th>Pricing</th></tr></thead>
<tbody>
<tr><td><strong>Mitten</strong></td><td>Yes — full features, up to 5 children</td><td>Yes — CWELCC, CCFRI, CRA receipts</td><td>Published: free ≤5 kids, then $20/mo + $2/child</td></tr>
<tr><td>Brightwheel</td><td>Limited; billing &amp; premium reporting paywalled</td><td>US-first</td><td>Quote-based</td></tr>
<tr><td>Lillio (HiMama)</td><td>Trial / limited</td><td>US-first</td><td>Quote-based</td></tr>
<tr><td>A spreadsheet</td><td>Free</td><td>You build it</td><td>Free — but no parent app, billing or receipts</td></tr>
</tbody>
</table>
<p style="font-size:.9rem;color:var(--slate-5)">Competitor tiers change often and pricing is quote-based — see our <a href="/guides/brightwheel-pricing-and-setup-guide">Brightwheel pricing breakdown</a> and <a href="/guides/himama-lillio-pricing-and-setup-guide">Lillio / HiMama pricing</a> for current detail, or the <a href="/guides/best-brightwheel-alternatives">full alternatives roundup</a>.</p>
<h2>Why “built for Canada” matters more than it sounds</h2>
<p>Most well-known childcare apps are US-first, and in Canada that shows up exactly where it costs you. They don’t model <a href="/guides/cwelcc-for-daycare-operators">CWELCC</a> fee caps and reporting, they don’t produce <a href="/guides/daycare-tax-receipts-cra-guide">CRA-ready tax receipts</a>, and they’re little help with <a href="/guides/ccfri-explained-for-parents">CCFRI</a> or the <a href="/guides/how-to-apply-affordable-child-care-benefit-bc">Affordable Child Care Benefit</a>. Mitten is built around them — approved subsidy reductions land on the invoice automatically, and clean attendance and enrolment records turn CWELCC reporting into an export instead of a reconstruction.</p>
<h2>Free for home daycares — actually free</h2>
<p>If you run a home daycare with <strong>five children or fewer</strong>, Mitten is free with the full feature set — attendance, daily reports, photos, parent messaging and invoicing — no trial clock, no credit card. Parents join with a link (no app-store download, and no login wall for grandparents on the photo feed). Grow past five and pricing is <strong>$20/month + $2/child</strong>, published up front — not a surprise at renewal.</p>
<h2>Already paying for a tool you fight with?</h2>
<p>Switching is lighter than it looks: Mitten imports your roster CSV directly and most programs are fully moved in an afternoon, with parents re-joining by link. Start with <a href="/guides/how-to-switch-daycare-software-without-losing-data">how to switch without losing data</a>. Want to size the economics of a program first? The <a href="/tools/daycare-profitability-calculator">free profitability calculator</a> and <a href="/guides/daycare-tuition-pricing-guide">tuition pricing guide</a> are a good place to start.</p>`,
  },
  {
    slug: 'free-daycare-bookkeeping-template',
    tag: 'Free template',
    title: 'Free Daycare Bookkeeping Template (Canada, 2026): Income & Expense Tracker',
    desc: 'A free downloadable daycare bookkeeping spreadsheet for Canadian providers — log income and expenses, track mileage, and auto-total everything into a CRA-ready tax summary. No signup.',
    h1: 'Free daycare bookkeeping template',
    sub: 'A simple Excel / Google Sheets tracker for Canadian daycares — income, expenses, mileage, and an automatic CRA tax summary. No signup.',
    faqs: [
      ['Is there a free daycare bookkeeping template?', 'Yes — this one. It is a free Excel / Google Sheets workbook with tabs for income, expenses (with a category drop-down), mileage, and summaries that total everything automatically into a CRA-ready tax view. No email or signup required.'],
      ['What records does a home daycare need to keep for taxes in Canada?', 'Keep a record of all income received and every business expense with its receipt, plus a mileage log for business driving. The CRA requires you to keep records and receipts for six years. Issuing child-care receipts to families — with your name, the child, the amount and your SIN — is also expected.'],
      ['What daycare expenses are tax-deductible in Canada?', 'Food, toys and program supplies, a business-use share of rent or mortgage interest, utilities and home insurance, wages, professional and licensing fees, advertising, and vehicle costs are commonly deductible. The template groups these into the CRA T2125 lines your accountant expects.'],
      ['Do I need accounting software for a small daycare?', 'A spreadsheet is enough to start, especially for a home daycare. You will likely want software once you are issuing many invoices, handling subsidy reductions, or reconciling card payments — at which point Mitten can do the bookkeeping as a by-product of running your day.'],
    ],
    body: `
<p>Good books are the difference between a calm tax season and a shoebox of receipts in April. This free workbook gives a Canadian daycare — home or centre — a clean place to track every dollar, and it totals everything for you. <em>Last reviewed June 2026.</em></p>
<p style="margin:1.5rem 0 .4rem"><a class="btn btn-primary" href="/downloads/daycare-bookkeeping-template.xlsx" download>⬇&nbsp; Download the free template (.xlsx)</a></p>
<p style="font-size:.9rem;color:var(--slate-5);margin-top:0">Works in Excel, Numbers and Google Sheets. No email, no signup.</p>
<h2>What’s inside</h2>
<ul>
<li><strong>Income</strong> — tuition, registration and subsidy payments, with a column for the subsidy portion.</li>
<li><strong>Expenses</strong> — a dated log with a category drop-down so everything totals correctly.</li>
<li><strong>Mileage</strong> — business driving (supply runs, field trips) with a running total.</li>
<li><strong>Monthly summary</strong> — income, expenses and net for every month, calculated automatically.</li>
<li><strong>Tax summary</strong> — your expense categories totalled for the year and mapped to the <a href="/guides/daycare-taxes-canada">CRA T2125</a> lines your accountant expects.</li>
</ul>
<h2>How to use it</h2>
<ol>
<li>Log money in on the <strong>Income</strong> tab as it arrives.</li>
<li>Log money out on the <strong>Expenses</strong> tab — pick a category from the drop-down and note the receipt number.</li>
<li>Let the <strong>summary</strong> tabs do the totalling. Don’t type in the grey total cells.</li>
</ol>
<h2>Keep receipts — and issue them too</h2>
<p>The CRA wants records and receipts kept for <strong>six years</strong>. You also need to <em>issue</em> child-care receipts to families — with your name, the child’s name, the amount paid and your SIN or business number. Our <a href="/guides/daycare-tax-receipts-cra-guide">tax-receipts guide</a> has the exact format, and the <a href="/guides/child-care-expenses-deduction-canada">child care expenses deduction guide</a> covers what families can claim back.</p>
<h2>What you can deduct</h2>
<p>Home daycares in particular leave money on the table by under-claiming. A business-use share of rent or mortgage interest, utilities and home insurance is deductible, alongside food, supplies, wages, insurance, professional fees and vehicle costs. The full picture is in our <a href="/guides/daycare-taxes-canada">daycare taxes guide</a>, and the <a href="/guides/daycare-profit-margin-guide">profit-margin guide</a> shows where the money actually goes.</p>
<h2>When the spreadsheet stops scaling</h2>
<p>A spreadsheet is perfect to start. But once you’re issuing dozens of invoices a month, netting subsidy reductions, or reconciling card payments, manual entry gets old fast — that’s the point of Mitten’s bookkeeping add-on: receipts, invoicing, subsidy netting and CRA-ready reports come out of simply running your day, free for your first 5 children.</p>`,
  },
  {
    slug: 'how-to-apply-affordable-child-care-benefit-bc',
    tag: 'Subsidies',
    title: 'How to Apply for the Affordable Child Care Benefit in BC (2026)',
    desc: 'A step-by-step guide to applying for the BC Affordable Child Care Benefit (ACCB): who qualifies, the income limit, the documents you need, the CF2798 form, and yearly renewal.',
    h1: 'How to apply for the Affordable Child Care Benefit (BC)',
    sub: 'Who qualifies, what you need, and the exact steps — plus the CF2798 form and the yearly renewal most families forget.',
    faqs: [
      ['What is the income limit for the Affordable Child Care Benefit?', 'Families with household income up to roughly $111,000 may qualify. The benefit is income-tested, so the amount also depends on your family size, your child’s age, and the type of care. Lower incomes receive more, and at the lowest incomes it can cover most or all of your fee.'],
      ['How long does an Affordable Child Care Benefit application take?', 'Once you start in My Family Services you have 60 days to finish, and you can save and return. Processing times vary; apply as early as you can, because the benefit generally isn’t backdated to before your application.'],
      ['Do I have to reapply every year?', 'Yes. The Affordable Child Care Benefit must be renewed annually. Diarize your renewal date — if it lapses, your fee reduction stops until you reapply.'],
      ['Does the Affordable Child Care Benefit stack with CCFRI?', 'Yes. CCFRI lowers your fee automatically at a participating centre, and the Affordable Child Care Benefit applies on top of that reduced fee — together they can bring your cost close to zero for lower-income families.'],
    ],
    body: `
<p>The <strong>Affordable Child Care Benefit (ACCB)</strong> is BC’s income-tested childcare subsidy. Unlike <a href="/guides/ccfri-explained-for-parents">CCFRI</a> (which your provider opts into and applies automatically), the ACCB is one <em>you</em> apply for — and it stacks on top of CCFRI. Here’s exactly how to get it.</p>
<h2>1. Check if you’re likely eligible</h2>
<p>Eligibility is income-tested: households earning up to about <strong>$111,000</strong> may qualify, with the amount based on your income, family size, your child’s age and the type of care. You generally also need to be working, looking for work, studying, or have a medical or other approved reason for care. Want a quick read on your numbers first? Use our <a href="/tools/bc-child-care-subsidy-calculator">BC child care subsidy calculator</a>.</p>
<h2>2. Gather your documents</h2>
<ul>
<li>Your <strong>Social Insurance Number</strong></li>
<li>Proof of income — usually your <strong>CRA Notice of Assessment</strong></li>
<li>Proof of your child’s citizenship — a <strong>birth certificate or passport</strong></li>
<li><strong>Banking details</strong> for direct deposit</li>
</ul>
<h2>3. Apply online through My Family Services</h2>
<p>Apply (and later check status) at <a href="https://gov.bc.ca/affordablechildcarebenefit" target="_blank" rel="noopener">gov.bc.ca/affordablechildcarebenefit</a>. Once you begin you have 60 days to complete it, and you can save and finish later.</p>
<h2>4. Complete the CF2798 (Child Care Arrangement form)</h2>
<p>This is the form that trips families up: the <strong>CF2798</strong> needs details from both you and your provider, plus the provider’s signature. Get a head-start with our free <a href="/tools/cf2798-child-care-arrangement-form">CF2798 helper</a> — and if your daycare runs on <a href="/">Mitten</a>, they can hand you a copy with their half already filled in.</p>
<h2>5. Renew every year</h2>
<p>The ACCB lapses annually. Mark your renewal date the day you’re approved — a missed renewal silently stops your reduction. (Daycares on Mitten get an automatic renewal-reminder radar for exactly this.)</p>
<h2>How much will you actually save?</h2>
<p>Between CCFRI’s automatic reduction, the ACCB on top, and the $10-a-day cap at participating sites, most BC families pay far less than the sticker price. Estimate your total with the <a href="/tools/bc-child-care-subsidy-calculator">subsidy calculator</a>, then find a centre with space on our <a href="/childcare">free childcare boards</a>.</p>`,
  },
  {
    slug: 'ccfri-explained-for-parents',
    tag: 'Subsidies',
    title: 'CCFRI Explained for Parents: BC Child Care Fee Reductions (2026 Amounts)',
    desc: 'What CCFRI is, the 2025–26 fee reduction amounts by age, why you don’t apply, and how it stacks with the Affordable Child Care Benefit and $10-a-day care in BC.',
    h1: 'CCFRI explained for parents',
    sub: 'The automatic BC fee reduction you don’t apply for — the 2025–26 amounts, the $10-a-day floor, and how it stacks with the other subsidies.',
    faqs: [
      ['Do I need to apply for CCFRI?', 'No. Families don’t apply for CCFRI — the child care provider opts the facility in, and the savings are passed to you automatically each month as a reduced fee. The Affordable Child Care Benefit is the separate one you apply for yourself.'],
      ['How much is the CCFRI reduction?', 'For 2025–26 (group/centre care): up to $900/month for infants and toddlers under 36 months, $545 for 3-years-to-Kindergarten, $320 for Kindergarten, $115 for Grade 1 to age 12, and $95 for preschool. Family/in-home rates differ. Fees are never reduced below $200/month ($10/day).'],
      ['How do I know if my daycare offers CCFRI?', 'Ask them, or check your invoice for a fee reduction line. Most licensed BC centres participate. If yours doesn’t, the reduction won’t apply — which is worth factoring into where you enrol.'],
    ],
    body: `
<p><strong>CCFRI</strong> — the Child Care Fee Reduction Initiative — is the BC subsidy that lowers your childcare fee <em>automatically</em> at a participating centre. You don’t apply, there’s no income test, and the savings simply show up as a reduced monthly fee.</p>
<h2>The 2025–26 fee reduction amounts</h2>
<table>
<thead><tr><th>Age category</th><th>Group / centre</th><th>Family / in-home</th></tr></thead>
<tbody>
<tr><td>Infant (0–18 months)</td><td>$900</td><td>$600</td></tr>
<tr><td>Toddler (18–36 months)</td><td>$900</td><td>$600</td></tr>
<tr><td>3 years to Kindergarten</td><td>$545</td><td>$500</td></tr>
<tr><td>Kindergarten</td><td>$320</td><td>$320</td></tr>
<tr><td>Grade 1 to age 12</td><td>$115</td><td>$145</td></tr>
<tr><td>Preschool (part-day)</td><td>$95</td><td>—</td></tr>
</tbody>
</table>
<p style="font-size:.9rem;color:var(--slate-5)">Full-time maximums. CCFRI won’t reduce a fee below $200/month ($10/day), or $140/month for preschool. Source: BC Ministry of Education and Child Care, CCFRI Funding Guidelines 2025–26.</p>
<h2>Why you don’t apply</h2>
<p>CCFRI is paid to the <em>provider</em>, who opts the facility in and passes the reduction to families. That’s the opposite of the <a href="/guides/how-to-apply-affordable-child-care-benefit-bc">Affordable Child Care Benefit</a>, which you apply for yourself and which is income-tested.</p>
<h2>How it stacks with the other subsidies</h2>
<ul>
<li><strong>CCFRI</strong> reduces your base fee automatically (above).</li>
<li><strong>Affordable Child Care Benefit</strong> applies on top, income-tested — for lower incomes it can take the rest close to $0.</li>
<li><strong>$10-a-day (CWELCC)</strong> sites cap the fee at about $200/month for full-time care.</li>
</ul>
<p>See what all three add up to for your family in the <a href="/tools/bc-child-care-subsidy-calculator">BC child care subsidy calculator</a>, then browse centres with space on our <a href="/childcare">childcare boards</a>.</p>`,
  },
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
  {
    slug: 'cwelcc-10-dollar-a-day-child-care-explained',
    tag: '$10-a-day & CWELCC',
    title: 'CWELCC Explained (2026): How $10-a-Day Child Care Actually Works in Canada',
    desc: 'What the Canada-Wide Early Learning and Child Care (CWELCC) program is, what fees look like in each province in 2026, who qualifies, and how it differs from child care subsidy.',
    h1: 'CWELCC & $10-a-day child care, explained',
    sub: 'What the program is, where fees actually stand in 2026, and what it means for your family or your centre.',
    faqs: [
      ['Is child care actually $10 a day now?', 'It depends on your province. Several provinces (including BC for many spaces, Manitoba, Saskatchewan and the Atlantic provinces) have reached an average of $10/day for regulated care. Ontario fees currently average about $19/day under a program extension through December 31, 2026. Quebec runs its own long-standing reduced-contribution system at roughly $9/day.'],
      ['Do I apply for CWELCC as a parent?', 'No — there is no parent application. If your child attends a licensed program that is enrolled in CWELCC, the reduced fee is automatic on your invoice. Your job is simply to choose a participating licensed program.'],
      ['Is CWELCC the same as child care subsidy?', 'No. CWELCC lowers the sticker price for every family at participating licensed programs regardless of income. Subsidy is a separate, income-tested program that can reduce your share further — in many provinces you can benefit from both at once.'],
      ['Does CWELCC cover home daycares?', 'Licensed/regulated home child care (for example, providers contracted with a licensed home child care agency in Ontario, or licensed family child care in BC) can participate. Unlicensed home daycares are never part of CWELCC.'],
    ],
    body: `
<p>In 2021 the federal government committed roughly $30 billion over five years to build a Canada-wide early learning and child care system — known as <strong>CWELCC</strong> — and signed agreements with every province and territory. The goal: cut regulated child care fees to an <strong>average of $10 a day</strong>. Five years in, here's where things actually stand and how the program works in practice.</p>
<h2>The big picture: how CWELCC works</h2>
<p>CWELCC money flows from Ottawa to your province, and from your province to <strong>licensed child care programs</strong> that enrol in the system. Enrolled programs agree to lower (and cap) parent fees and follow funding rules; in exchange, government funding replaces the fee revenue they gave up. Three things follow from this design:</p>
<ul>
<li><strong>Parents never apply.</strong> The discount is baked into the fee at participating programs.</li>
<li><strong>Only licensed care counts.</strong> Unlicensed home daycares, nannies and babysitters are outside the system.</li>
<li><strong>It applies to younger children.</strong> CWELCC fee reductions target children under six (school-age care follows ordinary fees).</li>
</ul>
<h2>Where fees stand by province (mid-2026)</h2>
<ul>
<li><strong>Ontario</strong> — fees at enrolled programs average about <strong>$19/day</strong>. Ontario and Canada signed a one-year extension (November 2025) keeping current reduced fees in place to <strong>December 31, 2026</strong>, with $695M in federal funding for the year. The $10/day goal remains, without a confirmed new date. See our <a href="/guides/10-dollar-a-day-child-care-ontario">Ontario deep-dive</a>.</li>
<li><strong>British Columbia</strong> — a mix: a growing list of <strong>$10-a-Day ChildCareBC</strong> sites charge exactly $10/day (or $0 for low-income families), while other licensed providers offer reduced fees through the Child Care Fee Reduction Initiative, often paired with the income-tested Affordable Child Care Benefit.</li>
<li><strong>Alberta</strong> — affordability grants and subsidy bring fees for most families to an average around $15/day or less, with the federal target tracking toward $10.</li>
<li><strong>Manitoba, Saskatchewan, and the Atlantic provinces</strong> — generally at <strong>$10/day average</strong> for regulated care already.</li>
<li><strong>Quebec</strong> — runs its own reduced-contribution network (the original model CWELCC copied) at roughly <strong>$9/day</strong>, indexed annually.</li>
</ul>
<p><em>Numbers move with announcements — this page is reviewed when provinces update their agreements.</em></p>
<h2>CWELCC vs. subsidy: the distinction that confuses everyone</h2>
<p><strong>CWELCC cuts the sticker price for everyone.</strong> <strong>Subsidy cuts your share based on income.</strong> They stack: an Ontario family can pay the CWELCC-reduced fee and then have part of that covered by municipal fee subsidy; a BC family can attend a fee-reduced centre and apply the Affordable Child Care Benefit on top. If money is tight, always ask about both.</p>
<h2>What it means for operators</h2>
<p>Joining CWELCC trades pricing freedom for funding stability and a powerful marketing fact (your posted fee drops dramatically). It also brings real administrative obligations — enrolment paperwork, fee caps, cost reporting, and audits. We wrote a dedicated guide: <a href="/guides/cwelcc-for-daycare-operators">CWELCC for operators</a>. Software that keeps clean attendance, enrolment and billing records makes the reporting side dramatically lighter — that's exactly what Mitten produces as a by-product of daily use.</p>`,
  },
  {
    slug: '10-dollar-a-day-child-care-ontario',
    tag: '$10-a-day & CWELCC',
    title: '$10-a-Day Child Care in Ontario (2026): Current Fees, Extension & How to Get It',
    desc: 'Ontario CWELCC in 2026: fees average about $19/day under the one-year extension to December 31, 2026. What parents pay, how to find an enrolled program, and what comes next.',
    h1: '$10-a-day child care in Ontario: where it actually stands',
    sub: 'Fees average ~$19/day in 2026 under a one-year extension — here is how the program works, how to benefit, and what is coming.',
    faqs: [
      ['How much is daycare in Ontario with CWELCC in 2026?', 'Fees at enrolled programs average about $19 per day (roughly $400 a month) for children under six â about half of pre-program fees. Exact amounts vary by program because reductions were applied to each program’s 2022 fee levels.'],
      ['Did Ontario reach $10-a-day child care?', 'Not yet. The March 2026 target was replaced by a one-year extension (signed November 10, 2025) that keeps current reduced fees — about $19/day on average — through December 31, 2026, backed by $695 million in federal funding. The $10 goal remains without a confirmed new date.'],
      ['How do I get the reduced fee?', 'Enrol your child in a licensed program that participates in CWELCC. There is no application and no income test — the reduced fee appears directly on your invoice. Your municipality publishes lists of participating programs.'],
      ['Can I also get child care subsidy in Ontario?', 'Yes. Ontario’s income-tested fee subsidy (administered by municipalities) is separate from CWELCC and can reduce your share of the already-reduced fee. Apply through your local service system manager (e.g., the City of Toronto).'],
    ],
    body: `
<p>Ontario signed onto the federal $10-a-day program in March 2022, and fees for young children at participating licensed programs have fallen by more than half since. Here's the honest, current picture for families and operators — without the headline spin.</p>
<h2>The state of play in 2026</h2>
<ul>
<li><strong>Average fee: about $19/day</strong> at CWELCC-enrolled programs for children under six.</li>
<li><strong>The $10 target was pushed.</strong> On November 10, 2025, Ontario and Canada signed a one-year extension keeping current fees in place until <strong>December 31, 2026</strong>, with $695M of federal funding. The extension buys time to address educator shortages and space targets before further cuts.</li>
<li><strong>Fees are capped.</strong> Enrolled operators cannot raise base fees above their frozen caps, so the discount can't quietly erode.</li>
<li><strong>Spaces are growing.</strong> Ontario reports ~41,000 net new spaces toward its 86,000-space target (relative to 2019) by end of 2026 — but demand still outruns supply in most cities, so waitlists remain the real constraint.</li>
</ul>
<h2>How to actually benefit (parents)</h2>
<ol>
<li><strong>Confirm the program is licensed</strong> — only licensed centres and agency-contracted home providers can participate.</li>
<li><strong>Ask directly: "Are you enrolled in CWELCC?"</strong> Most licensed programs are, but participation is voluntary, and the difference is thousands of dollars a year.</li>
<li><strong>Get on waitlists early</strong> — in Toronto, Ottawa and most cities, the binding constraint is a spot, not the fee. Start in pregnancy for infant care; it isn't overkill.</li>
<li><strong>Stack subsidy if eligible</strong> — municipal fee subsidy is income-tested, separate, and applies on top. Apply through your city.</li>
</ol>
<h2>What operators should know</h2>
<p>CWELCC in Ontario now runs on a <strong>cost-based funding formula</strong>: government funding covers eligible costs (with benchmarks) rather than simply topping up revenue. That makes clean records — enrolment counts, attendance, staffing hours, fee collection — the difference between smooth reporting and painful audits. Our <a href="/guides/cwelcc-for-daycare-operators">operator guide</a> covers enrolment, fee caps and reporting; our <a href="/guides/daycare-profit-margin-guide">margin guide</a> covers staying viable under caps.</p>
<h2>What happens after December 31, 2026?</h2>
<p>Unknown — the extension explicitly defers the question. Watch for a renegotiated agreement in late 2026; this page is updated when announcements land. <em>Last reviewed June 2026.</em></p>`,
  },
  {
    slug: 'is-my-daycare-part-of-cwelcc',
    tag: '$10-a-day & CWELCC',
    title: 'Is My Daycare Part of CWELCC? How to Check (Every Province, 2026)',
    desc: 'Three ways to confirm whether a daycare participates in the $10-a-day CWELCC program — what to ask, where the official lists are, and red flags that a "discount" is not the real program.',
    h1: 'Is my daycare part of CWELCC? How to check',
    sub: 'The three-step check, province by province — and the red flags that a discount is not the real program.',
    faqs: [
      ['Can an unlicensed daycare be part of CWELCC?', 'No. Only licensed/regulated child care can enrol â licensed centres, and home providers operating under a licensed agency (Ontario) or holding a family child care licence (BC, Alberta and others). An unlicensed provider advertising "$10/day" is simply setting a low price, with none of the program’s oversight.'],
      ['My centre is licensed but my fee did not go down. Why?', 'Three common reasons: the program chose not to enrol in CWELCC (participation is voluntary), your child is six or older (reductions target under-6 care), or you are looking at extra charges (late pickup, meals, field trips) that sit outside the capped base fee. Ask the director which applies.'],
      ['Does CWELCC apply to before/after school care?', 'No — fee reductions apply to children under six. School-age programs charge regular fees, though income-tested subsidy may still help.'],
    ],
    body: `
<p>The fastest way to find out is to ask — but here's how to verify the answer, because "we offer affordable care" and "we are enrolled in CWELCC" are very different sentences.</p>
<h2>The three-step check</h2>
<ol>
<li><strong>Is it licensed?</strong> Every province publishes a licensed child care registry/search. If the program isn't in it, stop — it cannot be in CWELCC.</li>
<li><strong>Ask the magic question:</strong> "Are you enrolled in CWELCC?" (in BC: "Are you a $10-a-Day site, or in the Fee Reduction Initiative?"). Enrolled operators know exactly what this means and will answer instantly. Vague answers are themselves an answer.</li>
<li><strong>Check the official list.</strong> Ontario municipalities (Toronto, Peel, Ottawa, etc.) publish participating-program lists; BC publishes the $10-a-Day site list; Alberta publishes affordability-grant participants. Search your municipality + "CWELCC list".</li>
</ol>
<h2>What the invoice should look like</h2>
<p>At an enrolled program, the reduction is on the invoice itself — you pay the reduced base fee, full stop. You should <em>not</em> need to pay full price and claim something back, and there's no CWELCC paperwork with your name on it. (Keep receipts anyway — reduced fees are still <a href="/guides/child-care-expenses-deduction-canada">tax-deductible child care expenses</a>.)</p>
<h2>Red flags</h2>
<ul>
<li>"$10/day" advertised by an <strong>unlicensed</strong> home daycare — legal as a price, but it carries no licensing oversight and no funding rules.</li>
<li>A "discount" that requires cash payment or skips receipts — that's a provider avoiding records, not a government program.</li>
<li>Base fee fine print: enrolled programs have capped base fees, but optional extras can be charged — make sure you know which is which.</li>
</ul>
<h2>For operators reading this</h2>
<p>If parents keep asking you this question, put the answer on your website and intake forms — "We are enrolled in CWELCC; your fee is $X/day" converts tours like nothing else. Mitten's invoicing shows the reduced fee cleanly per family, so the paper trail parents (and auditors) want is automatic.</p>`,
  },
  {
    slug: 'cwelcc-for-daycare-operators',
    tag: '$10-a-day & CWELCC',
    title: 'CWELCC for Operators (2026): Enrolment, Fee Caps, Funding & Reporting',
    desc: 'A plain-English operator guide to CWELCC: whether to enrol, how fee caps work, what cost-based funding means in Ontario, wage floors, and the records you need to survive reporting.',
    h1: 'CWELCC for operators: the practical guide',
    sub: 'Whether to enrol, what you trade, how the money flows, and the records that make reporting painless.',
    faqs: [
      ['Is joining CWELCC mandatory for licensed daycares?', 'No — participation is voluntary. But the market pressure is real: enrolled competitors post fees roughly half of yours. Most licensed under-6 programs in Canada have enrolled.'],
      ['Can I raise my fees if I am in CWELCC?', 'Base parent fees are capped (in Ontario, tied to your 2022 fee schedule). Cost increases are addressed through the funding formula rather than parent fees. Optional extras outside the base fee follow provincial rules — document them carefully.'],
      ['What records does CWELCC reporting require?', 'Expect to substantiate enrolment counts by age group, attendance, parent fees charged and collected, staffing and wage costs, and eligible expenses. Clean monthly records turn reporting into an export; messy ones turn it into an audit.'],
    ],
    body: `
<p>CWELCC is the biggest structural change to Canadian child care economics in a generation. For operators it's a real trade: pricing freedom for funding stability. Here's how to think it through and run it well. <em>(Rules vary by province — Ontario is the worked example here; confirm specifics with your service system manager or ministry.)</em></p>
<h2>The trade you're making</h2>
<p><strong>You give up:</strong> setting your own base fees (caps), some expansion flexibility (space growth is managed), and you take on reporting obligations.<br/>
<strong>You get:</strong> government funding replacing the parent revenue you forgo, dramatically more affordable posted fees (which fills rooms and waitlists), wage support for your educators, and insulation from the fee-sensitivity that caps small-program pricing power anyway.</p>
<p>For most under-6 programs, enrolling is the right call — an unenrolled centre competes against neighbours charging half as much. The genuine exceptions: programs serving mostly 6+, premium niche models, and providers unwilling to carry the admin load.</p>
<h2>How the money flows (Ontario's cost-based model)</h2>
<p>Since January 2025 Ontario funds enrolled programs on a <strong>cost-based formula</strong>: funding is built from benchmarked eligible costs (staffing, accommodation, operations) plus top-ups, rather than simply replacing revenue. Practical consequences:</p>
<ul>
<li><strong>Your cost records are now revenue documents.</strong> Staffing hours, wages, rent and program costs determine funding.</li>
<li><strong>Wage floors matter:</strong> Ontario sets a rising wage floor for eligible RECEs (mid-$20s per hour and climbing annually) funded through the formula — budget for it and claim it.</li>
<li><strong>Timing:</strong> funding flows through your municipality/service system manager on their reporting calendar. Late or sloppy reports delay cash.</li>
</ul>
<h2>Surviving reporting: the record-keeping spine</h2>
<ol>
<li><strong>Enrolment & attendance by age group</strong> — daily, timestamped, exportable.</li>
<li><strong>Fees charged and collected per family</strong> — invoices, receipts, and arrears that reconcile.</li>
<li><strong>Staffing records</strong> — schedules, actual hours, wages, certifications.</li>
<li><strong>Expense documentation</strong> — categorized, with receipts, mapped to eligible-cost categories.</li>
</ol>
<p>This is the unglamorous reason software pays for itself under CWELCC: attendance, enrolment, invoicing and staff hours are exactly what Mitten records as a by-product of daily use — reporting becomes an export, not a reconstruction. (See also: <a href="/guides/daycare-payroll-guide-canada">payroll guide</a>, <a href="/guides/daycare-profit-margin-guide">margin guide</a>.)</p>
<h2>Watch the calendar</h2>
<p>Ontario's current agreement runs to <strong>December 31, 2026</strong>; renegotiation will set the next phase. Funding formulas get tweaked annually province-wide. Subscribe to your service system manager's operator bulletins — and assume the only constant is that documentation requirements grow.</p>`,
  },
  {
    slug: 'how-to-start-a-daycare-in-ontario',
    tag: 'Starting up',
    title: 'How to Start a Daycare in Ontario (2026): Licensing, Costs & Step-by-Step',
    desc: 'The step-by-step path to opening a licensed child care centre in Ontario — CCEYA licensing, the application process, staffing and ratio rules, realistic costs, and CWELCC.',
    h1: 'How to start a daycare in Ontario',
    sub: 'The CCEYA licence path, realistic costs and timelines, staffing rules, and whether to join CWELCC on day one.',
    faqs: [
      ['Do I need a licence to run a daycare in Ontario?', 'You need a licence under the CCEYA the moment you care for more than five children under 13 (other than your own relatives). Five or fewer can operate as an unlicensed home daycare under strict rules — see our home daycare guide.'],
      ['How long does Ontario daycare licensing take?', 'Plan for 6–12 months from application to opening for a centre: finding and renovating a compliant space and passing municipal zoning, fire and health approvals usually take longer than the ministry review itself.'],
      ['How much does it cost to open a daycare in Ontario?', 'Centre build-outs commonly run from tens of thousands (modest leasehold conversion) into the hundreds of thousands (new build-out in a major city) before first revenue — space, renovations to meet O. Reg. 137/15 requirements, equipment, insurance, and staffing through the licensing period are the big lines.'],
      ['Should a new Ontario daycare join CWELCC?', 'New spaces are subject to Ontario’s managed growth â directed growth plans determine where new CWELCC spaces are approved. Apply early through your municipality; an enrolled program posts fees roughly half of an unenrolled one, which transforms fill-up speed.'],
    ],
    body: `
<p>Ontario licenses child care under the <strong>Child Care and Early Years Act, 2014 (CCEYA)</strong> and O. Reg. 137/15, administered by the Ministry of Education. Here's the practical path from idea to open doors. <em>(General guidance — the <a href="https://www.ontario.ca/page/child-care-rules-ontario" rel="nofollow">ministry's rules pages</a> and your licensing program advisor are the binding sources.)</em></p>
<h2>Step 0 — Pick your model</h2>
<ul>
<li><strong>Licensed child care centre</strong> — what this guide covers. Any group care beyond five children requires it.</li>
<li><strong>Home daycare</strong> — up to five children unlicensed, or six through a licensed home child care agency. Different economics entirely: see <a href="/guides/how-to-start-a-home-daycare-in-ontario">our home daycare guide</a>.</li>
</ul>
<h2>Step 1 — Space first (it's the long pole)</h2>
<p>Most licensing timelines are really real-estate timelines. Your space needs municipal <strong>zoning</strong> approval for child care use, <strong>fire</strong> and <strong>health</strong> sign-offs, and must meet O. Reg. 137/15 physical requirements — including <strong>2.8 m² of unobstructed indoor play space per child</strong>, age-appropriate outdoor play space (5.6 m²/child for most programs), separate rooms per age group, and washroom/diapering provisions. Engage the municipality before signing a lease; a beautiful space that can't be zoned is a very expensive mistake.</p>
<h2>Step 2 — Apply through the Child Care Licensing System (CCLS)</h2>
<p>Ontario's licensing runs through the online CCLS portal: corporate documents, floor plans, policies (anaphylaxis, safe sleep, behaviour guidance, emergency management, and more), staffing plans, and menus. A program advisor is assigned, reviews everything, and inspects the site. Expect iteration — the advisors are genuinely helpful if you treat the process as collaborative.</p>
<h2>Step 3 — Staffing to ratio</h2>
<p>Every age group needs qualified staff at <a href="/guides/ontario-daycare-ratios-and-group-sizes">Schedule 1 ratios</a> — e.g. infants 3 staff per 10 children, toddlers 1:5, preschool 1:8 — with <strong>RECE</strong> (Registered Early Childhood Educator) requirements per group, vulnerable sector checks, first aid/CPR-C, and a designated supervisor meeting experience requirements. Recruiting RECEs is currently the hardest part of opening in most Ontario cities; start hiring before your licence lands.</p>
<h2>Step 4 — The money</h2>
<p>Budget honestly: leasehold improvements, equipment (cribs, tables, playground), licensing/professional fees, insurance, and several months of payroll before enrolment catches up. Then decide on <a href="/guides/cwelcc-for-daycare-operators">CWELCC enrolment</a> — for under-6 programs it roughly halves your posted fees and transforms fill-up speed, at the cost of fee caps and reporting. Our <a href="/guides/daycare-tuition-pricing-guide">pricing guide</a> and <a href="/guides/daycare-profit-margin-guide">margin guide</a> cover the unit economics.</p>
<h2>Step 5 — Open well</h2>
<p>Enrolment momentum comes from waitlists collected <em>during</em> the licensing year, tours that show parents what their phone sees at 2pm, and clean professional invoicing from day one. That operational layer — enrolment, attendance, daily reports, billing, staff hours — is exactly what Mitten handles, free for your first five children, so the software cost arrives only as revenue does.</p>`,
  },
  {
    slug: 'how-to-start-a-home-daycare-in-ontario',
    tag: 'Starting up',
    title: 'How to Start a Home Daycare in Ontario (2026): Rules, Limits & Licensed Agencies',
    desc: 'Ontario home daycare rules in plain English: the five-child unlicensed limit, what counts toward it, joining a licensed home child care agency, insurance, taxes and realistic income.',
    h1: 'How to start a home daycare in Ontario',
    sub: 'The unlicensed five-child rules, the licensed agency route, and the business basics that keep you safe and profitable.',
    faqs: [
      ['How many children can I care for without a licence in Ontario?', 'At most five children under 13 — and your own children under four count toward the five. Within that, no more than three children may be under two years old. Care for a sixth (non-relative) child and you are operating illegally.'],
      ['What is licensed home child care in Ontario?', 'Home providers contracted with a ministry-licensed home child care agency. The agency screens, trains, inspects and supports you; in exchange you can care for up to six children, access CWELCC reduced fees for your families, and get referrals.'],
      ['Do home daycare parents get tax receipts?', 'Yes — you must issue receipts. Parents claim child care expenses on their returns, and as an individual provider your receipt must include your SIN. See our receipts guide for exactly what goes on one.'],
    ],
    body: `
<p>Home daycare is the fastest, lowest-capital way into child care — and Ontario's rules are strict but simple once translated. <em>(Binding source: the CCEYA and <a href="https://www.ontario.ca/page/child-care-rules-ontario" rel="nofollow">ontario.ca's rules for unlicensed child care</a>.)</em></p>
<h2>The unlicensed limits, precisely</h2>
<ul>
<li><strong>Maximum five children under 13</strong> at any one time — <strong>including your own children under four</strong>.</li>
<li>Of those five, <strong>no more than three may be under two years old</strong>.</li>
<li>You must not advertise or operate as "licensed", and you must follow basic safety rules (e.g., you can't care for children in a home where someone is on the child abuse registry; serious occurrences have reporting obligations).</li>
</ul>
<p>These limits are per-premises and enforced — operating over them risks orders, fines and shutdown, and it voids most insurance.</p>
<h2>Unlicensed vs. licensed agency: the real decision</h2>
<p><strong>Stay unlicensed</strong> for maximum autonomy: you set fees, choose families, answer to no agency — but you're capped at five, outside CWELCC (your families pay full fee with after-tax dollars they can partly deduct), and you carry compliance alone.<br/>
<strong>Join a licensed home child care agency</strong> to care for up to <strong>six</strong> children, give your families CWELCC-reduced fees (a massive competitive edge when the centre down the road charges $19/day), and get inspections, training, backup and referrals — in exchange for agency oversight and their slice of the economics. As CWELCC matures, the agency route keeps getting relatively stronger.</p>
<h2>Set up like a business from day one</h2>
<ol>
<li><strong>Insurance</strong> — home daycare liability coverage (your home policy alone does not cover this; tell your insurer or get a specialized policy).</li>
<li><strong>Contracts</strong> — fees, hours, late pickup, holidays, termination notice, illness policy. In writing, signed before the first day.</li>
<li><strong>Receipts & taxes</strong> — issue receipts (with your SIN), report income, and deduct aggressively-but-correctly: a share of rent/mortgage interest, utilities and food, supplies, toys, insurance. Full details in our <a href="/guides/daycare-taxes-canada">daycare tax guide</a> and <a href="/guides/daycare-tax-receipts-cra-guide">receipts guide</a>.</li>
<li><strong>Records</strong> — daily attendance, signed agreements, incident notes. Protects you in disputes and substantiates your income and deductions.</li>
</ol>
<h2>What you can earn</h2>
<p>Five full-time spots at typical unlicensed Ontario rates ($45–$65/day depending on region and age mix) gross roughly $55k–$80k/year before expenses; the agency route trades a little per-spot revenue for a sixth spot and zero-vacancy referrals. The killers are vacancy gaps and unpaid invoices — which is why waitlists and clean invoicing matter as much as craft skills. Mitten is free at home-daycare scale (up to five children) and handles daily photo updates, attendance, invoicing and receipts — the professional polish that justifies your rate.</p>`,
  },
  {
    slug: 'ontario-daycare-ratios-and-group-sizes',
    tag: 'Rules & ratios',
    title: 'Ontario Daycare Ratios 2026: Infant, Toddler & Preschool (CCEYA)',
    desc: 'Ontario staff-to-child ratios and maximum group sizes under O. Reg. 137/15 — infant 3:10, toddler 1:5, preschool 1:8, kindergarten 1:13 — plus reduced-ratio nap/open-close windows and mixed-age rules.',
    h1: 'Ontario daycare ratios & group sizes',
    sub: 'Schedule 1 in plain English: the numbers, the reduced-ratio windows, and the mixed-age rules.',
    faqs: [
      ['What is the infant ratio in Ontario daycares?', 'Licensed centres run infant rooms (under 18 months) at 3 staff per 10 children with a maximum group size of 10 — and infant ratios can never be reduced, at any time of day.'],
      ['How many toddlers can one ECE supervise in Ontario?', 'Toddler groups (18–30 months) run at 1 staff per 5 children, maximum group of 15 (so a full toddler room has 3 staff).'],
      ['Can ratios be reduced during naps in Ontario?', 'Toddler and preschool groups may operate at half ratio during a rest period of up to two hours if another staff member is available on the premises for emergencies — infant groups never reduce. There is also a limited reduced-ratio window around opening and closing (not for infants).'],
      ['How many children can an unlicensed home daycare have?', 'Five children under 13 maximum (counting the provider’s own children under four), with at most three under two. Licensed agency home providers may have six.'],
    ],
    body: `
<p class="note"><strong>Updated June 2026.</strong> Quick answer — licensed Ontario centres run at <strong>infant 3:10, toddler 1:5, preschool 1:8, kindergarten 1:13</strong> and primary school-age 1:15. The full Schedule 1 table, plus the reduced-ratio nap and open/close windows, is below.</p>
<p>Ratios are the load-bearing rule of Ontario child care: they set your staffing, your room layout, and most of your cost structure. Here is <strong>Schedule 1 of O. Reg. 137/15</strong> (under the CCEYA), translated. <em>(Authoritative source: the <a href="https://www.ontario.ca/document/child-care-centre-licensing-manual/part-3-ratios-and-group-size" rel="nofollow">ministry licensing manual, Part 3</a>.)</em></p>
<h2>The core ratio table (licensed centres)</h2>
<table style="width:100%;border-collapse:collapse;margin:.4rem 0 1.1rem;font-size:.97rem">
<thead><tr style="text-align:left;border-bottom:2px solid currentColor"><th style="padding:.5rem .6rem">Age group</th><th style="padding:.5rem .6rem">Staff-to-child ratio</th><th style="padding:.5rem .6rem">Max group size</th></tr></thead>
<tbody>
<tr style="border-bottom:1px solid rgba(120,120,120,.22)"><td style="padding:.5rem .6rem"><strong>Infant</strong> (under 18 months)</td><td style="padding:.5rem .6rem">3 staff : 10 children</td><td style="padding:.5rem .6rem">10</td></tr>
<tr style="border-bottom:1px solid rgba(120,120,120,.22)"><td style="padding:.5rem .6rem"><strong>Toddler</strong> (18–30 months)</td><td style="padding:.5rem .6rem">1 : 5</td><td style="padding:.5rem .6rem">15</td></tr>
<tr style="border-bottom:1px solid rgba(120,120,120,.22);background:rgba(46,184,138,.10)"><td style="padding:.5rem .6rem"><strong>Preschool</strong> (30 months–6 years)</td><td style="padding:.5rem .6rem"><strong>1 : 8</strong></td><td style="padding:.5rem .6rem">24</td></tr>
<tr style="border-bottom:1px solid rgba(120,120,120,.22)"><td style="padding:.5rem .6rem"><strong>Kindergarten</strong> (44 months+)</td><td style="padding:.5rem .6rem">1 : 13</td><td style="padding:.5rem .6rem">26</td></tr>
<tr style="border-bottom:1px solid rgba(120,120,120,.22)"><td style="padding:.5rem .6rem"><strong>Primary / junior school age</strong> (68 months+)</td><td style="padding:.5rem .6rem">1 : 15</td><td style="padding:.5rem .6rem">30</td></tr>
<tr><td style="padding:.5rem .6rem"><strong>Junior school age</strong> (9–12 years)</td><td style="padding:.5rem .6rem">1 : 20</td><td style="padding:.5rem .6rem">20</td></tr>
</tbody></table>
<p>Within each group, qualification rules apply (e.g., RECE requirements per group), and group sizes are hard caps per licensed room — a 26th preschooler doesn't mean one more educator, it means another licensed group.</p>
<h2>The flexibility windows (and their limits)</h2>
<ul>
<li><strong>Opening/closing:</strong> for the first 90 minutes after opening and before closing, most groups may run at two-thirds ratio. <strong>Never infants.</strong></li>
<li><strong>Rest period:</strong> toddler and preschool groups may run at half ratio for up to two hours during sleep, provided another adult is available on site for emergencies. <strong>Never infants.</strong></li>
<li><strong>Mixed-age grouping:</strong> a licensed group may include a limited share (generally up to 20% of group size) of younger children, with the group then following the younger rules in specific ways — this is where directors most often get tripped up; confirm your configuration with your program advisor.</li>
</ul>
<h2>What this means for your budget</h2>
<p>Infant care needs one educator per ~3.3 children — which is why infant fees are highest and infant rooms are usually loss-leaders covered by preschool rooms (1:8). When you model a new room, model the <em>staffing step function</em>, not the average: the 11th infant requires a whole new group. Our <a href="/guides/daycare-profit-margin-guide">margin guide</a> walks the math, and Mitten's live ratio dashboard shows each room against its requirement in real time — including the nap-window allowance.</p>
<h2>Home daycare limits</h2>
<p>Unlicensed: max <strong>5</strong> children under 13 (your own under-fours count), max 3 under two. Licensed agency homes: <strong>6</strong>. Full details in the <a href="/guides/how-to-start-a-home-daycare-in-ontario">home daycare guide</a>.</p>`,
  },
  {
    slug: 'how-to-export-your-data-from-brightwheel',
    tag: 'Software help',
    title: 'How to Export Your Data From Brightwheel (2026): Rosters, Billing & Photos',
    desc: 'A practical guide to getting your roster, attendance, billing history and photos out of Brightwheel — what exports exist, what to request from support, and a checklist so nothing is lost.',
    h1: 'How to export your data from Brightwheel',
    sub: 'What you can export yourself, what to request from support, and the checklist that makes sure nothing gets left behind.',
    faqs: [
      ['Can I export everything from Brightwheel myself?', 'Reports and rosters generally export as CSV/Excel from the admin web dashboard report screens. Bulk photo/video export and complete historical archives typically require a request to Brightwheel support — ask before you cancel, while your account is active.'],
      ['Who owns the data in Brightwheel â me or them?', 'Your program’s records are your business records. Vendors’ terms govern the platform copy, but you are entitled to (and responsible for) keeping your own records â export them before any cancellation takes effect.'],
      ['What should I export before cancelling Brightwheel?', 'At minimum: child & family roster with contacts, attendance history, billing/payment history per family (you need it for taxes and disputes), staff records and hours, immunization/medical notes, and photos/videos. Export receipts and year-end statements families might request later.'],
    ],
    body: `
<p>Whether you're switching platforms, closing a program, or just want your own backup (smart), here's how to get your information out of Brightwheel cleanly. Do this <strong>while your subscription is active</strong> — access typically ends when billing does.</p>
<h2>Step 1 — Export what the dashboard gives you</h2>
<p>From the admin <strong>web</strong> dashboard (not the mobile app), work through the reporting screens and download CSV/Excel where offered. The usual self-serve set:</p>
<ul>
<li><strong>Student roster</strong> — children, rooms, parent/guardian contacts, authorized pickups.</li>
<li><strong>Attendance reports</strong> — pick the widest date range available and export by room and by child.</li>
<li><strong>Billing reports</strong> — invoices, payments received, balances per family. Export both summary and detailed/transaction views; your accountant and the CRA care about the detail.</li>
<li><strong>Staff records</strong> — profiles and any tracked hours.</li>
</ul>
<h2>Step 2 — Request what isn't self-serve</h2>
<p>Email support (from your owner/admin account) and explicitly request: <strong>a complete export of all photos and videos</strong>, full historical daily-report data, and any records not available in dashboard reports. Name your program, your role, and a deadline. Vendors handle these requests routinely — but turnaround varies, so start this two to three weeks before you intend to cancel.</p>
<h2>Step 3 — The nothing-left-behind checklist</h2>
<ul>
<li>☐ Roster + contacts (CSV)</li>
<li>☐ Attendance history (CSV, full range)</li>
<li>☐ Billing: invoices, payments, balances (CSV) — keep 6 years for CRA</li>
<li>☐ Year-end tax statements/receipts issued to families</li>
<li>☐ Photos & videos (bulk export via support)</li>
<li>☐ Medical/immunization/allergy notes</li>
<li>☐ Staff records and hours</li>
<li>☐ Any signed digital forms/agreements</li>
</ul>
<h2>Step 4 — Verify, then cancel</h2>
<p>Open the files, check date ranges and family counts, store a copy somewhere durable (cloud drive + local). Only then start <a href="/guides/how-to-cancel-brightwheel">cancellation</a> — and if the reason you're exporting is a switch, Mitten imports your roster CSV directly: most programs are fully moved in an afternoon, parents join by link with no app-store download, and it's free up to 5 children with published pricing after ($20/mo + $2/child).</p>`,
  },
  {
    slug: 'how-to-cancel-brightwheel',
    tag: 'Software help',
    title: 'How to Cancel Brightwheel (2026): Steps, Timing & What Happens to Your Data',
    desc: 'How to cancel a Brightwheel subscription cleanly: who can cancel, contract timing, the data to export first, how to tell parents, and a smooth switch path.',
    h1: 'How to cancel Brightwheel (without losing anything)',
    sub: 'The right order of operations: export, confirm terms, notify families, then cancel.',
    faqs: [
      ['How do I cancel my Brightwheel subscription?', 'As the account owner/admin, review your plan terms (annual contracts may have renewal dates that matter), export your data, then cancel through your account settings or by contacting Brightwheel support/your account manager and requesting written confirmation of the end date.'],
      ['Will I lose my data when I cancel Brightwheel?', 'Expect access to end with your subscription. Export rosters, attendance, billing history and photos before the end date — bulk photo export usually requires a support request, which takes time.'],
      ['Can I get a refund for unused months?', 'Depends entirely on your contract terms (monthly vs annual, renewal date). Check the agreement and ask directly â and diarize next year’s renewal date if you’re staying through a term.'],
    ],
    body: `
<p>Cancelling childcare software is mostly about sequencing — done in the right order it's painless; done backwards you lose photos and billing history families will ask about for years. Here's the order.</p>
<h2>1. Check your contract before you announce anything</h2>
<p>Find your agreement (or ask your account manager for it): monthly or annual? When does it renew? Is there a notice period? Annual plans commonly renew automatically — a well-timed cancellation beats an argument about a surprise renewal charge.</p>
<h2>2. Export everything first</h2>
<p>Access typically ends when the subscription does, and bulk photo exports need a support request with lead time. Work through our full <a href="/guides/how-to-export-your-data-from-brightwheel">Brightwheel export guide</a> — roster, attendance, billing detail (CRA wants 6 years), photos, signed forms.</p>
<h2>3. Plan the family transition</h2>
<p>Parents experience the change as "my daily photos moved." Make it a two-line message: what's changing, what they need to do (usually: click one link), and the date. Run both systems for a few overlap days if you can — it converts anxiety into a non-event.</p>
<h2>4. Cancel in writing</h2>
<p>Cancel via your account settings or account manager, and get <strong>written confirmation of the final billing date and access end date</strong>. Screenshot your confirmation. If payments/tuition ran through the platform, confirm the last payout date and reconcile it against your bank.</p>
<h2>5. If you're switching, the grass-is-greener check</h2>
<p>Whatever drove the cancellation — price creep, processing fees, support queues — make sure the next platform actually fixes it. Mitten publishes pricing (free ≤5 children; $20/mo + $2/child after), takes no cut of tuition card payments beyond Stripe's standard processing, imports your exported roster CSV directly, and parents join via link. The <a href="/guides/how-to-switch-daycare-software-without-losing-data">switching guide</a> has the full migration playbook.</p>`,
  },
  {
    slug: 'brightwheel-app-problems-and-fixes',
    tag: 'Software help',
    title: 'Brightwheel App Not Working? Fixes for Notifications, Check-In & Login (2026)',
    desc: 'Practical fixes when Brightwheel misbehaves: parents not getting notifications or photos, check-in/QR problems, login loops, and missing daily reports — plus when the problem is not fixable.',
    h1: 'Brightwheel not working? The practical fix list',
    sub: 'The fixes that actually resolve notification, check-in and login complaints — and how to tell a glitch from a structural problem.',
    faqs: [
      ['Why are parents not getting Brightwheel notifications?', 'In most cases it’s device-level: notifications disabled for the app, battery-saver/focus modes suppressing them, or a stale login. Have the parent open the app settings, re-enable notifications, and sign out and back in. If one parent gets updates and the other doesn’t, check both are actually attached to the child profile.'],
      ['Why is Brightwheel check-in not working at drop-off?', 'Usual suspects: a kiosk device on poor Wi-Fi, a stale browser/app session, the room not assigned, or the family’s code/QR changed. Refresh the kiosk session and verify connectivity; keep a paper fallback so drop-off never queues behind a glitch.'],
      ['Brightwheel says my email is already in use — what do I do?', 'The family was probably invited twice or has a legacy account. Use the password reset on that email first; if it tangles roles (staff vs parent), support has to merge the accounts — ask them to consolidate to one login.'],
    ],
    body: `
<p>When the parent app misbehaves, educators wear the complaints. This list resolves the bulk of "Brightwheel isn't working" reports — in rough order of likelihood. (It's written for Brightwheel but the logic fits any childcare app.)</p>
<h2>Parents not receiving photos/notifications</h2>
<ol>
<li><strong>Device settings:</strong> app notifications enabled? Focus/Do-Not-Disturb or battery saver suppressing them? (Android battery optimizers are notorious.)</li>
<li><strong>Stale session:</strong> sign out, sign back in. Update the app. This fixes more than anyone admits.</li>
<li><strong>Wrong attachment:</strong> confirm the specific parent is attached to the child profile — the #1 cause when one parent gets everything and the other gets nothing.</li>
<li><strong>Email vs push confusion:</strong> check which channels the parent expects vs what's configured.</li>
</ol>
<h2>Check-in / kiosk problems at drop-off</h2>
<ol>
<li>Refresh the kiosk session at open; verify Wi-Fi where the kiosk actually sits (door dead-zones are common).</li>
<li>Confirm the child is assigned to the right room for the day.</li>
<li>Keep a paper sign-in fallback — licensing wants attendance regardless of app status, and the queue at 8am can't wait for a reboot.</li>
</ol>
<h2>Login loops and "email already in use"</h2>
<p>Almost always duplicate invitations or a parent who is also staff somewhere. Password-reset the existing account first; if roles are tangled, only vendor support can merge accounts — request a consolidation explicitly.</p>
<h2>Missing daily reports</h2>
<p>Check the room device actually synced before staff clocked out (offline edits queue silently), and that the child was checked into the room the entries were logged against. Set a 15-minute pre-close routine: sync check, then send.</p>
<h2>When it's not a glitch</h2>
<p>If your real complaints are <em>recurring</em> — support tickets that take days, price increases at renewal, processing fees on tuition, parents who can't manage another app login — those aren't bugs to fix, they're product economics. For owner-operated programs, Mitten's answer is structural: parents use a simple link (no app-store download, no login wall for grandparents on the photo feed), pricing is published (free ≤5 children, then $20/mo + $2/child), and support is the team that built it. <a href="/guides/how-to-switch-daycare-software-without-losing-data">Switching takes an afternoon</a>.</p>`,
  },
  {
    slug: 'how-to-export-your-data-from-lillio-himama',
    tag: 'Software help',
    title: 'How to Export Your Data From Lillio / HiMama (2026): Reports, Billing & Photos',
    desc: 'Getting your roster, daily reports, billing history and photos out of Lillio (formerly HiMama) — what exports exist, what to request from support, and the full checklist.',
    h1: 'How to export your data from Lillio (HiMama)',
    sub: 'Self-serve exports, what to request from support, and the checklist that protects your records.',
    faqs: [
      ['Can I export photos from Lillio/HiMama in bulk?', 'Families can save individual photos, but program-wide bulk export generally goes through a support request from the account owner. Ask while your subscription is active and allow a couple of weeks.'],
      ['What data should I keep after leaving Lillio?', 'Roster and contacts, attendance, billing and payment history (6 years for CRA), daily report/development documentation you want for portfolios, immunization and allergy notes, staff records, and photos/videos.'],
      ['Does Lillio delete my data after I cancel?', 'Expect your access to end with the subscription and retention to follow their policies. The safe assumption for any platform: export everything before the end date rather than relying on post-cancellation retrieval.'],
    ],
    body: `
<p>Lillio (the platform long known as HiMama) holds a lot of irreplaceable material for a typical program — years of daily documentation and photos. Whether you're switching or just building a backup, here's the clean path out. Do it <strong>before</strong> cancelling.</p>
<h2>Step 1 — Self-serve exports from the web dashboard</h2>
<ul>
<li><strong>Roster/enrolment</strong> — children, rooms, family contacts.</li>
<li><strong>Attendance</strong> — widest available date range, exported per room and per child.</li>
<li><strong>Billing & payments</strong> — invoices and transactions per family, summary and detail. Tax season and payment disputes both want the detail.</li>
<li><strong>Reports/documentation</strong> — export or print-to-PDF the development documentation you care about (portfolios, learning stories) — this is Lillio's strength and the thing programs most regret losing.</li>
</ul>
<h2>Step 2 — The support request</h2>
<p>From the owner/admin email, request: bulk export of <strong>all photos and videos</strong>, complete daily-report history, and anything not exposed in dashboard reports. Be specific ("all media for all classrooms, full history, delivered as a download link"). Allow two to three weeks before your intended cancellation date.</p>
<h2>Step 3 — Checklist</h2>
<ul>
<li>☐ Roster + family contacts</li>
<li>☐ Attendance history</li>
<li>☐ Billing/payment history (keep 6 years)</li>
<li>☐ Year-end receipts issued to families</li>
<li>☐ Daily reports / learning documentation (PDF)</li>
<li>☐ Photos & videos (bulk, via support)</li>
<li>☐ Medical/allergy/immunization notes</li>
<li>☐ Staff records</li>
</ul>
<h2>Step 4 — If this export is a switch</h2>
<p>Mitten imports your roster CSV directly, daily reports and photo feeds work from day one (AI-drafted notes included free), milestones build into memory books families keep, and parents join with a link — no app store, no password wall for grandparents. Free up to 5 children, then $20/mo + $2/child, published right on the site. The <a href="/guides/how-to-switch-daycare-software-without-losing-data">switching guide</a> covers the family-communication piece.</p>`,
  },
  {
    slug: 'lillio-himama-app-problems-and-fixes',
    tag: 'Software help',
    title: 'Lillio / HiMama App Not Working? Fixes for Reports, Photos & Login (2026)',
    desc: 'Practical fixes when Lillio (HiMama) misbehaves: daily reports not sending, parents missing photos or notifications, login problems, and sync issues — plus when to rethink the platform.',
    h1: 'Lillio (HiMama) not working? The practical fix list',
    sub: 'Daily reports stuck, photos missing, parents locked out — the fixes in order of likelihood.',
    faqs: [
      ['Why didn’t my Lillio daily report send to parents?', 'Most often the entries were logged on a device that hadn’t synced (offline edits queue silently), the child wasn’t checked into the room the activity was logged against, or the report was saved as draft rather than sent/published. Sync the room device, verify check-in status, then re-send.'],
      ['Why can’t a parent see photos in HiMama/Lillio?', 'Check the parent is attached to the child’s profile, that the photo was actually published (not draft), and the parent’s app is updated and logged in. If one guardian sees content and another doesn’t, it’s nearly always profile attachment.'],
      ['Lillio login not working — what first?', 'Password reset on the exact email the invitation went to, then app update, then sign-out/sign-in. Duplicate accounts from double invitations need a support merge.'],
    ],
    body: `
<p>Lillio's documentation depth is its strength — which means more steps where things can quietly fail. These fixes cover the bulk of educator complaints.</p>
<h2>Daily reports not sending</h2>
<ol>
<li><strong>Sync first:</strong> entries made offline queue on the device — sync the classroom tablet before staff leave. Make it part of the closing routine.</li>
<li><strong>Check-in mismatch:</strong> activities logged against a room the child wasn't checked into can vanish from the family view. Verify attendance status matches reality.</li>
<li><strong>Draft vs sent:</strong> confirm the report was actually published/sent, not saved as draft.</li>
</ol>
<h2>Parents missing photos or notifications</h2>
<ol>
<li>Profile attachment — is <em>this</em> guardian linked to the child?</li>
<li>Published vs draft media.</li>
<li>Device-level notification settings, focus modes, battery savers; then sign out/in and update the app.</li>
</ol>
<h2>Login and account tangles</h2>
<p>Reset the password on the exact invited email. Parents with children at two Lillio programs, or staff who are also parents, sometimes end up with conflicting accounts — that's a support merge; ask for consolidation to one login.</p>
<h2>Sync & speed on classroom devices</h2>
<p>Old shared tablets + big media uploads = the afternoon hang. Clear app cache periodically, keep the app updated, upload on Wi-Fi, and stagger photo posting rather than batch-dumping at 4:55pm.</p>
<h2>If the problems are chronic</h2>
<p>A platform you fight daily costs more than its subscription â in educator time and parent trust. If renewal pricing, tiered features, or documentation overhead are the real issue (not bugs), look at fit instead: Mitten keeps the daily-report ritual but drafts the writing with AI (included free), parents join by link with no login wall, and pricing is published â free up to 5 children, $20/mo + $2/child after. <a href="/guides/how-to-switch-daycare-software-without-losing-data">Here’s the switching playbook</a>, including how to bring your exported documentation with you.</p>`,
  },
  {
    slug: 'how-to-switch-daycare-software-without-losing-data',
    tag: 'Software help',
    title: 'How to Switch Daycare Software Without Losing Data (2026 Migration Playbook)',
    desc: 'The complete playbook for switching childcare platforms: export checklists for Brightwheel/Lillio/Procare, the parent-communication template, overlap week, and day-one setup.',
    h1: 'Switching daycare software: the no-data-loss playbook',
    sub: 'Export everything, move in an afternoon, and make the change a non-event for families.',
    faqs: [
      ['How long does switching childcare software take?', 'For an owner-operated program: data export over a week or two (photo exports from support are the slow part), then actual setup on the new platform in an afternoon — roster import, rooms, billing plans, parent invitations. The overlap/transition week is for comfort, not necessity.'],
      ['When is the best time to switch daycare software?', 'The start of a month (clean billing cutover) and outside September. Many programs pick a mid-winter or early-summer month. Don’t switch mid-billing-cycle unless you enjoy reconciliation.'],
      ['Will parents be annoyed by a software change?', 'Only if it surprises them or adds work. A two-line heads-up, one link to click, and an overlap week where both apps run makes it a non-event — and if the new platform needs no app-store download, adoption is same-day.'],
    ],
    body: `
<p>Programs stay on software they dislike for years because switching feels risky — photos, billing history, parent goodwill. Sequenced properly, the whole thing is two calm weeks and one busy afternoon. Here's the playbook.</p>
<h2>Week 1–2: Export everything (while access still works)</h2>
<p>Use the platform-specific guides — <a href="/guides/how-to-export-your-data-from-brightwheel">Brightwheel</a>, <a href="/guides/how-to-export-your-data-from-lillio-himama">Lillio/HiMama</a> — or the universal checklist: roster + contacts, attendance history, <strong>billing detail per family</strong> (CRA: 6 years), year-end receipts, photos/videos (support request — this is the long pole), medical/allergy notes, signed forms, staff records and hours. Verify the files open and cover the full date range before you trust them.</p>
<h2>Pick the cutover date</h2>
<p>First of a month, never mid-billing-cycle, ideally a calm season. Tell staff first, then families (template below), then cancel the old platform <em>after</em> the new one is live and verified — a few days of overlap is cheap insurance.</p>
<h2>The parent message (steal this)</h2>
<p><em>"Hi families! On [date] we're moving our daily updates, photos and invoices to a new app called Mitten. One thing to do: tap this link and you're in — no app store, no new passwords to manage. Your [Month] invoice will come from the new system. Everything else stays the same. Questions? Grab me at pickup."</em></p>
<h2>Setup afternoon (the actual switch)</h2>
<ol>
<li>Import the roster CSV; create rooms and assign children.</li>
<li>Configure billing plans/tuition per family; set the first invoice date to the cutover.</li>
<li>Invite staff; post one practice update per room.</li>
<li>Send the parent link; watch joins roll in same-day when there's no download barrier.</li>
<li>Overlap week: run both, then export a final delta (any last photos/records) and <a href="/guides/how-to-cancel-brightwheel">cancel the old platform in writing</a>.</li>
</ol>
<h2>What "no data loss" means six months later</h2>
<p>It's not just the migration — it's whether the <em>next</em> export is also easy. Whatever you choose, prefer platforms with published pricing and easy data export; lock-in is a product strategy, not an accident. Mitten's position: your data is yours, exports are self-serve, pricing is public (free up to 5 children; $20/mo + $2/child), parents join by link, and we'll import your roster for you. Switching to us takes an afternoon — and so would leaving, which is exactly why we have to stay good.</p>`,
  },
  {
    slug: 'how-to-start-a-daycare-in-alberta',
    tag: 'Starting up',
    title: 'How to Start a Daycare in Alberta (2026): Licensing, Day Homes & Costs',
    desc: 'Opening child care in Alberta: facility-based licence vs family day home, the licensing steps under the Early Learning and Child Care Act, space and ratio rules, and realistic costs.',
    h1: 'How to start a daycare in Alberta',
    sub: 'Facility licence or day home, the licensing path, and the numbers that decide viability.',
    faqs: [
      ['Do I need a licence to run a dayhome in Alberta?', 'You can operate a private dayhome caring for up to six children (not counting your own) without a licence — or join a licensed family day home agency, which brings oversight, support, and access to affordability funding for your families.'],
      ['How many children require a daycare licence in Alberta?', 'A licence is required for facility-based programs caring for seven or more children. Private dayhomes max out at six unrelated children.'],
      ['How much indoor space does an Alberta daycare need?', 'Licensed facility-based programs need at least 3 m² of net primary play space per child (measured excluding hallways, washrooms, storage and similar).'],
    ],
    body: `
<p>Alberta runs child care under the <strong>Early Learning and Child Care Act</strong> and its regulation, with licensing through Alberta Children and Family Services. There are two genuinely different paths — pick first, then execute. <em>(Binding sources: the <a href="https://www.alberta.ca/licensed-facility-based-programs" rel="nofollow">Alberta licensing pages</a> and licensing handbook.)</em></p>
<h2>Path A — Family day home</h2>
<p><strong>Private dayhome:</strong> up to <strong>six</strong> children (excluding your own), no licence required. Full autonomy; no affordability-program access; you carry everything (insurance, contracts, compliance) yourself.<br/>
<strong>Agency day home:</strong> contract with a licensed family day home agency — they screen, train, visit and support you, and your families can access affordability funding, which materially improves what you can charge net. Most providers who plan to do this for years end up on the agency path.</p>
<h2>Path B — Facility-based licence (7+ children)</h2>
<ol>
<li><strong>Attend the orientation/information session</strong> for first-time applicants (offered by Children and Family Services) — it walks the requirements and saves months of guessing.</li>
<li><strong>Secure a compliant space:</strong> municipal zoning + development permit, fire inspection, AHS health approval, and at least <strong>3 m² of net play space per child</strong> (hallways/washrooms/storage excluded), plus outdoor play requirements.</li>
<li><strong>Apply for the licence:</strong> program plan, policies, staffing plan, insurance, floor plans. A licensing officer reviews and inspects.</li>
<li><strong>Staff to ratio and certification:</strong> educators must hold Alberta ECE certification (Levels 1–3); see the <a href="/guides/alberta-daycare-ratios-and-group-sizes">Alberta ratio table</a> for the staffing math by age.</li>
<li><strong>Decide on affordability funding:</strong> Alberta’s grants and subsidy bring parent fees down dramatically at participating programs â like CWELCC everywhere, it trades reporting obligations for filled spots. Our <a href="/guides/cwelcc-for-daycare-operators">operator guide</a> covers the record-keeping spine that makes reporting painless.</li>
</ol>
<h2>The viability math</h2>
<p>Alberta's combination — lower commercial rents than Toronto/Vancouver, affordability funding, and 1:8/1:10 ratios for 3+ — makes preschool-age rooms the economic engine; infant rooms (1:3 under 12 months) are a service you cross-subsidize. Model the staffing step function before signing a lease: the <a href="/guides/daycare-profit-margin-guide">margin guide</a> and <a href="/tools/daycare-profitability-calculator">profitability calculator</a> do the arithmetic.</p>
<h2>Open with systems, not paper</h2>
<p>Licensing inspections, affordability reporting and parent trust all run on the same fuel: clean daily records. Attendance, enrolment, daily reports, invoicing and staff hours from day one — Mitten does exactly this, free until your sixth child, which conveniently is the moment you become a licensed facility.</p>`,
  },
  {
    slug: 'alberta-daycare-ratios-and-group-sizes',
    tag: 'Rules & ratios',
    title: 'Alberta Daycare Ratios & Group Sizes (2026): The Full Table Explained',
    desc: 'Alberta staff-to-child ratios and maximum group sizes for licensed facility-based child care — infants 1:3/1:4, 19 months+ 1:6, preschool 1:8, kindergarten-age 1:10 — plus nap-time and mixed-age rules.',
    h1: 'Alberta daycare ratios & group sizes',
    sub: 'The facility-based table, nap-time halving, mixed-age rules and what they mean for staffing budgets.',
    faqs: [
      ['What is the infant ratio in Alberta daycares?', 'Under 12 months: 1 staff per 3 infants, maximum group of 6. From 12 to under 19 months: 1:4 with a maximum group of 8.'],
      ['Can Alberta ratios be reduced at nap time?', 'Yes — primary staff ratios may be halved while children are sleeping, provided supervision requirements are still met. Plan your lunch-break schedule around it, and document it.'],
      ['How many four-year-olds can one educator supervise in Alberta?', 'Children four years to kindergarten age run at 1:10 with a maximum group size of 20; three-year-olds run 1:8 (group 16); school-age children 1:15 (group 30).'],
    ],
    body: `
<p>Alberta's facility-based ratios (Early Learning and Child Care Regulation) are the staffing spine of every licence. Here's the table and the rules around it. <em>(Confirm specifics with your licensing officer — and note day homes follow different limits.)</em></p>
<h2>The facility-based table</h2>
<ul>
<li><strong>Under 12 months</strong> — <strong>1 : 3</strong>, max group <strong>6</strong></li>
<li><strong>12 to under 19 months</strong> — <strong>1 : 4</strong>, max group <strong>8</strong></li>
<li><strong>19 months to under 3 years</strong> — <strong>1 : 6</strong>, max group <strong>12</strong></li>
<li><strong>3 to under 4 years</strong> — <strong>1 : 8</strong>, max group <strong>16</strong></li>
<li><strong>4 years to kindergarten age</strong> — <strong>1 : 10</strong>, max group <strong>20</strong></li>
<li><strong>School age (grade 1+)</strong> — <strong>1 : 15</strong>, max group <strong>30</strong></li>
</ul>
<h2>The flexibility rules</h2>
<ul>
<li><strong>Nap-time halving:</strong> primary staff ratios may drop to half while children sleep (supervision must still be adequate) — this is your staff-lunch window; schedule and record it deliberately.</li>
<li><strong>Mixed-age groups:</strong> programs may mix children over 19 months through the day, with the group following the rules tied to its composition. Infants are the exception â if you’re licensed for 3+ infants, mixing under-12-month children with older groups during core hours needs specific approval.</li>
<li><strong>Day homes:</strong> capacity rules differ entirely (six unrelated children, with sub-limits by age) — see the <a href="/guides/how-to-start-a-daycare-in-alberta">Alberta startup guide</a>.</li>
</ul>
<h2>The budget translation</h2>
<p>The jump from 1:6 (under 3) to 1:8 (age 3) to 1:10 (age 4+) is where Alberta programs make their economics work — and why infant spots are scarce and expensive everywhere. When projecting a new room, model the step function: child #13 in a 19-month room doesn't cost one-twelfth more staffing, it costs a whole new group. The <a href="/tools/daycare-profitability-calculator">profitability calculator</a> runs the scenario; Mitten's live dashboard then tracks each room against ratio in real time, including the nap window.</p>`,
  },
  {
    slug: 'daycare-tax-receipts-cra-guide',
    tag: 'Money & taxes',
    title: 'Daycare Tax Receipts in Canada (2026): What CRA Requires (SIN, Format, Timing)',
    desc: 'Exactly what a Canadian child care receipt must include — when a SIN is required, what corporations include instead, when to issue receipts, and a copy-paste compliant template.',
    h1: 'Daycare tax receipts: exactly what CRA expects',
    sub: 'What goes on the receipt, when the SIN is required, timing, and a compliant template you can copy.',
    faqs: [
      ['Does a daycare receipt need a SIN in Canada?', 'If the care was provided by an individual (home daycare, nanny, babysitter), yes â the receipt must show that individual’s Social Insurance Number. Licensed centres operating as corporations issue receipts under the business name/address instead (a business number is good practice).'],
      ['When should daycares issue tax receipts?', 'Best practice is annual receipts by the end of February for the prior year (matching the tax-slip rhythm parents expect), plus receipts on request. Many programs simply issue a receipt with every payment — also fine.'],
      ['What must a child care receipt include?', 'Provider name and address (and SIN if an individual), the parent/payer name, the child’s name, the period of care, the amount actually paid, the date issued, and a signature for handwritten receipts. Reduced CWELCC fees are receipted at the amount the parent actually paid.'],
      ['Do parents need to submit receipts with their tax return?', 'No â receipts aren’t filed with the return, but CRA routinely asks for them afterward. Parents must keep them six years; providers should keep copies just as long.'],
    ],
    body: `
<p>Every February, daycare inboxes fill with the same request: "Can I get a receipt for taxes?" Here's exactly what that receipt needs, straight from the CRA's requirements for the <a href="/guides/child-care-expenses-deduction-canada">child care expenses deduction</a> — plus a template. <em>(Educational, not tax advice.)</em></p>
<h2>What must be on the receipt</h2>
<ul>
<li><strong>Provider identity:</strong> your name and address. <strong>Individuals (home providers, nannies): your SIN is mandatory</strong> — parents literally cannot complete Form T778 without it. Incorporated centres use the corporate name/address (adding your business number is good practice).</li>
<li><strong>Who paid:</strong> the parent/guardian name.</li>
<li><strong>Who the care was for:</strong> the child’s name.</li>
<li><strong>Period and amount:</strong> the dates of care and the amount <em>actually paid</em> in the calendar year (not billed — paid).</li>
<li><strong>Date issued</strong>, and a signature if handwritten.</li>
</ul>
<h2>The template (copy, fill, done)</h2>
<p><em>"Official receipt for income tax purposes — [Year]. Received from [Parent name] the sum of $[amount] for child care services provided to [Child name] from [start date] to [end date]. Provider: [Your name / business name], [address]. SIN/BN: [number]. Issued [date]. Signature: ______"</em></p>
<h2>The questions that trip providers up</h2>
<p><strong>"I don't want to give out my SIN."</strong> Understood — but for individual providers it's required for the parent's claim. Issue receipts securely (sealed, or via a portal) rather than refusing; refusing puts your families in an impossible spot and invites CRA attention from their side.</p>
<p><strong>Cash payments:</strong> receipt them identically. Unreceipted cash isn't a discount, it's unreported income — and the parent will often claim the expense anyway, naming you.</p>
<p><strong>CWELCC-reduced fees:</strong> receipt what the parent actually paid (the reduced amount). The government portion isn't the parent's expense.</p>
<p><strong>Multiple children / split custody:</strong> issue per-child amounts (one receipt itemizing per child is fine), and where parents pay separately, receipt each payer for what they actually paid — in shared custody both parents may have claims for their own paid amounts.</p>
<h2>Keep copies — six years</h2>
<p>Receipts substantiate your reported income just as they substantiate the parent's deduction; keep copies (digital is fine) for six years. If issuing receipts each February means an evening of spreadsheet archaeology, that's fixable: Mitten generates CRA-style annual receipts per family automatically from the year's actual payments — one click, every family, with your details pre-filled.</p>`,
  },
  {
    slug: 'child-care-expenses-deduction-canada',
    tag: 'Money & taxes',
    title: 'Child Care Expenses Deduction Canada (2026): Line 21400 & Form T778 Explained',
    desc: 'How the Canadian child care expenses deduction works: who must claim it, the $8,000/$5,000 limits, eligible expenses (daycare, home care, camps), Form T778, and the receipts you need.',
    h1: 'The child care expenses deduction, explained',
    sub: 'Line 21400 and Form T778 in plain English: who claims, the limits, what counts, and the receipts CRA expects.',
    faqs: [
      ['How much child care can I deduct in Canada?', 'Up to $8,000 per year for each child under 7, $5,000 for each child aged 7â16, and $11,000 for a child eligible for the disability tax credit â capped overall at two-thirds of the claiming parent’s earned income. Weekly limits apply to overnight camps and boarding schools.'],
      ['Which parent claims child care expenses?', 'Generally the parent with the lower net income must claim. Exceptions let the higher-income parent claim for periods the lower-income parent was in school, hospitalized, imprisoned, or incapable of caring for the child — documented on Form T778.'],
      ['Is daycare tax deductible if I pay a family member?', 'Payments to a relative can qualify only if the caregiver is 18 or older and not the child’s parent (or your spouse), and you have a receipt with their SIN. Payments to the child’s parent or to your under-18 relative never qualify.'],
      ['Are CWELCC reduced fees still deductible?', 'Yes — you deduct what you actually paid. The reduced fee is your expense; keep the receipts your provider issues.'],
    ],
    body: `
<p>The child care expenses deduction (Line 21400, calculated on <strong>Form T778</strong>) is the main way Canadian parents get tax relief on daycare — and it's a <em>deduction</em>, not a credit, so it reduces taxable income directly. Here's how it actually works. <em>(Educational, not tax advice.)</em></p>
<h2>The limits</h2>
<ul>
<li><strong>$8,000</strong>/year per child under 7 (at December 31)</li>
<li><strong>$5,000</strong>/year per child 7–16</li>
<li><strong>$11,000</strong>/year per child eligible for the disability tax credit</li>
<li>Overall cap: <strong>two-thirds of the claiming parent's earned income</strong></li>
<li>Weekly per-child limits apply to overnight camps/boarding schools ($200/$125/$275)</li>
</ul>
<h2>Who must claim (the rule everyone gets backwards)</h2>
<p>The <strong>lower-net-income</strong> spouse/partner claims — not whoever benefits more. The exceptions (claimable by the higher earner, computed weekly on T778): the lower earner was enrolled in school, hospitalized or confined for 2+ weeks, imprisoned, certified incapable of caring for children, or you were living separately due to relationship breakdown for the required period.</p>
<h2>What counts</h2>
<ul>
<li>Licensed daycare and home daycare fees (including <a href="/guides/cwelcc-10-dollar-a-day-child-care-explained">CWELCC-reduced</a> fees — claim what you paid)</li>
<li>Nannies, babysitters and individual caregivers (receipt must show their SIN)</li>
<li>Before/after-school programs, day camps and day sports schools (where the primary purpose is care)</li>
<li>Overnight camps and boarding schools — within the weekly limits</li>
</ul>
<p><strong>What doesn't:</strong> regular school tuition, most lesson/activity fees where care isn't the purpose, medical expenses, payments to the child's parent or your under-18 relative, and unreceipted cash.</p>
<h2>The mechanics</h2>
<ol>
<li>Collect receipts — individual caregivers' receipts must include their SIN (<a href="/guides/daycare-tax-receipts-cra-guide">what a compliant receipt looks like</a>).</li>
<li>Complete Form T778 with your software or accountant; the result lands on Line 21400.</li>
<li>Don't file the receipts — but keep them six years; child care is a routine CRA review category.</li>
</ol>
<h2>Note for providers reading this</h2>
<p>Your families need annual receipts (by late February, ideally) with the right fields on them. If that's a painful evening every winter, Mitten generates compliant annual receipts per family in one click from actual recorded payments — and your parents stop emailing you in March.</p>`,
  },
  {
    slug: 'does-brightwheel-work-in-canada',
    tag: 'Software guide',
    title: 'Does Brightwheel Work in Canada? (2026) — The Honest Answer for Canadian Programs',
    desc: 'Brightwheel works in Canada — but CWELCC reporting, CRA receipts, provincial ratios and CAD billing are where Canadian programs feel the gaps. What works, what does not, and the Canadian-built alternative.',
    h1: 'Does Brightwheel work in Canada?',
    sub: 'Short answer: yes, it functions. The longer answer is about CWELCC, CRA receipts and provincial rules — the parts a US platform was not built for.',
    faqs: [
      ['Can Canadian daycares use Brightwheel?', 'Yes — Brightwheel operates in Canada and Canadian programs use it for check-in, daily reports and messaging. The friction shows up in the Canada-specific layers: CWELCC fee caps and reporting, CRA-compliant receipts, provincial ratio configurations, and payments/payouts in CAD.'],
      ['Does Brightwheel handle CWELCC?', 'CWELCC is a Canadian funding program with provincial reporting requirements; US platforms don’t build first-class support for it. Programs typically track CWELCC obligations in spreadsheets alongside the app â which is exactly the double-entry that software was supposed to remove.'],
      ['What is a Canadian alternative to Brightwheel?', 'Mitten is Canadian-built for owner-operated programs: CAD billing with card and e-Transfer, CRA-style annual receipts, provincial ratio dashboards, published pricing (free up to 5 children, then $20/mo + $2/child) and no sales call.'],
    ],
    body: `
<p>Canadian directors ask this constantly, and the honest answer has two halves: <strong>yes, the app works in Canada</strong> — and <strong>no, it wasn't built for running a Canadian program</strong>. Whether that matters depends on which half of the job you're hiring software for.</p>
<h2>What works fine</h2>
<p>The universal layer: check-in/out, daily reports and photos, parent messaging, staff management. None of it cares which country you're in, and Brightwheel does it competently in Canada just as in Ohio.</p>
<h2>Where Canadian programs feel the gaps</h2>
<ul>
<li><strong>CWELCC / affordability programs.</strong> Fee caps, enrolment reporting, cost-based funding documentation — the administrative reality of Canadian child care since 2022 — are not first-class features in a US platform. The workaround is always the same: a parallel spreadsheet.</li>
<li><strong>CRA receipts.</strong> Canadian parents need Line 21400-compliant receipts (and individual providers must show a SIN). US platforms generate US-style year-end statements; close, but the February email asking for "a proper receipt" keeps coming.</li>
<li><strong>Provincial ratios.</strong> Schedule 1 in Ontario, Alberta's age bands, BC's certification tiers — US defaults are state-shaped, so ratio dashboards need manual configuration if they fit at all.</li>
<li><strong>US-centric content and features.</strong> CACFP food-program tooling, state licensing templates and US tax content are dead weight in a Canadian program's interface (our <a href="/guides/daycare-taxes-canada">Canadian tax guide</a> exists because the in-app guidance won't).</li>
<li><strong>Pricing and payments.</strong> Quote-based USD-anchored pricing, and tuition processing where the platform takes its own cut — on top of FX considerations for Canadian banking.</li>
</ul>
<h2>The decision framework</h2>
<p>If you're a large multi-site group that mostly needs the universal layer and has admin staff for the Canadian paperwork — Brightwheel works, and our <a href="/guides/brightwheel-pricing-and-setup-guide">pricing guide</a> covers what it costs. If you're an owner-operated program where <em>you</em> are the admin staff, the Canadian layer is precisely the work you need software to absorb: that's Mitten — CAD billing with card + Interac e-Transfer rails, one-click CRA-style annual receipts, provincial ratio dashboards, CWELCC-friendly attendance and fee records, free up to 5 children and $20/mo + $2/child after, no sales call. <a href="/guides/how-to-switch-daycare-software-without-losing-data">Switching takes an afternoon</a>.</p>`,
  },
  {
    slug: 'average-cost-of-daycare-ontario',
    tag: 'Costs & data',
    title: 'Average Cost of Daycare in Ontario (2026): CWELCC vs Full Fees, By Age',
    desc: 'What daycare actually costs in Ontario in 2026: about $19/day average at CWELCC programs for under-6s, full market rates for unlicensed and school-age care, by age group and city.',
    h1: 'What daycare costs in Ontario (2026)',
    sub: 'CWELCC fees vs market fees, by age — and why the waitlist, not the price, is now the constraint.',
    faqs: [
      ['How much is daycare per month in Ontario in 2026?', 'At a CWELCC-enrolled licensed program, fees for children under six average about $19/day — roughly $400/month full-time, varying by program. Outside CWELCC (unlicensed home care, school-age programs), market rates apply: commonly $45–$80+/day depending on age, city and care type.'],
      ['Is daycare cheaper than a nanny in Ontario?', 'Almost always for one child: CWELCC daycare around $400/month vs a full-time nanny at $3,500–$5,000+/month including payroll costs. With three+ young children, or nonstandard hours, the comparison narrows.'],
      ['Why is infant daycare so much more expensive?', 'Ratios. Ontario infant rooms run 3 staff per 10 children versus 1:8 for preschool — more than double the staffing per child, which is why infant spots are both the priciest and the scarcest.'],
    ],
    body: `
<p>Ontario child care pricing has split into two worlds: CWELCC programs (capped, roughly half their 2019 prices) and everything else (market rates). Here's the realistic picture, updated as the program evolves. <em>Last reviewed June 2026.</em></p>
<h2>World 1: CWELCC-enrolled licensed care (under 6)</h2>
<p>Average across enrolled programs: <strong>about $19/day — roughly $350–$450/month full-time</strong> depending on the program's capped fee. Infant, toddler and preschool fees converge under the caps far more than they used to. This is the price <em>if you can get a spot</em> — which is the real constraint: Ontario has added ~41,000 net new spaces toward an 86,000 target, and urban infant rooms still run multi-year waitlists. Strategy: <a href="/guides/10-dollar-a-day-child-care-ontario">how the Ontario program works</a>, and get on lists early — pregnancy is not too early for infant care.</p>
<h2>World 2: market-rate care</h2>
<ul>
<li><strong>Unlicensed home daycare:</strong> commonly <strong>$45–$65/day</strong> ($950–$1,400/month) by region — often the realistic option when licensed waitlists don't move. Know <a href="/guides/how-to-start-a-home-daycare-in-ontario">the five-child rules</a> and verify receipts.</li>
<li><strong>Non-enrolled licensed programs:</strong> a minority, at pre-CWELCC-style fees — frequently $70–$110+/day for younger children in big cities.</li>
<li><strong>School-age before/after care:</strong> outside CWELCC; commonly <strong>$15–$30/day</strong> for before+after combined, varying widely by board and provider.</li>
<li><strong>Nannies:</strong> $20–$30+/hour plus employer payroll obligations — $3,500–$5,000+/month full-time.</li>
</ul>
<h2>What softens the bill</h2>
<ul>
<li><strong>Municipal fee subsidy</strong> — income-tested, stacks on CWELCC fees; apply through your city.</li>
<li><strong>The tax deduction</strong> — up to $8,000/child under 7 off the lower earner's taxable income; receipts required. Full mechanics: <a href="/guides/child-care-expenses-deduction-canada">Line 21400 guide</a>.</li>
<li><strong>Canada Child Benefit</strong> — separate, automatic with your tax return, helps fund whichever care you choose.</li>
</ul>
<h2>For providers benchmarking against this page</h2>
<p>If you're pricing a program, the question isn't the average — it's your costs under your ratios. The <a href="/guides/daycare-tuition-pricing-guide">tuition pricing guide</a> and <a href="/tools/daycare-profitability-calculator">profitability calculator</a> do the work, and Mitten's analytics keep margins visible per room once you're running.</p>`,
  },
  {
    slug: 'himama-is-now-lillio',
    tag: 'Software help',
    title: 'HiMama Is Now Lillio (2026): What Changed + Best Alternatives',
    desc: 'HiMama rebranded to Lillio in November 2023 — same Toronto company, same app and login. What changed, what Lillio costs now, and the best free and Canadian alternatives for daycares.',
    h1: 'HiMama is now Lillio: what changed',
    sub: 'Same company, new name — the rebrand explained, what it costs now, and the alternatives worth comparing.',
    faqs: [
      ['Why did HiMama change its name to Lillio?', 'HiMama announced it was becoming Lillio in November 2023, after a year-long rebrand. The Toronto-based company said the name "HiMama" had come to feel narrow as the product grew beyond parent messaging into full centre management, curriculum, and educator training. The app, your account, and your login stayed the same — only the name changed.'],
      ['Is Lillio the same app as HiMama?', 'Yes. Lillio is HiMama, renamed — same company, same team, same product. If you had a HiMama account it is now your Lillio account, with the same login and your data and history intact.'],
      ['Does Lillio (formerly HiMama) have a free plan?', 'Lillio offers a free trial without a credit card, but it does not publish an ongoing free plan and does not list its pricing online — you request a demo for a quote based on your child and user counts. If a genuinely free starting tier matters, Mitten is free for your first 5 children.'],
      ['What is the best Canadian alternative to Lillio / HiMama?', 'For small and home-based programs, Mitten is built in Canada and free for your first 5 children, with attendance, invoicing, parent messaging, and CCFRI/CWELCC subsidy support included. Brightwheel and Storypark are larger alternatives, though both use quote-based pricing.'],
    ],
    body: `
<p class="note"><strong>Updated June 2026.</strong> <strong>HiMama is now Lillio.</strong> The Toronto-based childcare-app company announced the rebrand in <strong>November 2023</strong> — it is the same product and the same login, just a new name. If you are a current user, nothing broke: your account simply says Lillio now. If you are weighing the app, here is what changed, what it costs, and the alternatives worth a look (including a free-to-start Canadian one).</p>
<h2>What changed — and what didn't</h2>
<p>After a year-long rebrand, HiMama became <strong>Lillio</strong> in November 2023. The company said the "HiMama" name had come to feel narrow as the product grew from parent messaging into full centre management, curriculum, and educator training. Essentially the name and logo changed; the rest stayed put:</p>
<ul>
<li><strong>Same company and team</strong> — the Toronto-based business, not a sale or merger.</li>
<li><strong>Same app and login</strong> — existing HiMama accounts became Lillio accounts, with data and history intact.</li>
<li><strong>Same core product</strong> — daily reports, attendance, parent communication, and centre management.</li>
</ul>
<p>So "is HiMama gone?" — no. It is the same software under a new name. (Lillio's own <a href="https://www.lillio.com/resources/himama-is-now-lillio" rel="nofollow">name-change explainer</a> has the official version.)</p>
<h2>What Lillio costs now</h2>
<p>Lillio <strong>does not publish its pricing</strong> — you request a demo for a quote, and the cost scales with your child and user counts. There is a <strong>free trial</strong> (no credit card required) but <strong>no ongoing free plan</strong>. For smaller centres and home-based providers on tight margins, that per-child model is the usual sticking point. We keep a separate <a href="/guides/himama-lillio-pricing-and-setup-guide">Lillio / HiMama pricing breakdown</a> with the current detail.</p>
<h2>Free and Canadian alternatives</h2>
<p>If the rebrand has you reconsidering, these are worth comparing — especially if free-to-start or transparent pricing matters:</p>
<ul>
<li><strong>Mitten</strong> — built in Canada, <strong>free for your first 5 children</strong>, then simple flat pricing. Attendance, invoicing with e-Transfer, parent messaging, and Canadian subsidy (CCFRI / ACCB / CWELCC) and ratio support are included, with no per-feature paywalls. The fit if you want a genuinely free start and pricing you can see up front. <a href="/signup">Try Mitten free</a>.</li>
<li><strong>Brightwheel</strong> — a large, US-first platform with broad features and quote-based pricing. See our <a href="/guides/brightwheel-pricing-and-setup-guide">Brightwheel pricing breakdown</a>.</li>
<li><strong>Storypark, Procare and others</strong> — common comparisons; our <a href="/guides/best-brightwheel-alternatives">alternatives roundup</a> covers the wider field.</li>
</ul>
<p>The right pick depends on your size and whether free-to-start, Canadian subsidy handling, and transparent pricing matter. For the "free" question specifically, see <a href="/guides/free-daycare-management-software">free daycare management software in Canada</a>.</p>
<h2>Switching from Lillio / HiMama</h2>
<p>If you do move, export your records <strong>while your subscription is active</strong> — roster and contacts, attendance, billing and payment history (keep six years for the CRA), daily-report documentation, and photos. Our <a href="/guides/how-to-export-your-data-from-lillio-himama">Lillio / HiMama export guide</a> has the full checklist so nothing is left behind.</p>`,
  },
]

/* ───────────────────────── competitor guides ───────────────────────── */

const COMPETITORS = [
  {
    slug: 'brightwheel-pricing-and-setup-guide',
    name: 'Brightwheel',
    title: 'Brightwheel Pricing 2026: How Much Does Brightwheel Cost? (+ Setup & Alternatives)',
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
    title: 'Lillio (HiMama) Pricing 2026: How Much Does Lillio Cost? (+ Setup & Alternatives)',
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
<p>Full ratio tables and certification notes are in our <a href="/guides/bc-daycare-staff-ratios">BC staff ratios guide</a>. Outside BC? See the <a href="/guides/ontario-daycare-ratios-and-group-sizes">Ontario daycare &amp; preschool ratios</a> guide. To see what a staffing change does to your bottom line, run the <a href="/tools/daycare-profitability-calculator">profitability calculator</a> next.</p>
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

const TOOL_RATIO_ON = {
  slug: 'ontario-daycare-ratio-calculator',
  tag: 'Free tool',
  title: 'Ontario Daycare Ratio Calculator (CCEYA Staff-to-Child Ratios, 2026)',
  desc: 'Free Ontario daycare ratios calculator: pick your age group and enrolment to see the required educators under the CCEYA (O. Reg. 137/15), with maximum group sizes.',
  h1: 'Ontario daycare ratio calculator',
  sub: 'Pick your age group, enter enrolment — see the educators required and your maximum group size under Ontario’s CCEYA.',
  body: `
<div class="card">
<div style="display:grid;gap:0 1.2rem;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))">
<div><label class="f" for="type">Age group</label><select class="f" id="type">
<option value="infant">Infant — under 18 months</option>
<option value="toddler">Toddler — 18 to 30 months</option>
<option value="pre" selected>Preschool — 30 months to 6 years</option>
<option value="kinder">Kindergarten — 44 months to 7 years</option>
<option value="sa">School age — 6 to 12 years</option></select></div>
<div><label class="f" for="count">Children attending</label><input class="f" id="count" type="number" value="16" min="1" /></div>
</div>
<div class="result" id="rout"></div>
</div>
<p class="note" style="margin-top:1rem">Summary of Ontario’s <em>Child Care and Early Years Act</em> (CCEYA / O. Reg. 137/15) for guidance only — ratios may reduce to two-thirds of these numbers during the first and last 1.5 hours of the day and during rest periods (infant rooms always stay 1:3), and a <strong>minimum of 2 staff</strong> is required whenever 6 or more children are present. Staff qualification rules (RECE) also apply, and regulations change. Always confirm with your licensing program advisor.</p>
<h2>Behind the numbers</h2>
<p>Full ratio tables, group-size rules and the nap-time reduction are in our <a href="/guides/ontario-daycare-ratios-and-group-sizes">Ontario daycare ratios & group sizes guide</a>. Planning a new centre? See <a href="/guides/how-to-start-a-daycare-in-ontario">how to start a daycare in Ontario</a>, then run the <a href="/tools/daycare-profitability-calculator">profitability calculator</a> to see what a staffing change does to your bottom line.</p>
<script>
const RULES={infant:{name:'Infant (under 18 months)',ratio:3,max:10},toddler:{name:'Toddler (18–30 months)',ratio:5,max:15},pre:{name:'Preschool (30 months–6 years)',ratio:8,max:24},kinder:{name:'Kindergarten (44 months–7 years)',ratio:13,max:26},sa:{name:'School age (6–12 years)',ratio:15,max:30}};
const $=id=>document.getElementById(id);
function rc(){const r=RULES[$('type').value];const n=+$('count').value||0;const need=Math.max(n>=6?2:1,Math.ceil(n/r.ratio));const over=n>r.max;
$('rout').innerHTML='<div style="display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))">'
+'<div><div class="eyebrow">Educators required</div><div class="big">'+(over?'—':need)+'</div></div>'
+'<div><div class="eyebrow">Ratio</div><div class="big">1:'+r.ratio+'</div></div>'
+'<div><div class="eyebrow">Max group size</div><div class="big" style="color:'+(over?'#e8604c':'#2eb88a')+'">'+r.max+'</div></div></div>'
+(over?'<p style="color:#e8604c;font-weight:700;margin:.8rem 0 0">'+n+' children exceeds the maximum group size of '+r.max+' for '+r.name+' — this enrolment needs an additional licensed group/room.</p>'
:'<p style="margin:.8rem 0 0">For <strong>'+n+'</strong> children in <strong>'+r.name+'</strong> care you need at least <strong>'+need+' educators</strong> present'+(n>=6&&Math.ceil(n/r.ratio)<2?' (a minimum of 2 staff applies once 6+ children attend)':'')+'. RECE qualification requirements apply.</p>');}
$('type').addEventListener('change',rc);$('count').addEventListener('input',rc);rc();
</script>`,
  faqs: [
    ['What is the infant ratio in Ontario?', 'Under the CCEYA (O. Reg. 137/15), infant rooms (children under 18 months) run at 1 staff to 3 children, with a maximum group size of 10. The infant ratio is never reduced — it stays 1:3 even during arrival/departure windows and rest periods.'],
    ['What is the preschool ratio in Ontario?', 'Preschool (30 months to 6 years) runs at 1 staff to 8 children, with a maximum group size of 24. So 16 preschoolers need at least 2 qualified educators present, and you cannot exceed 24 children in a single preschool group.'],
    ['Can daycare ratios be reduced during nap time in Ontario?', 'Yes — except for infants, the CCEYA permits ratios to drop to two-thirds of the standard number during rest periods and during the first and last 1.5 hours of the operating day. Infant rooms always stay at 1:3, and a minimum of 2 staff is required whenever 6 or more children are present.'],
  ],
}

const TOOL_RATIO_AB = {
  slug: 'alberta-daycare-ratio-calculator',
  tag: 'Free tool',
  title: 'Alberta Daycare Ratio Calculator (Staff-to-Child Ratios + Group Sizes, 2026)',
  desc: 'Free Alberta daycare ratios calculator: pick your age group and enrolment to see the educators required under Alberta’s Early Learning and Child Care Regulation, with maximum group sizes.',
  h1: 'Alberta daycare ratio calculator',
  sub: 'Pick your age group, enter enrolment — see the educators required and your maximum group size under Alberta’s ratios.',
  body: `
<div class="card">
<div style="display:grid;gap:0 1.2rem;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))">
<div><label class="f" for="type">Age group</label><select class="f" id="type">
<option value="u12">Infants — under 12 months</option>
<option value="m12">12 to under 19 months</option>
<option value="m19">19 months to under 3 years</option>
<option value="y3" selected>3 to under 4 years</option>
<option value="y4">4 years to kindergarten age</option>
<option value="sa">School age (grade 1+)</option></select></div>
<div><label class="f" for="count">Children attending</label><input class="f" id="count" type="number" value="14" min="1" /></div>
</div>
<div class="result" id="rout"></div>
</div>
<p class="note" style="margin-top:1rem">Summary of Alberta’s <em>Early Learning and Child Care Regulation</em> for facility-based care, for guidance only — primary staff ratios may be <strong>halved while children are sleeping</strong> (supervision must still be met), licensed day homes follow different limits, and regulations change. Staff certification rules (Child Development Worker/Supervisor) also apply. Always confirm with your licensing officer.</p>
<h2>Behind the numbers</h2>
<p>The full ratio table, nap-time halving and mixed-age rules are in our <a href="/guides/alberta-daycare-ratios-and-group-sizes">Alberta daycare ratios &amp; group sizes guide</a>. Planning a new centre or day home? See <a href="/guides/how-to-start-a-daycare-in-alberta">how to start a daycare in Alberta</a>, then run the <a href="/tools/daycare-profitability-calculator">profitability calculator</a> to see what a staffing change does to your bottom line.</p>
<script>
const RULES={u12:{name:'Infants (under 12 months)',ratio:3,max:6},m12:{name:'12 to under 19 months',ratio:4,max:8},m19:{name:'19 months to under 3 years',ratio:6,max:12},y3:{name:'3 to under 4 years',ratio:8,max:16},y4:{name:'4 years to kindergarten age',ratio:10,max:20},sa:{name:'School age (grade 1+)',ratio:15,max:30}};
const $=id=>document.getElementById(id);
function rc(){const r=RULES[$('type').value];const n=+$('count').value||0;const need=Math.max(1,Math.ceil(n/r.ratio));const over=n>r.max;
$('rout').innerHTML='<div style="display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))">'
+'<div><div class="eyebrow">Educators required</div><div class="big">'+(over?'—':need)+'</div></div>'
+'<div><div class="eyebrow">Ratio</div><div class="big">1:'+r.ratio+'</div></div>'
+'<div><div class="eyebrow">Max group size</div><div class="big" style="color:'+(over?'#e8604c':'#2eb88a')+'">'+r.max+'</div></div></div>'
+(over?'<p style="color:#e8604c;font-weight:700;margin:.8rem 0 0">'+n+' children exceeds the maximum group size of '+r.max+' for '+r.name+' — this enrolment needs an additional licensed group/room.</p>'
:'<p style="margin:.8rem 0 0">For <strong>'+n+'</strong> children in the <strong>'+r.name+'</strong> group you need at least <strong>'+need+' educators</strong> present. Staff certification requirements also apply.</p>');}
$('type').addEventListener('change',rc);$('count').addEventListener('input',rc);rc();
</script>`,
  faqs: [
    ['What is the infant ratio in Alberta daycares?', 'Under 12 months: 1 staff per 3 infants, with a maximum group of 6. From 12 to under 19 months it is 1:4 with a maximum group of 8. Infant spaces are the most staff-intensive, which is why they are the scarcest and priciest.'],
    ['How many four-year-olds can one educator supervise in Alberta?', 'Children from 4 years to kindergarten age run at 1:10 with a maximum group size of 20. Three-year-olds run 1:8 (group of 16), and school-age children (grade 1+) run 1:15 (group of 30).'],
    ['Can Alberta daycare ratios be reduced at nap time?', 'Yes — primary staff ratios may be halved while children are sleeping, provided supervision requirements are still met. It is commonly used to schedule staff lunch breaks; plan and document it deliberately.'],
  ],
}

const TOOL_SUBSIDY = {
  slug: 'bc-child-care-subsidy-calculator',
  title: 'BC Child Care Subsidy Calculator (2026) — CCFRI, Affordable Child Care Benefit & $10/Day',
  desc: 'Free BC child care subsidy calculator: see your CCFRI fee reduction by age, check Affordable Child Care Benefit (ACCB) eligibility, and estimate what you’ll actually pay for daycare after subsidies. No signup.',
  h1: 'BC child care subsidy calculator',
  sub: 'Estimate your CCFRI fee reduction, the $10-a-day cap and Affordable Child Care Benefit eligibility — and what you’ll actually pay each month. Free, no signup.',
  body: `
<div class="card">
<div style="display:grid;gap:0 1.2rem;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))">
<div><label class="f" for="ctype">Care type</label><select class="f" id="ctype"><option value="group" selected>Group / centre care</option><option value="family">Family / in-home care</option></select></div>
<div><label class="f" for="age">Child's age category</label><select class="f" id="age"><option value="infant">Infant (0–18 months)</option><option value="toddler">Toddler (18–36 months)</option><option value="g3k" selected>3 years to Kindergarten</option><option value="kinder">Kindergarten</option><option value="grade">Grade 1 to age 12</option><option value="pre">Preschool (part-day)</option></select></div>
<div><label class="f" for="fee">Your current monthly fee ($)</label><input class="f" id="fee" type="number" value="1200" min="0" /></div>
<div><label class="f" for="inc">Household income ($/year)</label><input class="f" id="inc" type="number" value="90000" min="0" /></div>
</div>
<label style="display:flex;align-items:center;gap:.5rem;margin-top:.9rem;font-size:.92rem;font-weight:600;color:var(--slate)"><input type="checkbox" id="ten" /> My centre is a $10-a-day (CWELCC) site</label>
<div class="result" id="sout"></div>
</div>
<p class="note" style="margin-top:1rem">Estimates only, not an eligibility decision. CCFRI amounts assume your centre opted in (most licensed centres have). The Affordable Child Care Benefit is income-tested and depends on your full circumstances — confirm your amount and apply at <a href="https://gov.bc.ca/affordablechildcarebenefit" target="_blank" rel="noopener">gov.bc.ca/affordablechildcarebenefit</a>.</p>

<h2>How BC childcare subsidies stack</h2>
<p>BC has three layers of help, and they combine. <strong>CCFRI</strong> (the Child Care Fee Reduction Initiative) lowers your fee automatically at a participating centre — you don't apply, the savings just show up. <strong>The Affordable Child Care Benefit (ACCB)</strong> is income-tested (household income up to about $111,000), you apply and renew yearly, and it stacks <em>on top</em> of CCFRI — for lower incomes it can bring your fee close to $0. At <strong>$10-a-day (CWELCC)</strong> sites, your fee is capped at about $200/month ($10/day) for full-time care.</p>

<h3>CCFRI maximum monthly fee reductions (2025–26)</h3>
<table>
<thead><tr><th>Age category</th><th>Group / centre</th><th>Family / in-home</th></tr></thead>
<tbody>
<tr><td>Infant (0–18 months)</td><td>$900</td><td>$600</td></tr>
<tr><td>Toddler (18–36 months)</td><td>$900</td><td>$600</td></tr>
<tr><td>3 years to Kindergarten</td><td>$545</td><td>$500</td></tr>
<tr><td>Kindergarten</td><td>$320</td><td>$320</td></tr>
<tr><td>Grade 1 to age 12</td><td>$115</td><td>$145</td></tr>
<tr><td>Preschool (part-day)</td><td>$95</td><td>—</td></tr>
</tbody>
</table>
<p style="font-size:.9rem;color:var(--slate-5)">Full-time amounts; CCFRI won't reduce a fee below $200/month ($10/day), or $140/month for preschool. Source: BC Ministry of Education and Child Care, CCFRI Funding Guidelines 2025–26.</p>

<h2>How to apply (the steps)</h2>
<ol>
<li><strong>CCFRI — nothing to do.</strong> Ask your centre if they're a CCFRI participant (most are). If so, the reduction is already on your invoice.</li>
<li><strong>Affordable Child Care Benefit — apply online.</strong> Use <a href="https://gov.bc.ca/affordablechildcarebenefit" target="_blank" rel="noopener">My Family Services</a> (here's our <a href="/guides/how-to-apply-affordable-child-care-benefit-bc">step-by-step ACCB guide</a>). Have your SIN, your CRA Notice of Assessment, your child's birth certificate and your banking details ready.</li>
<li><strong>Complete the Child Care Arrangement form (CF2798) with your provider.</strong> It needs both your details and the provider's — and the provider's signature. Use our free <a href="/tools/cf2798-child-care-arrangement-form">CF2798 helper</a> to fill it in, then submit the official form with your application.</li>
<li><strong>Renew every year.</strong> The ACCB lapses annually — diarize it so your reduction doesn't stop.</li>
</ol>
<p>Looking for a centre with space? Browse our free <a href="/childcare">BC childcare boards</a> — many list whether they take CCFRI/subsidy. Running a daycare? <a href="/">Mitten</a> tracks each child's CCFRI/ACCB and nets it off invoices automatically, and generates the CF2798 for your families — free for your first 5 children.</p>
<script>
var CCFRI={group:{infant:900,toddler:900,g3k:545,kinder:320,grade:115,pre:95},family:{infant:600,toddler:600,g3k:500,kinder:320,grade:145,pre:0}};
var $=function(id){return document.getElementById(id);};var fmt=function(n){return '$'+Math.round(n).toLocaleString();};
function scalc(){
var ct=$('ctype').value,age=$('age').value,fee=+$('fee').value||0,inc=+$('inc').value||0,ten=$('ten').checked;
var red=(CCFRI[ct]||{})[age]||0;var floor=(age==='pre')?140:200;
var net,ccfri;
if(ten){net=Math.min(fee,200);ccfri=Math.max(0,fee-net);}
else{net=(fee<=floor)?fee:Math.max(fee-red,floor);ccfri=fee-net;}
var elig=inc>0&&inc<111000;var savings=Math.max(0,fee-net);
var noFamPre=(ct==='family'&&age==='pre');
$('sout').innerHTML='<div style="display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))">'
+'<div><div class="eyebrow">CCFRI fee reduction</div><div class="big" style="color:#2eb88a">'+(noFamPre?'n/a':fmt(ccfri)+'/mo')+'</div></div>'
+'<div><div class="eyebrow">'+(ten?'$10-a-day capped fee':'Fee after CCFRI')+'</div><div class="big">'+fmt(net)+'/mo</div></div>'
+'<div><div class="eyebrow">Monthly saving</div><div class="big" style="color:#0E74C1">'+fmt(savings)+'</div></div></div>'
+'<p style="margin:.9rem 0 0">'+(elig
?'<strong style="color:#2eb88a">You likely qualify for the Affordable Child Care Benefit</strong> — your household income is under the ~$111,000 ceiling. The ACCB is income-tested and stacks on top of the above, so your real fee could be <strong>lower than '+fmt(net)+'</strong> — for lower incomes, potentially close to $0. Estimate your exact amount and apply at <a href="https://gov.bc.ca/affordablechildcarebenefit" target="_blank" rel="noopener">gov.bc.ca/affordablechildcarebenefit</a>.'
:(inc>=111000?'Your household income is at or above the ~$111,000 ceiling, so you likely won\\'t receive the income-tested Affordable Child Care Benefit — but the CCFRI reduction above still applies automatically at a participating centre.':'Enter your household income to check Affordable Child Care Benefit eligibility.'))
+'</p>'+(noFamPre?'<p style="color:#a9791b;font-weight:600;margin:.6rem 0 0">Preschool isn\\'t a family-care category — pick Group / centre care for preschool.</p>':'');}
['ctype','age','fee','inc','ten'].forEach(function(id){var e=$(id);e.addEventListener('input',scalc);e.addEventListener('change',scalc);});scalc();
</script>`,
  faqs: [
    ['How much is the CCFRI fee reduction in BC?', 'For 2025–26, the maximum monthly reduction at participating centres is $900 for infants and toddlers (under 36 months), $545 for 3-years-to-Kindergarten, $320 for Kindergarten, $115 for Grade 1 to age 12, and $95 for preschool (group/centre rates; family/in-home rates differ). Fees are never reduced below $200/month ($10/day).'],
    ['What is the income limit for the Affordable Child Care Benefit?', 'Families with household income up to roughly $111,000 may qualify; the amount is income-tested and also depends on family size, the child’s age and the type of care. You apply and renew every year through My Family Services.'],
    ['Do I have to apply for CCFRI?', 'No — families don’t apply for CCFRI. The child care provider opts the facility in, and the savings are passed to you automatically each month as a reduced fee. The Affordable Child Care Benefit is the one you apply for yourself.'],
    ['What is the CF2798 / Child Care Arrangement form?', 'It’s the form that records your child care arrangement for an Affordable Child Care Benefit application — it needs both your details and your provider’s, plus the provider’s signature. Some daycares (those on Mitten) can give you a pre-filled head-start to save time.'],
  ],
}

const TOOL_CF2798 = {
  slug: 'cf2798-child-care-arrangement-form',
  title: 'CF2798 Child Care Arrangement Form — Free Pre-Fill Helper (BC ACCB)',
  desc: 'Free helper for the BC CF2798 Child Care Arrangement form, required for the Affordable Child Care Benefit. Fill it in and download a clean, ready-to-sign PDF head-start — no signup.',
  h1: 'CF2798 Child Care Arrangement form helper',
  sub: 'The form you submit with your Affordable Child Care Benefit application. Fill it in below and download a clean, ready-to-sign copy. Free, no signup.',
  body: `
<div class="card">
<div style="display:grid;gap:0 1.2rem;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))">
<div><label class="f" for="cn">Child's full name</label><input class="f" id="cn" /></div>
<div><label class="f" for="cdob">Child's date of birth</label><input class="f" id="cdob" type="date" /></div>
<div><label class="f" for="pn">Parent / guardian name</label><input class="f" id="pn" /></div>
<div><label class="f" for="fn">Provider / facility name</label><input class="f" id="fn" /></div>
<div><label class="f" for="fa">Provider address</label><input class="f" id="fa" /></div>
<div><label class="f" for="fp">Provider phone</label><input class="f" id="fp" /></div>
<div><label class="f" for="lic">Licence / facility number</label><input class="f" id="lic" placeholder="ask your provider" /></div>
<div><label class="f" for="ct">Type of care</label><select class="f" id="ct"><option>Licensed group child care</option><option>Licensed family child care</option><option>In-home multi-age child care</option><option>Registered license-not-required</option><option>License-not-required</option></select></div>
<div><label class="f" for="sd">Care start date</label><input class="f" id="sd" type="date" /></div>
<div><label class="f" for="dpw">Days per week</label><input class="f" id="dpw" type="number" min="1" max="7" placeholder="5" /></div>
<div><label class="f" for="hrs">Hours per day (from–to)</label><input class="f" id="hrs" placeholder="7:30am – 5:30pm" /></div>
<div><label class="f" for="fee">Monthly fee ($)</label><input class="f" id="fee" type="number" min="0" placeholder="1200" /></div>
</div>
<button class="btn btn-primary" id="gen" style="margin-top:1.1rem;border:0;cursor:pointer;font-size:1rem">📄 Generate my CF2798 head-start</button>
</div>
<p class="note" style="margin-top:1rem">This is a clean, organised head-start to save you time — <strong>not</strong> a replacement for the official form. Submit the official CF2798 with your application at <a href="https://gov.bc.ca/affordablechildcarebenefit" target="_blank" rel="noopener">gov.bc.ca/affordablechildcarebenefit</a>. Nothing you type is sent anywhere — it stays in your browser.</p>

<h2>What is the CF2798?</h2>
<p>The <strong>Child Care Arrangement form (CF2798)</strong> records the details of your child care arrangement, and you submit it with your <a href="/guides/how-to-apply-affordable-child-care-benefit-bc">Affordable Child Care Benefit application</a>. It's the one form that needs information from <em>both</em> you and your provider — and the provider's signature — which is why it's the part of the application families most often get stuck on.</p>
<h2>Who fills it out and signs it?</h2>
<ul>
<li><strong>You (the parent/guardian)</strong> provide your details and your child's, and sign.</li>
<li><strong>Your child care provider</strong> confirms the arrangement — care type, schedule and fee — and signs. (If your daycare runs on <a href="/">Mitten</a>, they can hand you a version with their half already filled in.)</li>
</ul>
<p>Not sure how much you'll actually pay after subsidies? Estimate your CCFRI reduction and ACCB eligibility with our <a href="/tools/bc-child-care-subsidy-calculator">BC child care subsidy calculator</a>.</p>
<script>
var $=function(id){return document.getElementById(id);};
var esc=function(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');};
var V=function(id){return ($(id)?$(id).value:'')||'';};
function L(val){return val?'<b style="color:#0f172a">'+esc(val)+'</b>':'<span style="display:inline-block;min-width:150px;border-bottom:1px solid #94a3b8">&nbsp;</span>';}
function row(a,av,b,bv){return '<div style="display:flex;gap:28px;margin:9px 0"><div style="flex:1"><div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8">'+a+'</div>'+L(av)+'</div>'+(b?'<div style="flex:1"><div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8">'+b+'</div>'+L(bv)+'</div>':'')+'</div>';}
$('gen').addEventListener('click',function(){
var fee=V('fee');var feeTxt=fee?('$'+Number(fee).toLocaleString('en-CA',{minimumFractionDigits:2})+' / month'):'';
var H='<!doctype html><html><head><meta charset="utf-8"><title>Child Care Arrangement — '+esc(V('cn')||'Child')+'</title></head>'
+'<body style="font:13.5px/1.55 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1e293b;padding:48px;max-width:780px;margin:0 auto">'
+'<div style="position:fixed;top:16px;right:16px"><button onclick="window.print()" style="background:#0E74C1;color:#fff;border:0;border-radius:10px;padding:10px 18px;font-weight:700;cursor:pointer">Print / Save as PDF</button></div>'
+'<div style="border-bottom:3px solid #0E74C1;padding-bottom:18px"><div style="font-family:Georgia,serif;font-size:21px;color:#0E74C1">Child Care Arrangement</div><div style="color:#64748b;font-size:12px;margin-top:3px">Head-start for the BC Affordable Child Care Benefit (CF2798)</div></div>'
+'<div style="margin:18px 0 6px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:12px 16px;font-size:12.5px;color:#334155">A head-start to save you time — complete and submit the official <b>CF2798</b> with your application at <b>gov.bc.ca/affordablechildcarebenefit</b>. This is not a replacement for the official form.</div>'
+'<h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#0E74C1;margin:24px 0 6px;border-bottom:1px solid #e2e8f0;padding-bottom:5px">Child</h3>'
+row("Child's full name",V('cn'),"Date of birth",V('cdob'))
+'<h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#0E74C1;margin:24px 0 6px;border-bottom:1px solid #e2e8f0;padding-bottom:5px">Parent / Guardian</h3>'
+row("Name",V('pn'),"Social Insurance Number","")
+row("Home address","","Phone","")
+'<h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#0E74C1;margin:24px 0 6px;border-bottom:1px solid #e2e8f0;padding-bottom:5px">Child care provider</h3>'
+row("Facility / provider name",V('fn'),"Licence / facility number",V('lic'))
+row("Address",V('fa'),"Phone",V('fp'))
+row("Type of care",V('ct'),"",null)
+'<h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#0E74C1;margin:24px 0 6px;border-bottom:1px solid #e2e8f0;padding-bottom:5px">The arrangement</h3>'
+row("Care start date",V('sd'),"Days per week",V('dpw'))
+row("Hours per day",V('hrs'),"Monthly fee",feeTxt)
+'<div style="display:flex;gap:40px;margin-top:34px"><div style="flex:1"><div style="border-bottom:1.5px solid #334155;height:42px"></div><div style="font-size:11px;color:#64748b;margin-top:5px">Parent / guardian signature &amp; date</div></div><div style="flex:1"><div style="border-bottom:1.5px solid #334155;height:42px"></div><div style="font-size:11px;color:#64748b;margin-top:5px">Provider signature &amp; date</div></div></div>'
+'<div style="margin-top:28px;border-top:1px solid #e2e8f0;padding-top:12px;color:#94a3b8;font-size:11px">Confirm all details against the official CF2798 before submitting. Official form &amp; application: gov.bc.ca/affordablechildcarebenefit · prepared with Mitten</div>'
+'</body></html>';
var w=window.open('','_blank','width=840,height=940');if(!w){alert('Please allow pop-ups to open your form.');return;}w.document.write(H);w.document.close();
});
</script>`,
  faqs: [
    ['What is the CF2798 form in BC?', 'The CF2798 is the Child Care Arrangement form you submit with an Affordable Child Care Benefit application. It records your child, your details, and your provider\'s details, and must be signed by both you and your child care provider.'],
    ['Who signs the CF2798?', 'Both the parent/guardian and the child care provider sign it — the provider confirms the care type, schedule and fee. That shared sign-off is why it\'s often the slowest part of an application.'],
    ['Is this the official CF2798 form?', 'No — this free helper produces a clean, pre-filled head-start to save you time. Always complete and submit the official CF2798 with your application through My Family Services at gov.bc.ca/affordablechildcarebenefit.'],
  ],
}

const TOOLS = [TOOL_SUBSIDY, TOOL_CF2798, TOOL_PROFIT, TOOL_AI, TOOL_RATIO, TOOL_RATIO_ON, TOOL_RATIO_AB]


/* ───────────────────────────── research ─────────────────────────────
   Evidence-based papers for parents, educators and directors. House rules:
   every claim links to a real, verifiable source (no secondary blog citations),
   each paper carries a reviewed date, a TL;DR, audience takeaways and a
   non-medical-advice line. Long pieces are "papers", short ones "briefs". */


const RESEARCH_CSS = `<style>
#rprog{position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,#0E74C1,#F2C6CC);width:0;z-index:99;transition:width .1s linear}
.r-meta{font-family:'Geist Mono',monospace;font-size:12px;letter-spacing:.08em;color:#7E7E7E;text-transform:uppercase}
.r-tldr{position:relative;background:linear-gradient(135deg,#FDF1F3,#E7F1F9);border-radius:18px;padding:30px 32px 26px;margin:18px 0 34px;overflow:hidden}
.r-tldr:before{content:"TL;DR";position:absolute;top:14px;right:18px;font-family:'Geist Mono',monospace;font-size:11px;letter-spacing:.16em;color:#0E74C1;background:#fff;border-radius:999px;padding:4px 12px}
.r-tldr p{margin:0;font-family:'Instrument Serif',serif;font-size:clamp(19px,2.2vw,23px);line-height:1.55;color:#143A56}
.r-body>p:first-of-type:first-letter{font-family:'Instrument Serif',serif;font-size:3.4em;float:left;line-height:.85;padding:4px 10px 0 0;color:#0E74C1}
.r-body h2{font-family:'Instrument Serif',serif;font-weight:400;font-size:clamp(26px,3vw,34px);margin-top:42px}
.r-body h2:after{content:"";display:block;width:44px;height:3px;border-radius:2px;background:linear-gradient(90deg,#0E74C1,#F2C6CC);margin-top:8px}
.r-aud{display:grid;gap:16px;margin:16px 0 8px}
@media(min-width:760px){.r-aud{grid-template-columns:1fr 1fr 1fr}}
.r-aud>div{background:#fff;border:1px solid #E9EDF2;border-top:4px solid var(--ac,#0E74C1);border-radius:14px;padding:20px;box-shadow:0 8px 24px rgba(14,60,100,.05)}
.r-aud .who{font-family:'Geist Mono',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#0E74C1;margin-bottom:8px}
.r-aud p{margin:0;font-size:14.5px;line-height:1.65}
.r-cites{background:#F7FAFC;border-radius:14px;padding:22px 26px;margin-top:10px}
.r-cites ol{margin:8px 0 0;padding-left:20px;font-size:13.5px;line-height:1.8}
.r-take{font-family:'Instrument Serif',serif;font-size:clamp(21px,2.6vw,27px);line-height:1.6;color:#143A56}
.r-take em{color:#0E74C1}
.r-anchor{display:inline-block;margin-top:18px;background:#0E74C1;color:#fff!important;border-radius:999px;padding:10px 20px;font-weight:700;font-size:14px;text-decoration:none}
.r-note{font-size:13px;color:#8a96a3;margin-top:14px}
</style>
<div id="rprog"></div>
<script>addEventListener('scroll',()=>{const d=document.documentElement;document.getElementById('rprog').style.width=(d.scrollTop/(d.scrollHeight-d.clientHeight)*100)+'%'},{passive:true})</script>`

const RESEARCH = [
  {
    slug: 'risky-outdoor-play-research',
    kind: 'Research paper',
    mins: 9,
    reviewed: '2026-06-12',
    title: 'Risky Outdoor Play: What a Decade of Research Actually Says (2026 Review)',
    desc: "Canada's position statement on active outdoor play, the UBC research behind it, and what 'as safe as necessary' means in practice — for parents, educators and daycare directors.",
    h1: 'Risky outdoor play: what the research actually says',
    sub: 'A plain-English review of the Canadian evidence — written for parents, educators and directors.',
    tldr: `Canadian researchers — led from UBC and endorsed by a national coalition — concluded that <strong>access to active outdoor play, including its risks, is essential for healthy child development</strong>. The evidence links outdoor and risky play to more physical activity, better social skills and resilience, while serious injuries in supervised early-childhood settings remain rare. The guiding principle the field landed on: keep children <strong>“as safe as necessary, not as safe as possible.”</strong> The position was first published in 2015 and renewed by an updated national statement in 2025.`,
    audience: {
      parents: `A scraped knee is part of the curriculum, not a failure of supervision. Ask your program <em>how</em> children get outdoor time daily (rain or shine is a good sign), not just whether the yard is padded. At home, let your child climb, balance and take small supervised chances — the research links this to confidence and risk-assessment skills, not recklessness.`,
      educators: `Frame risk as something children learn to read, not something adults eliminate. Use risk-benefit thinking: name what a child gains from an activity alongside its hazards, and remove <em>hazards</em> (broken glass, faulty equipment) rather than <em>risks</em> (height, speed, weather). Document outdoor learning the way you document literacy — it is developmental work.`,
      directors: `Daily outdoor time, year-round, is defensible policy backed by a national position statement — useful language for parent handbooks and licensing conversations. Pair an outdoor-play policy with clear hazard checklists and incident documentation so the “as safe as necessary” line is auditable, not aspirational.`,
    },
    cites: [
      ['Tremblay et al., Position Statement on Active Outdoor Play, Int. J. Environ. Res. Public Health 12(6), 2015', 'https://www.mdpi.com/1660-4601/12/6/6475'],
      ['2025 Position Statement on Active Outdoor Play: process and methodology, Int. J. Behav. Nutr. Phys. Act.', 'https://ijbnpa.biomedcentral.com/articles/10.1186/s12966-025-01806-8'],
      ["UBC School of Population & Public Health — Risky outdoor play positively impacts children's health", 'https://spph.ubc.ca/risky-outdoor-play-positively-impacts-childrens-health-ubc-study/'],
      ['Pan-Canadian Public Health Network — Active Outdoor Play Statement', 'https://www.phn-rsp.ca/en/position-statements/active-outdoor-play-statement.html'],
      ['Position Statement on Active Outdoor Play (PubMed record)', 'https://pubmed.ncbi.nlm.nih.gov/26062040/'],
    ],
    faqs: [
      ['Is risky play the same as dangerous play?', 'No. The research distinguishes risks (challenges a child can perceive and choose, like climbing higher) from hazards (dangers a child cannot see, like a broken rung). The evidence supports giving children risks while adults remove hazards.'],
      ['Does more outdoor play mean more injuries?', 'Serious injuries in supervised early-childhood settings are rare, and the 2015 Canadian position statement concluded the developmental benefits of outdoor play with risk outweigh the small injury risk in typical programs.'],
      ['What does "as safe as necessary" mean?', 'It is the principle adopted by the Canadian position statement: instead of maximizing safety at the cost of development ("as safe as possible"), programs manage real hazards while preserving the challenges children grow from.'],
    ],
    body: `
<p>Few topics divide a parent meeting faster than a child on top of the climber. Over the last decade, Canadian researchers have produced an unusually clear answer — clear enough that it became a national position statement, renewed in 2025. This review summarizes what that evidence says and what it means on a Tuesday morning in the play yard.</p>
<h2>Where the evidence comes from</h2>
<p>In 2015, a cross-Canada group of researchers and health organizations published the <em>Position Statement on Active Outdoor Play</em> in the International Journal of Environmental Research and Public Health, built on systematic reviews of the research on outdoor and risky play. Its central conclusion: <strong>“Access to active play in nature and outdoors — with its risks — is essential for healthy child development.”</strong> The statement explicitly recommends increasing self-directed outdoor play at home, at school, <strong>in child care</strong>, and in the community. A decade later, the field returned to the evidence and published an updated national position statement (2025), keeping the core conclusion intact.</p>
<p>Much of this research program is led from British Columbia — UBC's School of Population and Public Health summarized the systematic-review evidence that risky outdoor play positively impacts children's health, from physical activity to social behaviour.</p>
<h2>What counts as “risky” play</h2>
<p>In this literature, risky play is challenge a child can see and choose: height (climbing), speed (running, sliding, biking), play near natural elements, rough-and-tumble play, and increasing independence. The crucial distinction is <strong>risk vs hazard</strong>: a high branch is a risk a child evaluates; a rotten branch is a hazard an adult removes. The research consensus is to preserve risks and eliminate hazards — summarized in the statement's phrase, keep children <em>“as safe as necessary, not as safe as possible.”</em></p>
<h2>What the evidence links it to</h2>
<ul>
<li><strong>More movement:</strong> children are simply more active outdoors, and outdoor time is one of the most reliable levers on daily physical activity.</li>
<li><strong>Social development:</strong> reviews link unstructured and rough-and-tumble outdoor play with social skills, negotiation and confidence.</li>
<li><strong>Risk literacy:</strong> children given graduated challenges practice assessing risk — the skill that actually prevents injuries as independence grows.</li>
<li><strong>Perspective on injury:</strong> the statement weighs developmental benefit against injury data and concludes the benefits dominate in supervised settings, where serious injuries are rare.</li>
</ul>
<h2>The honest caveats</h2>
<p>This is a literature about <em>supervised, age-appropriate</em> challenge — not the absence of judgment. The position statements concern children roughly 3–12; toddler programs apply the same principles with tighter envelopes. And “outdoor play is essential” does not mean every yard is automatically developmental: quality of the space and the adults' approach to risk both matter, which is why the 2025 update focuses on implementation.</p>`,
  },
  {
    slug: 'screen-time-under-5-canadian-guidelines',
    kind: 'Research brief',
    mins: 4,
    reviewed: '2026-06-12',
    title: 'Screen Time Under 5: What the Canadian Guidelines Actually Say (2026)',
    desc: "The Canadian Paediatric Society's screen-time position for children under 5 — the limits, the four M's, and what it means for daycares and home routines, in plain English.",
    h1: 'Screen time under 5: what the Canadian guidelines actually say',
    sub: 'A 4-minute brief on the Canadian Paediatric Society position — for parents, educators and directors.',
    tldr: `The Canadian Paediatric Society's position (updated 2023): <strong>no routine screen time for children under 2</strong>, and <strong>less than 1 hour a day for ages 2–5</strong> — with the quality and context of use mattering as much as the count. Its framework is four M's: <strong>minimize, mitigate, mindfully use, and model</strong> healthy screen habits. For licensed childcare, the practical translation is simple: screens have almost no place in a high-quality program day.`,
    audience: {
      parents: `Counting minutes is less useful than the four M's: keep screens out of routines (meals, bedtime, the car by default), co-view when screens are used, choose slow-paced content, and remember children copy what they see you do with your phone. Under 2, video-chatting grandma is the accepted exception.`,
      educators: `In a program day rich with materials, peers and outdoor time, screens add little — the CPS position supports keeping them rare and purposeful. When you do use one (documentation, music, the odd video), narrate it: how adults use tools is itself the lesson.`,
      directors: `A written screen policy is an easy trust-builder in your parent handbook: state what (if anything) screens are used for, and anchor it to the CPS position. It also answers the tour question every parent silently asks.`,
    },
    cites: [
      ['Canadian Paediatric Society — Screen time and preschool children: promoting health and development in a digital world (2023)', 'https://cps.ca/en/documents/position/screen-time-and-preschool-children'],
      ['CPS (2017) — Screen time and young children, Paediatrics & Child Health (PMC)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5823000/'],
      ['Caring for Kids (CPS parent resource) — Screen use and young children', 'https://caringforkids.cps.ca/handouts/behavior-and-development/screen-time-and-young-children'],
    ],
    faqs: [
      ['How much screen time is OK for a 3-year-old in Canada?', 'The Canadian Paediatric Society advises less than one hour per day of screen time for children aged 2–5 — and emphasizes that content quality, co-viewing and context matter as much as the number.'],
      ['Is any screen time OK under age 2?', 'The CPS advises no routine screen time under 2; live video-chat with family is the commonly accepted exception.'],
      ["Should daycares use screens at all?", "The CPS framework (minimize, mitigate, mindful use, modelling) supports keeping screens rare and purposeful in group care; most high-quality programs reserve them for documentation rather than children's viewing."],
    ],
    body: `
<p>“How much is too much?” is the most common screen question parents ask — and Canada has an actual, current answer. Here it is without the noise.</p>
<h2>The numbers</h2>
<ul>
<li><strong>Under 2:</strong> no routine screen time (video-chat with family is the accepted exception).</li>
<li><strong>Ages 2–5:</strong> less than 1 hour per day — and less is better.</li>
</ul>
<h2>The part people skip: the four M's</h2>
<p>The CPS position is built less on the stopwatch and more on four practices: <strong>minimize</strong> (fewer, shorter, not in routines), <strong>mitigate</strong> (co-view, choose calm, age-appropriate content), <strong>mindful use</strong> (ask what the screen is displacing — sleep, play, conversation), and <strong>modelling</strong> (children adopt the screen habits they watch adults perform). The 2023 update kept these principles at the centre.</p>
<h2>Why the under-5 years get the strict version</h2>
<p>The position's reasoning: early childhood development runs on serve-and-return interaction, movement and sleep, and screen exposure in these years is associated with displacement of all three. The CPS frames screens as a thing to be budgeted against development, not banned with panic.</p>
<h2>What this means in a daycare day</h2>
<p>A high-quality licensed program already supplies what screens displace — peers, materials, outdoor time, conversation. That is why most strong programs are functionally screen-free for children and say so in their handbook: it is evidence-aligned, and it is a selling point.</p>`,
  },
  {
    slug: 'toddler-naps-sleep-canadian-guidelines',
    kind: 'Research paper',
    mins: 7,
    reviewed: '2026-06-12',
    title: 'How Much Sleep Do Toddlers and Preschoolers Need? The Canadian Guidelines (2026)',
    desc: "Canada's 24-Hour Movement Guidelines on sleep for ages 0–4 — the hour ranges, why naps count, what consistent bedtimes do, and how daycare naps fit in.",
    h1: 'Naps & sleep: how much young children actually need',
    sub: 'The Canadian 24-Hour Movement Guidelines, translated — for parents, educators and directors.',
    tldr: `Canada's 24-Hour Movement Guidelines (developed by CSEP with the Public Health Agency of Canada and an international research panel) set sleep ranges that <strong>include naps</strong>: 14–17 hours for 0–3 months, 12–16 for 4–11 months, <strong>11–14 hours for toddlers (1–2)</strong> and <strong>10–13 hours for preschoolers (3–4)</strong> — with <strong>consistent bedtimes and wake-up times</strong> named in the guideline itself. The same framework recommends calm pre-sleep routines and no screens before bed. Naps aren't a daycare convenience; they're how young children reach their daily total.`,
    audience: {
      parents: `Count the whole 24 hours, not just the night: a 90-minute daycare nap is part of your child's 11–14 (or 10–13) hour budget. The guideline's strongest practical lever is consistency — similar bedtime and wake time every day, weekends included. If bedtime is a battle, look at the afternoon nap's end-time before assuming a sleep problem.`,
      educators: `Your nap room is delivering a national health guideline, not just quiet time. Protect routine: same sequence, same cues, dim light, calm wind-down — the guidelines pair sleep quantity with sleep hygiene. For nap-resisters, quiet rest still respects the routine without forcing sleep.`,
      directors: `Publish your nap schedule and wind-down routine in the parent handbook and daily reports — it reassures parents and anchors your program to the Canadian guidelines. Where parents ask to cut a child's nap, you can ground the conversation in the 24-hour totals rather than preference vs preference.`,
    },
    cites: [
      ['Canadian 24-Hour Movement Guidelines for the Early Years (0–4) — official guidelines', 'https://csepguidelines.ca/guidelines/early-years/'],
      ['Tremblay et al., Canadian 24-Hour Movement Guidelines for the Early Years: integration of physical activity, sedentary behaviour and sleep, BMC Public Health 2017', 'https://bmcpublichealth.biomedcentral.com/articles/10.1186/s12889-017-4859-6'],
      ['Canadian 24-Hour Movement Guidelines for the Early Years (PubMed record)', 'https://pubmed.ncbi.nlm.nih.gov/29219102/'],
      ['Canadian Paediatric Society — Screen time and preschool children (screens and sleep routines)', 'https://cps.ca/en/documents/position/screen-time-and-preschool-children'],
    ],
    faqs: [
      ['How much sleep does a 2-year-old need including naps?', 'The Canadian 24-Hour Movement Guidelines recommend 11–14 hours per 24 hours for toddlers aged 1–2 — naps included — with consistent bedtimes and wake-up times.'],
      ['When do children stop napping?', 'The guidelines set total-sleep ranges rather than a nap deadline: many preschoolers still nap, others meet their 10–13 hours overnight. Watch the 24-hour total and the child, not the calendar.'],
      ['Do daycare naps ruin bedtime?', 'Usually the issue is timing rather than the nap itself: a nap that ends late afternoon pushes bedtime back. Programs and parents can adjust nap end-times while protecting the daily total the guidelines call for.'],
    ],
    body: `
<p>Sleep is the rare parenting topic where Canada has official numbers. They live inside the 24-Hour Movement Guidelines for the Early Years — a framework that treats a child's day as one budget of movement, sitting and sleep, built by CSEP, the Public Health Agency of Canada and a panel of researchers, and published with its evidence base in BMC Public Health.</p>
<h2>The numbers</h2>
<ul>
<li><strong>0–3 months:</strong> 14–17 hours (including naps)</li>
<li><strong>4–11 months:</strong> 12–16 hours (including naps)</li>
<li><strong>Toddlers, 1–2 years:</strong> 11–14 hours (including naps)</li>
<li><strong>Preschoolers, 3–4 years:</strong> 10–13 hours (including naps)</li>
</ul>
<p>Two details in the guideline text matter as much as the ranges. First, the totals <strong>include naps</strong> — the day and night are one budget. Second, the guideline itself specifies <strong>consistent bedtimes and wake-up times</strong>; regularity is in the recommendation, not just the advice columns.</p>
<h2>Why naps count</h2>
<p>For a toddler in full-day care, the math is plain: an 11-hour night plus a 1.5–2 hour nap is what lands them inside the recommended range. Drop the nap without moving bedtime and a 1–2-year-old can quietly run a daily deficit. This is why a protected, routine nap block is standard practice in licensed programs — it is the guideline, operationalized.</p>
<h2>Sleep hygiene, the early-years version</h2>
<p>The guidelines and the Canadian Paediatric Society's screen-time position converge on the same pre-sleep picture: a calming, predictable wind-down; screens out of the routine and out of the bedroom; similar cues at every sleep. Children fall asleep on rhythm and association far more than on willpower.</p>
<h2>The honest caveats</h2>
<p>Ranges are ranges — a healthy child at the bottom of the band exists, and so does one at the top. Nap needs change across the third and fourth year, and the guidelines don't dictate when napping ends; the 24-hour total and the child's daytime functioning are the gauges. Persistent sleep struggles beyond routine fixes are a conversation for your family doctor.</p>`,
  },
  {
    slug: 'toddler-biting-what-research-says',
    kind: 'Research brief',
    mins: 4,
    reviewed: '2026-06-12',
    title: 'Why Toddlers Bite: What the Research Actually Says (and What Works)',
    desc: 'Biting is developmentally normal: most children under 3 bite at least once, and physical aggression peaks around 30–42 months before language takes over. What the evidence says to do.',
    h1: 'Biting: what the research actually says',
    sub: 'A 4-minute brief for the most dreaded incident report in childcare.',
    tldr: `Biting is one of the most distressing — and most <strong>developmentally normal</strong> — behaviours in group care. BC's health authority notes <strong>most children under 3 bite someone at least once</strong>, and the developmental research (summarized in Canada's Encyclopedia on Early Childhood Development) shows physical aggression <strong>rises until roughly 30–42 months, then declines</strong> as language, impulse control and emotion regulation come online. Translation: a biting toddler is usually a child whose feelings outran their words — and the evidence-backed response is calm, consistent, and aimed at building those words.`,
    audience: {
      parents: `If your child bit — or was bitten — it is not a verdict on your parenting or the program. Reasons differ by age: mouth discomfort in infancy, frustration and control in the toddler years. Respond the same way every time, briefly and calmly ("no biting — biting hurts"), comfort the bitten child first, and give the biter words for the feeling. Frequent biting past age 3 is worth raising with your doctor.`,
      educators: `Track the pattern, not just the incident: time of day, transition, crowding, which peers — most biting clusters around predictable triggers you can engineer away (shadowing at transitions, duplicate popular toys, smaller groupings). Keep your incident reports factual and name the developmental context for parents; it turns an accusation moment into an education moment.`,
      directors: `Your biting policy should say out loud what the research says: it is common, developmental, handled with supervision changes — and confidentiality protects both families (no naming the biter). Train staff on a single consistent response and put the policy in the handbook before the first incident, not after.`,
    },
    cites: [
      ['HealthLink BC — Biting (most children under 3 bite at least once; reasons by age)', 'https://www.healthlinkbc.ca/healthwise/biting'],
      ['Encyclopedia on Early Childhood Development — Aggression (topic synthesis, updated 2025)', 'https://www.child-encyclopedia.com/aggression'],
      ['Tremblay — The Development of Physical Aggression from Early Childhood to Adulthood (Encyclopedia on Early Childhood Development)', 'https://www.child-encyclopedia.com/aggression/according-experts/development-physical-aggression-early-childhood-adulthood'],
      ['NAEYC — Understanding and Responding to Children Who Bite', 'https://www.naeyc.org/our-work/families/understanding-and-responding-children-who-bite'],
    ],
    faqs: [
      ['Is biting normal in toddlers?', "Yes — BC's HealthLink notes most children younger than 3 bite someone at least once, and developmental research shows physical aggression typically peaks in the toddler years before declining as language develops."],
      ['Why do toddlers bite?', 'It varies by age: infants may bite from mouth discomfort (teething); from roughly 15–36 months biting is usually frustration, big emotion, or wanting control — feelings that outrun a toddler’s words.'],
      ['When is biting a concern?', 'HealthLink BC suggests biting that continues past age 3, or happens frequently at any age, deserves a conversation with a health professional.'],
    ],
    body: `
<p>No daily-report notification lands harder than "your child was bitten" — except possibly "your child bit." Here is what the developmental evidence actually says, because it changes how the whole conversation should go.</p>
<h2>It is (genuinely) normal</h2>
<p>BC's provincial health resource is blunt: most children younger than 3 bite someone at least once, and most stop on their own. The reasons shift with age — around 5–7 months it is usually mouth discomfort; from about 15 to 36 months it is frustration, big feelings, or wanting control over another person.</p>
<h2>The aggression curve</h2>
<p>The wider research, synthesized in Canada's Encyclopedia on Early Childhood Development, places biting inside a known arc: physical aggression <em>increases</em> across the first 30–42 months of life, then declines as children gain attention regulation, impulse control and — crucially — words. The toddler who bites is not off the curve; they are on it, at its peak, before language has caught up to emotion.</p>
<h2>What works</h2>
<p>Across the clinical and early-childhood guidance the response converges: stay calm, respond the same brief way every time, attend to the bitten child first, name the feeling and give the script ("you wanted the truck — say 'my turn'"), and engineer the environment around known triggers (transitions, crowding, scarce toys). Punishment and biting-back teach fear, not regulation. And the watch-line: frequent biting, or biting past age 3, moves it from developmental to "ask a professional."</p>`,
  },
  {
    slug: 'take-padded-playgrounds',
    kind: 'Take',
    mins: 2,
    reviewed: '2026-06-12',
    anchorSlug: 'risky-outdoor-play-research',
    title: 'Take: We Padded Everything and Called It Progress',
    desc: "A short opinion on risk-free childhoods — and why Canada's own researchers concluded the padding has a cost.",
    h1: 'We padded everything and called it progress',
    sub: 'A two-minute take on the risky-play evidence.',
    tldr: '', audience: null,
    cites: [
      ['Tremblay et al., Position Statement on Active Outdoor Play (2015)', 'https://www.mdpi.com/1660-4601/12/6/6475'],
    ],
    faqs: [],
    body: `Somewhere along the way, a scraped knee stopped being Tuesday and became a liability. We lowered the climbers, rubberized the ground, moved the children indoors when it drizzled — and told ourselves this was love.<br/><br/>
Canada's own researchers checked. Their national position statement says the quiet part in formal language: access to outdoor play <em>with its risks</em> is essential to healthy development. Children who never meet a climbable height never learn to read one. The skill that prevents the broken arm at nine is built on the wobbly log at three.<br/><br/>
The principle the evidence landed on is the one your grandmother already knew: <em>as safe as necessary, not as safe as possible.</em> Remove the broken glass. Keep the height. The bruise is the tuition.`,
  },
  {
    slug: 'take-screen-time-guilt',
    kind: 'Take',
    mins: 2,
    reviewed: '2026-06-12',
    anchorSlug: 'screen-time-under-5-canadian-guidelines',
    title: "Take: The Screen-Time Number Was Never the Point",
    desc: 'A short opinion on the hour-counting wars — and what the Canadian guidance actually asks of parents.',
    h1: 'The screen-time number was never the point',
    sub: 'A two-minute take on the under-5 screen guidance.',
    tldr: '', audience: null,
    cites: [
      ['Canadian Paediatric Society — Screen time and preschool children (2023)', 'https://cps.ca/en/documents/position/screen-time-and-preschool-children'],
    ],
    faqs: [],
    body: `Parents memorized the number — under an hour for the under-fives — and then felt guilty in its general direction. But read the Canadian Paediatric Society's actual position and the stopwatch is the least of it.<br/><br/>
The four M's it leads with — minimize, mitigate, mindful use, <em>modelling</em> — are mostly not about the child's screen. They are about ours. The toddler who can't get eye contact at dinner because of a phone is having a different developmental experience than the one who watched twenty extra minutes of a slow cartoon next to a parent who talked through it.<br/><br/>
Count less. Co-view more. And accept the uncomfortable part of the evidence: the most influential screen in the house is the one in your hand.`,
  },
]

function tldrBox(html) {
  return `<div class="r-tldr"><p>${html}</p></div>`
}
function audienceBoxes(a) {
  const box = (label, html, ac, emoji) => `<div style="--ac:${ac}"><div class="who">${emoji} For ${label}</div><p>${html}</p></div>`
  return `<h2>What to do with this</h2><div class="r-aud">
  ${box('parents', a.parents, '#E8A0AC', '🏡')}${box('educators', a.educators, '#7FB069', '🎨')}${box('directors', a.directors, '#8B7FC7', '🗂️')}</div>`
}
function citationsBlock(cites) {
  const host = (u) => u.replace(/^https?:\/\//, '').split('/')[0]
  return `<h2>Sources</h2><div class="r-cites"><ol>
${cites.map(([t, u]) => `<li>${esc(t)} — <a href="${u}" rel="noopener" target="_blank">${host(u)}</a></li>`).join('\n')}</ol>
<p class="r-note">Every claim above is drawn from the linked sources. This article is general information, not medical or legal advice — for concerns about an individual child, talk to your paediatrician or family doctor.</p></div>`
}
function researchMeta(r) {
  return `<p class="r-meta">${esc(r.kind)} · ${r.mins} min read · reviewed ${r.reviewed} · every claim cited</p>
<p style="font-size:14px;color:#56606b;margin-top:2px">By <a href="/about" style="font-weight:600">Ben Choi</a>, founder of Mitten — written from primary sources and Canadian guidelines.</p>`
}
function howWeResearch() {
  return `<div style="background:#F7FAFC;border-left:4px solid #0E74C1;border-radius:0 12px 12px 0;padding:16px 20px;margin:28px 0;font-size:14px;line-height:1.6;color:#3a4652">
  <strong>How we research this.</strong> We're a childcare-software team, not clinicians. Every claim above is drawn from a primary source — a peer-reviewed study, a national position statement, or a Canadian health guideline — and linked in full so you can check it yourself. We stamp a review date and update the piece when the evidence changes. For decisions about an individual child, talk to your paediatrician or family doctor. Spot something we got wrong? <a href="mailto:info@oktd.ca">Tell us</a> — we correct fast.</div>`
}
function researchHub() {
  const card = (r) => `<a class="tile" href="/research/${r.slug}"><span class="tag">${esc(r.kind)}</span><h3>${esc(r.h1)}</h3><p>${esc(r.desc.slice(0, 130))}…</p></a>`
  const group = (kind, label) => {
    const items = RESEARCH.filter((r) => r.kind === kind)
    return items.length ? `<h2>${label}</h2><div class="grid">${items.map(card).join('')}</div>` : ''
  }
  return layout({
    path: '/research', wide: true,
    title: 'Child Development Research, in Plain English — Mitten Research',
    desc: 'Evidence reviews and short briefs on child development — outdoor play, screen time, sleep, biting and more. Every claim cited to the underlying study or Canadian guideline.',
    h1: 'The research, in plain English',
    sub: 'What the actual studies and Canadian guidelines say about how young children grow — with a TL;DR, takeaways for parents, educators and directors, and every claim cited.',
    tag: 'Mitten Research',
    jsonld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Mitten Research', url: `${DOMAIN}/research` }],
    body: `${group('Research paper', 'Research papers')}
${group('Research brief', 'Short briefs')}
${group('Take', 'Takes — short opinions on the evidence')}
<h2>How we work</h2>
<p>Each piece is built from primary sources — peer-reviewed studies, position statements and Canadian guidelines — linked in full at the bottom of every article, with a visible review date. No claim without a citation. If new evidence changes a conclusion, the article changes and the date moves.</p>`,
  })
}

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
<h2>Find a daycare near you</h2><p style="margin-top:-6px"><a href="/childcare">Browse all childcare boards →</a></p><div class="grid">${DIRECTORY.map((s) => `<a class="tile" href="/childcare/${s.slug}"><span class="tag">${esc(s.region)} · Board</span><h3>${esc(s.name)} daycares</h3><p>Live openings · ${s.daycares.length} centres</p></a>`).join('')}</div>
<h2>Research, in plain English</h2><p style="margin-top:-6px"><a href="/research">Browse all research →</a></p><div class="grid">${RESEARCH.map((r) => `<a class="tile" href="/research/${r.slug}"><span class="tag">${esc(r.kind)}</span><h3>${esc(r.h1)}</h3><p>${esc(r.desc.slice(0, 110))}…</p></a>`).join("")}</div>
<h2>Guides for daycare owners</h2><div class="grid">${guides}</div>
<h2>Childcare software guides & comparisons</h2><div class="grid">${comps}</div>
${cta('Everything these guides recommend — daily reports, billing, payroll prep, parent messaging — is one app.')}`,
  })
}

/* ─────────────────── childcare directory (per-suburb boards) ─────────────────── */
// A free, parent-facing "who's accepting enrolments" board, one page per area.
// Daycares self-claim and set their own status/spots — and the claim IS a Mitten
// signup, i.e. partial onboarding. HONESTY RULE: we never publish a made-up
// status. Pre-added centres are 'unconfirmed' until the owner claims and sets
// their own, and every page says so. Listing a public business name is fine;
// inventing its availability is not.
const STATUS = {
  accepting: ['Accepting', 'st-acc'],
  waitlist: ['Waitlist open', 'st-wait'],
  full: ['Full', 'st-full'],
  unconfirmed: ['Unconfirmed', 'st-unc'],
}
const unc = (arr) => arr.map((d) => ({ status: 'unconfirmed', ...d }))
const DIRECTORY = [
  { slug: 'north-vancouver', name: 'North Vancouver', region: 'BC', daycares: unc([
    { name: 'Park Place Montessori Daycare' }, { name: 'Park Place Montessori — Lonsdale' },
    { name: 'CEFA Early Years North Vancouver' },
    { name: 'Rainforest Learning Centre North Vancouver' }, { name: 'Bluebird Daycare Centre' },
  ]) },
  { slug: 'surrey', name: 'Surrey', region: 'BC', daycares: unc([
    { name: 'Bonnycastle Montessori Daycare', area: 'Guildford' }, { name: "Honey Tree Children's Learning Centre" },
    { name: 'Playbox Childcare Centre' }, { name: 'Beacon House Childcare' }, { name: 'BrightPath Clayton Hills Child Care' },
    { name: 'Rothewood Academy', area: 'White Rock' }, { name: 'Surrey City Childcare', area: 'Guildford' }, { name: 'Power Play Early Learning' },
    { name: 'UMMI Early Learning' }, { name: 'A to Z Childcare Centre', area: 'Fleetwood' }, { name: 'Treehouse Kids Care' },
    { name: 'Little Stars Daycare' }, { name: "Laura Lee's Little Learning Center" }, { name: 'i kids Learning Centre' },
  ]) },
  { slug: 'vancouver', name: 'Vancouver', region: 'BC', daycares: unc([
    { name: 'Mums Montessori Childcare' }, { name: 'Montessori Day Care Society' }, { name: 'Vancouver Montessori School' },
    { name: 'Little Oak Montessori' }, { name: 'Reach for the Stars Montessori' },
  ]) },
  { slug: 'vernon', name: 'Vernon', region: 'BC', daycares: unc([
    { name: 'Appletree Childcare' }, { name: 'Maven Lane Child Care' }, { name: 'Kids Corner Daycare' }, { name: 'Raising Stars Preschool' },
  ]) },
  { slug: 'comox-valley', name: 'Comox Valley', region: 'BC', daycares: unc([
    { name: "Akasha's Littlest Explorers", area: 'Courtenay' }, { name: "Beaufort Children's Centre", area: 'Comox' }, { name: 'Valley Kids Academy', area: 'Courtenay' },
  ]) },
  { slug: 'burnaby', name: 'Burnaby', region: 'BC', daycares: unc([
    { name: "Capitol Hill Children's Centre" }, { name: "Busy Bee Montessori Children's House" }, { name: 'Burnaby Lake Childcare' },
    { name: "Parkview Montessori Children's Centre" }, { name: 'Verdant Early Learning Centre' }, { name: 'Happy Feet Childcare Centre' },
    { name: 'Starlight Child Care Centre' },
  ]) },
  { slug: 'richmond', name: 'Richmond', region: 'BC', daycares: unc([
    { name: 'Maple House Infant Toddler Daycare' }, { name: 'Brighouse United Church Daycare' }, { name: 'Little Waddlers Daycare' },
    { name: 'Treehouse Daycare & Preschool', area: 'Steveston' }, { name: 'Seedlings Childcare', area: 'City Centre' },
  ]) },
  { slug: 'langley', name: 'Langley', region: 'BC', daycares: unc([
    { name: 'Educare Early Learning' }, { name: 'Holistic Roots Childcare Centre' }, { name: 'Little Birds Academy' },
    { name: 'Rainforest Learning Centre Langley' }, { name: 'Jellybean Park Early Learning Centre' }, { name: 'CEFA Willowbrook' },
    { name: 'Fort Langley Learning Centre', area: 'Fort Langley' }, { name: 'Yorkson Childcare Academy', area: 'Willoughby' },
    { name: 'Mumta Childcare', area: 'Aldergrove' },
  ]) },
  { slug: 'coquitlam', name: 'Coquitlam', region: 'BC', daycares: unc([
    { name: 'Green Apple Daycare' }, { name: 'Rainforest Learning Centre Coquitlam' }, { name: 'Parkland Players' },
    { name: 'Mountainview Group Daycare' }, { name: "3 Angels Children's Centre" }, { name: 'Able Child Academy Early Learning' },
  ]) },
  { slug: 'victoria', name: 'Victoria', region: 'BC', daycares: unc([
    { name: 'Carousel Child Care Centre' }, { name: 'Castleview Child Care Centre' }, { name: 'CEFA Early Learning Victoria' },
    { name: 'Centennial Day Care Society' }, { name: 'Compass Childcare' }, { name: 'Willowbrae Childcare Academy Victoria' },
  ]) },
  { slug: 'abbotsford', name: 'Abbotsford', region: 'BC', daycares: unc([
    { name: 'ABC Child Care Centre' }, { name: 'Peek N Play Child Care Centre' }, { name: "Learn n' Play Early Learning Centre" },
    { name: 'Jr. Adventures Childcare' }, { name: 'Wind & Tide Child Development Centre' },
  ]) },
  { slug: 'kelowna', name: 'Kelowna', region: 'BC', daycares: unc([
    { name: 'Grins & Giggles Childcare Centre' }, { name: 'Green Gables Infant Toddler Daycare' }, { name: 'Expanding Horizons Pre-School' },
    { name: 'Kelowna Child Care Society' }, { name: 'Heritage Christian Preschool' },
  ]) },
  { slug: 'nanaimo', name: 'Nanaimo', region: 'BC', daycares: unc([
    { name: 'Inquiring Little Minds' }, { name: 'Alphabet Playhouse Childcare Centre' }, { name: 'Bright Beginnings Early Childhood Centre' },
    { name: 'Green Trails Montessori Daycare' }, { name: "Kid's Place Childcare Centre" },
  ]) },
  { slug: 'new-westminster', name: 'New Westminster', region: 'BC', daycares: unc([
    { name: 'Radiance Childcare Centre' }, { name: 'Graham Montessori School' }, { name: 'Somewhere to Grow Montessori Childcare Centre' },
    { name: 'Tulip Childcare Centre' }, { name: "Queen's Park Daycare" }, { name: 'Precious Early Years Childcare Centre' },
  ]) },
  { slug: 'maple-ridge', name: 'Maple Ridge', region: 'BC', daycares: unc([
    { name: 'Cotton Cloud Daycare' }, { name: "Maple Montessori Children's Center" }, { name: 'Happy Hearts Childcare Centre' },
    { name: 'Lily of the Valley Montessori Center' }, { name: 'Creative Cove Holistic Childcare Centre' }, { name: 'Curious Minds Learning Centre' },
  ]) },
]
const DIR_CSS = `<style>
/* ---- cinematic hero ---- */
.dchero{position:relative;overflow:hidden;background:#0E4E80 url('/cinema/hero-poster.webp') center/cover no-repeat;isolation:isolate}
.dchero .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2}
.dchero::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(8,42,73,.5) 0%,rgba(8,42,73,.72) 55%,rgba(8,42,73,.9) 100%)}
.dchero .in{max-width:60rem;margin:0 auto;padding:4.6rem 1.25rem 3.2rem;text-align:center;color:#fff}
.dchero .eyebrow{color:#bcd9ee}
.dchero h1{color:#fff;margin:.35em 0 .25em;font-size:clamp(2.3rem,6vw,3.8rem);text-shadow:0 2px 36px rgba(0,0,0,.4)}
.dchero .sub{max-width:40rem;margin:.2rem auto 0;color:rgba(255,255,255,.92);font-size:1.12rem}
.dchero .stats{display:flex;flex-wrap:wrap;justify-content:center;gap:2.2rem;margin:1.8rem 0 1.5rem}
.dchero .stat b{font-family:'Instrument Serif',serif;font-size:2.4rem;line-height:1;display:block;color:#fff}
.dchero .stat .lbl{font-family:'Geist Mono',monospace;font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.78);margin-top:.25rem}
.dchero .acts{display:flex;flex-wrap:wrap;justify-content:center;gap:.7rem}
.dchero .btn-primary{background:#fff;color:var(--ink)!important}
.dchero .btn-primary:hover{background:#eaf4fb;color:var(--ink)!important;transform:translateY(-2px)}
.dchero .btn-ghost{border:1px solid rgba(255,255,255,.45);background:rgba(255,255,255,.1);color:#fff!important}
.dchero .btn-ghost:hover{background:rgba(255,255,255,.2)}
.dchero .live-dot{box-shadow:0 0 0 0 rgba(255,255,255,.6)}
@keyframes lpulse{0%{box-shadow:0 0 0 0 rgba(46,184,138,.5)}70%{box-shadow:0 0 0 .4rem rgba(46,184,138,0)}100%{box-shadow:0 0 0 0 rgba(46,184,138,0)}}
.reveal{transition:opacity .7s ease,transform .7s ease}
.js .reveal{opacity:0;transform:translateY(14px)}
.reveal.in{opacity:1;transform:none}
@media(prefers-reduced-motion:reduce){.js .reveal{opacity:1;transform:none}.dchero video{display:none}}
/* ---- trust strip ---- */
.trust{display:flex;flex-wrap:wrap;justify-content:center;gap:.5rem 1.6rem;padding:.85rem 1.25rem;background:var(--tint);border-bottom:1px solid var(--line);font-size:.84rem;color:var(--slate-5);text-align:center}
.trust span{display:inline-flex;align-items:center;gap:.4rem}.trust b{color:var(--ink);font-weight:700}.trust .tk{color:var(--mint);font-weight:800}
/* ---- value-to-owners trio ---- */
.vtrio{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));margin:1.6rem 0 .6rem}
.vcard{position:relative;border:1px solid var(--line);border-radius:1.3rem;padding:1.35rem;background:#fff;box-shadow:0 12px 34px -22px rgba(14,78,128,.4)}
.vcard .ic{width:2.7rem;height:2.7rem;border-radius:.85rem;display:flex;align-items:center;justify-content:center;font-size:1.35rem;background:var(--brand-50);margin-bottom:.7rem}
.vcard h3{margin:0 0 .3rem;font-size:1.18rem}
.vcard p{font-size:.93rem;color:var(--slate-5);margin:0}
.vcard .pin{position:absolute;top:1.1rem;right:1.1rem;font-family:'Geist Mono',monospace;font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;color:var(--mint);font-weight:700}
/* ---- live board ---- */
.boardhead{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:.5rem;margin:1.4rem 0 .2rem}
.boardhead h2{margin:0}
.board{margin:.6rem 0 0;border:1px solid var(--line);border-radius:1.3rem;overflow:hidden;box-shadow:0 14px 40px -28px rgba(14,78,128,.45)}
.board table{margin:0;font-size:.95rem;border-collapse:separate;border-spacing:0}
.board thead th{background:var(--tint);font-family:'Geist Mono',monospace;font-size:.66rem;letter-spacing:.13em;text-transform:uppercase;color:var(--slate-4);font-weight:600;padding:.7rem 1.1rem;border:0;border-bottom:1px solid var(--line)}
.board td{border:0;border-bottom:1px solid var(--line);padding:.85rem 1.1rem;vertical-align:middle}
.board tr:last-child td{border-bottom:0}
.board tbody tr{transition:background .15s}.board tbody tr:hover{background:var(--brand-50)}
.board tr[data-live="1"]{background:#f3fbf7}.board tr[data-live="1"]:hover{background:#e9f7f0}
.board td:nth-child(2),.board td:nth-child(3){white-space:nowrap}
.board td:last-child{text-align:right;white-space:nowrap}
.board .dcname{font-weight:700;color:var(--ink);font-size:1rem}
.st{display:inline-block;border-radius:999px;font-size:.72rem;font-weight:700;padding:.22rem .65rem;white-space:nowrap}
.st-acc{background:#e6f6ee;color:#1f8a55}.st-wait{background:#fdf1d8;color:#a9791b}.st-full{background:#eef1f4;color:#64748b}.st-unc{background:#eef4fb;color:#0E74C1}
.claim{display:inline-block;font-weight:700;text-decoration:none;font-size:.82rem;color:var(--brand);border:1px solid #bcd9ee;border-radius:999px;padding:.3rem .8rem;transition:.16s}
.claim:hover{background:var(--brand);color:#fff;border-color:var(--brand)}
.steps{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));margin:1.2rem 0}
.steps .s{background:var(--tint);border-radius:1.1rem;padding:1.1rem 1.2rem;border:1px solid var(--line)}.steps .n{font-family:'Instrument Serif',serif;font-size:1.6rem;color:var(--brand)}
.subs{display:flex;flex-wrap:wrap;gap:.5rem;margin:1rem 0}.subs a{border:1px solid var(--line);border-radius:999px;padding:.35rem .9rem;font-size:.85rem;text-decoration:none;color:var(--ink);background:#fff}.subs a:hover{border-color:#bcd9ee;background:var(--brand-50)}
.live-note{display:none;align-items:center;gap:.45rem;margin:.7rem 0 0;font-size:.84rem;font-weight:700;color:#1f8a55}
.live-dot{width:.5rem;height:.5rem;border-radius:999px;background:#2eb88a;display:inline-block;box-shadow:0 0 0 0 rgba(46,184,138,.5);animation:lpulse 2s infinite}
.dc-d{margin:.45rem 0 0}
.dc-d summary{cursor:pointer;color:var(--brand);font-weight:600;font-size:.82rem;list-style:none;display:inline-block}
.dc-d summary::-webkit-details-marker{display:none}
.dc-d[open] summary{margin-bottom:.2rem}
.dc-info{font-size:.88rem;color:#475569;display:grid;gap:.35rem;padding:.55rem .8rem;background:#f6fbff;border:1px solid var(--line);border-radius:.7rem}
.dc-info strong{color:var(--ink)}
.dc-info ul{margin:.2rem 0 0;padding-left:1.1rem}.dc-info li{margin:.12rem 0}
.dc-about{margin:.2rem 0 0;color:#475569;font-style:italic}
.dc-links a{color:var(--brand);font-weight:600;text-decoration:none}
/* ---- product showcase (tech authority) ---- */
.showcase{display:grid;gap:1.6rem;grid-template-columns:1.1fr .9fr;align-items:center;margin:2.4rem 0 1rem;background:linear-gradient(135deg,#0E4E80,#0E74C1);border-radius:1.6rem;padding:2rem;color:#fff;overflow:hidden}
.showcase h2{color:#fff;margin:0 0 .4rem}.showcase p{color:rgba(255,255,255,.9);margin:0 0 .9rem}
.showcase ul{list-style:none;padding:0;margin:0 0 1.1rem}.showcase li{padding:.18rem 0 .18rem 1.6rem;position:relative;color:rgba(255,255,255,.95);font-size:.96rem}
.showcase li::before{content:"\\2713";position:absolute;left:0;color:#7ee0bd;font-weight:800}
.showcase .btn-primary{background:#fff;color:var(--ink)!important}
.phone{justify-self:center;width:13.5rem;background:#fff;border-radius:1.6rem;padding:.55rem;box-shadow:0 30px 60px -25px rgba(0,0,0,.55)}
.phone .scr{background:var(--tint);border-radius:1.2rem;padding:.7rem;overflow:hidden}
.phone .ptop{display:flex;align-items:center;gap:.4rem;font-size:.72rem;color:var(--slate-5);margin-bottom:.5rem}
.phone .pcard{background:#fff;border:1px solid var(--line);border-radius:.8rem;padding:.55rem;margin-bottom:.5rem}
.phone .pphoto{height:4.2rem;border-radius:.55rem;background:linear-gradient(135deg,#bcd9ee,#e6c6cc);margin-bottom:.4rem;background-size:cover;background-position:center}
.phone .pname{font-weight:700;font-size:.74rem;color:var(--ink)}
.phone .pmeta{font-size:.66rem;color:var(--slate-5)}
.phone .pmsg{display:flex;gap:.4rem;align-items:flex-start;font-size:.68rem;color:var(--slate)}
.phone .pbub{background:var(--brand-50);border-radius:.6rem .6rem .6rem .2rem;padding:.35rem .5rem;color:var(--ink)}
.phone .ppill{display:inline-block;background:#e6f6ee;color:#1f8a55;font-weight:700;font-size:.62rem;border-radius:999px;padding:.12rem .5rem}
@media(max-width:46rem){.showcase{grid-template-columns:1fr;text-align:center}.showcase ul{display:inline-block;text-align:left}.phone{margin-top:.4rem}}
</style>`
const dnorm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')
const normUrl = (u) => { u = String(u || '').trim(); if (!u) return ''; return u.slice(0, 4) === 'http' ? u : 'https://' + u }
// Build-time rich detail (baked into static HTML for crawlers/AI when a centre has claimed).
function dcDetail(d) {
  const has = (d.programs && d.programs.length) || (d.about && String(d.about).trim()) || (d.paymentMethods && d.paymentMethods.length) || (d.agesServed && String(d.agesServed).trim()) || d.website || d.phone
  if (!has) return ''
  let inner = ''
  if (d.agesServed) inner += `<div><strong>Ages:</strong> ${esc(d.agesServed)}</div>`
  if (d.programs && d.programs.length) inner += `<div><strong>Programs &amp; spaces:</strong><ul>${d.programs.map((p) => `<li>${esc(p.name || '')}${p.capacity != null && p.capacity !== '' ? ` — ${p.capacity} spaces` : ''}${p.opensAt ? ` · opens ${esc(p.opensAt)}` : ''}</li>`).join('')}</ul></div>`
  if (d.paymentMethods && d.paymentMethods.length) inner += `<div><strong>Payments:</strong> ${esc(d.paymentMethods.join(', '))}</div>`
  if (d.about && String(d.about).trim()) inner += `<p class="dc-about">${esc(d.about)}</p>`
  const links = []
  if (d.phone) links.push(`☎ ${esc(d.phone)}`)
  if (d.website) links.push(`<a href="${esc(normUrl(d.website))}" target="_blank" rel="noopener">Website ↗</a>`)
  if (links.length) inner += `<div class="dc-links">${links.join(' · ')}</div>`
  return `<details class="dc-d"><summary>Programs, payments &amp; more</summary><div class="dc-info">${inner}</div></details>`
}
// Per-daycare schema.org entity — enriched with the claimed profile so AI/search index it.
function childCareLd(d, areaName, region, path) {
  const cc = {
    '@type': 'ChildCare', name: d.name,
    areaServed: { '@type': 'City', name: areaName },
    address: { '@type': 'PostalAddress', addressLocality: d.area || areaName, addressRegion: region, addressCountry: 'CA' },
    url: d.website ? normUrl(d.website) : `${DOMAIN}${path}#dc-${d.key || dnorm(d.name)}`,
  }
  if (d.phone) cc.telephone = d.phone
  if (d.paymentMethods && d.paymentMethods.length) cc.paymentAccepted = d.paymentMethods.join(', ')
  const desc = []
  if (d.about) desc.push(d.about)
  if (d.agesServed) desc.push('Ages: ' + d.agesServed)
  if (d.programs && d.programs.length) desc.push('Programs: ' + d.programs.map((p) => p.name + (p.capacity ? ` (${p.capacity} spaces)` : '')).join('; '))
  if (desc.length) cc.description = desc.join('. ')
  return cc
}
function dcRow(d, areaSlug) {
  const [label, cls] = STATUS[d.status] || STATUS.unconfirmed
  const spots = d.status === 'accepting' ? (d.spots ? `${d.spots} open` : 'Yes') : (d.status === 'full' ? '0' : '—')
  const key = d.key || dnorm(d.name)
  const claimed = d.status && d.status !== 'unconfirmed'
  const lastCell = claimed ? '' : `<a class="claim" href="${areaSlug ? `/signup?claim=${areaSlug}&amp;name=${encodeURIComponent(d.name)}` : '/signup'}">Claim →</a>`
  const det = dcDetail(d)
  return `<tr id="dc-${key}" data-name="${key}"${det ? ' data-detailed="1"' : ''}><td><strong>${esc(d.name)}</strong>${d.area ? `<br><span class="mono" style="color:var(--slate-4)">${esc(d.area)}</span>` : ''}${det}</td><td data-cell="status"><span class="st ${cls}">${label}</span></td><td data-cell="spots">${spots}</td><td>${lastCell}</td></tr>`
}
function suburbPage(s, live = []) {
  const path = `/childcare/${s.slug}`
  const updated = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
  // Merge the pre-listed centres with live owner-claimed listings (baked at build time
  // so crawlers + AI see real statuses/profiles; the client overlay keeps it fresh between rebuilds).
  const liveList = (live || []).slice()
  const usedLive = new Set()
  const match = (name) => {
    const k = dnorm(name)
    let l = liveList.find((x) => dnorm(x.name) === k && !usedLive.has(x))
    if (!l) l = liveList.find((x) => { const xk = dnorm(x.name); return xk && !usedLive.has(x) && (xk.indexOf(k) === 0 || k.indexOf(xk) === 0) })
    return l
  }
  const enrich = (base, l) => ({ ...base, status: l.status, spots: l.spots, programs: l.programs, paymentMethods: l.paymentMethods, about: l.about, agesServed: l.agesServed, website: l.website, phone: l.phone })
  const rows = s.daycares.map((d) => {
    const base = { name: d.name, key: dnorm(d.name), area: d.area }
    const l = match(d.name)
    if (l) { usedLive.add(l); return enrich(base, l) }
    return { ...base, status: 'unconfirmed' }
  })
  liveList.forEach((l) => { if (!usedLive.has(l)) rows.push(enrich({ name: l.name, key: dnorm(l.name) }, l)) })
  const total = rows.length
  const confirmed = rows.filter((d) => d.status && d.status !== 'unconfirmed').length
  const faqs = [
    [`Which daycares in ${s.name} are accepting enrolments?`, `Mitten tracks ${total} childcare centres in ${esc(s.name)}, ${s.region}.${confirmed ? ` ${confirmed} ${confirmed === 1 ? 'has' : 'have'} confirmed their current availability;` : ''} centres marked <strong>Accepting</strong> have confirmed open spots, <strong>Waitlist</strong> means a waitlist is open, and <strong>Unconfirmed</strong> means the centre hasn&rsquo;t reported its current availability — call them directly to check.`],
    [`How is this ${s.name} childcare list kept up to date?`, `Every status is set by the daycare itself through a free Mitten listing, so a confirmed status reflects exactly what the centre reported. The page shows the date of the most recent update.`],
    [`I run a daycare in ${s.name} — how do I show up as accepting?`, `<a href="/signup?claim=${s.slug}">Claim your free listing</a> and set your status to Accepting with your open-spot count. It takes about a minute, there&rsquo;s no charge, and ${esc(s.name)} families searching right now will see your openings.`],
    [`What does &ldquo;Unconfirmed&rdquo; mean on this board?`, `It means the centre is a real ${esc(s.name)} daycare we&rsquo;ve listed, but it hasn&rsquo;t set its current availability with us yet. It is <strong>not</strong> a statement that the centre is full or closed — please contact the centre to confirm.`],
  ]
  const heroHtml = `<section class="dchero">
<video class="bg" autoplay muted loop playsinline preload="none" poster="/cinema/hero-poster.webp"><source src="/cinema/hero-loop.mp4" type="video/mp4"></video>
<div class="in">
<span class="eyebrow">${esc(s.region)} · Live childcare board</span>
<h1>Daycares accepting enrolments in ${esc(s.name)}</h1>
<p class="sub">A free, live board of ${esc(s.name)} daycares and their open spots — kept current by the centres themselves.</p>
<div class="stats">
<div class="stat"><b>${total}</b><div class="lbl">centres tracked</div></div>
<div class="stat"><b>${DIRECTORY.length}</b><div class="lbl">BC areas live</div></div>
<div class="stat"><b>Free</b><div class="lbl">to list &amp; claim</div></div>
</div>
<div class="acts">
<a class="btn btn-primary" href="/signup?claim=${s.slug}">Claim your free listing →</a>
<a class="btn btn-ghost" href="#board">See who has space</a>
</div>
</div></section>`
  const body = DIR_CSS + `
<script>document.documentElement.classList.add('js')</script>
<div class="trust">
<span><b>Built in BC</b></span>
<span><span class="tk">●</span> Updated ${updated}</span>
<span>Owner-verified statuses</span>
<span><b>${DIRECTORY.length}</b> areas tracked across BC</span>
</div>
<p class="reveal">As of <strong>${updated}</strong>, Mitten tracks <strong>${total}</strong> childcare centres in <strong>${esc(s.name)}</strong>, ${s.region}${confirmed ? `, of which <strong>${confirmed}</strong> ${confirmed === 1 ? 'has' : 'have'} confirmed current availability` : ''}. Each centre sets its own status: <strong>Accepting</strong> = confirmed open spots, <strong>Waitlist</strong> = a waitlist is open, <strong>Unconfirmed</strong> = not reported yet (call to check). A free, parent-friendly board, kept current by the daycares themselves.</p>
<p class="reveal" style="margin:.3rem 0 0;font-size:.95rem;color:var(--slate-5)">💡 ${esc(s.name)} childcare costs less than the sticker price for most families — see <a href="/childcare-subsidies/${s.slug}">child care subsidies in ${esc(s.name)}</a> (CCFRI, Affordable Child Care Benefit & $10-a-day), or jump to the <a href="/tools/bc-child-care-subsidy-calculator">subsidy calculator</a>.</p>
<div class="vtrio">
<div class="vcard reveal"><div class="ic">🔗</div><span class="pin">helps you rank</span><h3>A free listing + a real backlink</h3><p>Claim your spot and we link straight to your website — a genuine follow link from a fast, Google-indexed page. Free SEO that helps ${esc(s.name)} families find you, not just here.</p></div>
<div class="vcard reveal"><div class="ic">🧸</div><span class="pin">free to try</span><h3>Free childcare software</h3><p>Your listing doubles as a Mitten account — daily photos, parent messaging, sign-in/out, billing and payroll prep. Free for your first 5 children, no per-child fees, no card.</p></div>
<div class="vcard reveal"><div class="ic">📍</div><span class="pin">live</span><h3>Found by parents now</h3><p>Set your status to Accepting with your open-spot count and families searching ${esc(s.name)} childcare <em>today</em> see your openings first — while they&rsquo;re deciding.</p></div>
</div>
<div class="boardhead" id="board"><h2>${esc(s.name)} daycares &amp; their openings</h2></div>
<p style="margin:.1rem 0 0;font-size:.84rem;color:var(--slate-4)">Updated ${updated} · statuses are owner-set · always call the centre to confirm before you visit.</p>
<div class="board"><table>
<thead><tr><th>Daycare</th><th>Status</th><th>Open spots</th><th></th></tr></thead>
<tbody>
${rows.map((d) => dcRow(d, s.slug)).join('\n')}
</tbody>
</table></div>
<p class="live-note" data-live-note><span class="live-dot"></span> Live — <span data-live-count></span> status<span data-live-plural></span> below set by the daycares themselves<span data-live-asof></span>.</p>
<p class="note"><strong>Is this your daycare?</strong> <a href="/signup?claim=${s.slug}">Claim your free listing</a> and set your real status — parents searching ${esc(s.name)} see &ldquo;Accepting&rdquo; centres first. <strong>&ldquo;Unconfirmed&rdquo; only means a centre hasn&rsquo;t updated us yet — it is not a statement that they&rsquo;re full.</strong> Parents: please call the centre to confirm.</p>
<div class="showcase reveal">
<div>
<span class="eyebrow" style="color:#bcd9ee">The app behind the board</span>
<h2>Not just a list — a full childcare platform</h2>
<p>Mitten is a modern, made-in-BC app daycares run their whole day on. Claiming your ${esc(s.name)} listing gives you the lot, free to start:</p>
<ul><li>Daily photos &amp; reports parents love</li><li>Two-way messaging &amp; sign-in/out</li><li>Tuition billing + payroll prep</li><li>Your data stays yours — never sold</li></ul>
<a class="btn btn-primary" href="/app">See the live demo →</a>
</div>
<div class="phone" aria-hidden="true"><div class="scr">
<div class="ptop">🧸 Mitten · ${esc(s.name)}</div>
<div class="pcard"><div class="pphoto" style="background-image:url('/cinema/cubs.webp')"></div><div class="pname">Today at a glance</div><div class="pmeta">12 checked in · 3 napping · 2 new photos</div></div>
<div class="pcard"><div class="pmsg"><div class="pbub">Ava had a great morning! 🎨 Photo sent.</div></div></div>
<div class="pcard"><span class="ppill">Accepting · 3 spots</span> <span class="pmeta">your public listing</span></div>
</div></div>
</div>
<div class="cta"><h3>Run a daycare in ${esc(s.name)}? Claim your free listing.</h3>
<p>Set your enrolment status and open spots so ${esc(s.name)} parents searching <em>right now</em> find you first — it&rsquo;s free and takes a minute. Claiming also unlocks Mitten&rsquo;s free parent app (daily photos, reports, messaging) whenever you want it.</p>
<a class="btn" href="/signup?claim=${s.slug}">Claim your free listing →</a></div>
<h2>How the ${esc(s.name)} board works</h2>
<div class="steps">
<div class="s reveal"><div class="n">1</div><strong>Claim your listing</strong><p style="font-size:.88rem;color:var(--slate-5);margin:.2rem 0 0">Free, one minute — just confirm it&rsquo;s your centre.</p></div>
<div class="s reveal"><div class="n">2</div><strong>Set your status</strong><p style="font-size:.88rem;color:var(--slate-5);margin:.2rem 0 0">Accepting, waitlist or full — and how many spots are open.</p></div>
<div class="s reveal"><div class="n">3</div><strong>Parents find you</strong><p style="font-size:.88rem;color:var(--slate-5);margin:.2rem 0 0">Families searching ${esc(s.name)} childcare see your openings, live.</p></div>
</div>
${faqBlock(faqs)}
<h2>Other areas</h2>
<div class="subs">${DIRECTORY.filter((x) => x.slug !== s.slug).map((x) => `<a href="/childcare/${x.slug}">${esc(x.name)}</a>`).join('')}<a href="/childcare">All areas →</a></div>
<script>(function(){
var AREA=${JSON.stringify(s.slug)},SITE=${JSON.stringify(CONVEX_SITE)};
function norm(s){return (s||'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function pill(st){var m={accepting:['Accepting','st-acc'],waitlist:['Waitlist open','st-wait'],full:['Full','st-full'],unconfirmed:['Unconfirmed','st-unc']};var x=m[st]||m.unconfirmed;var sp=document.createElement('span');sp.className='st '+x[1];sp.textContent=x[0];return sp;}
function spotsTxt(l){return l.status==='accepting'?(l.spots?l.spots+' open':'Yes'):(l.status==='full'?'0':'—');}
function hasDetail(l){return (l.programs&&l.programs.length)||(l.about&&(''+l.about).trim())||(l.paymentMethods&&l.paymentMethods.length)||(l.agesServed&&(''+l.agesServed).trim())||l.website||l.phone;}
function buildDetail(l){var d=document.createElement('div');d.className='dc-info';
if(l.agesServed){var a=document.createElement('div');a.innerHTML='<strong>Ages:</strong> ';a.appendChild(document.createTextNode(l.agesServed));d.appendChild(a);}
if(l.programs&&l.programs.length){var pw=document.createElement('div');pw.innerHTML='<strong>Programs &amp; spaces:</strong>';var ul=document.createElement('ul');l.programs.forEach(function(p){var li=document.createElement('li');var t=p.name||'';if(p.capacity!=null&&p.capacity!=='')t+=' — '+p.capacity+' spaces';if(p.opensAt)t+=' · opens '+p.opensAt;li.textContent=t;ul.appendChild(li);});pw.appendChild(ul);d.appendChild(pw);}
if(l.paymentMethods&&l.paymentMethods.length){var pm=document.createElement('div');pm.innerHTML='<strong>Payments:</strong> ';pm.appendChild(document.createTextNode(l.paymentMethods.join(', ')));d.appendChild(pm);}
if(l.about&&(''+l.about).trim()){var ab=document.createElement('p');ab.className='dc-about';ab.textContent=l.about;d.appendChild(ab);}
if(l.phone||l.website){var lk=document.createElement('div');lk.className='dc-links';if(l.phone)lk.appendChild(document.createTextNode('☎ '+l.phone+'   '));if(l.website){var u=''+l.website;if(u.slice(0,4)!=='http')u='https://'+u;var w=document.createElement('a');w.href=u;w.target='_blank';w.rel='noopener noreferrer';w.textContent='Website ↗';lk.appendChild(w);}d.appendChild(lk);}
return d;}
function attachDetails(tr,l){if(!hasDetail(l)||tr.getAttribute('data-detailed')||tr.querySelector('.dc-d'))return;var cell=tr.firstElementChild;if(!cell)return;var det=document.createElement('details');det.className='dc-d';var sum=document.createElement('summary');sum.textContent='Programs, payments & more';det.appendChild(sum);det.appendChild(buildDetail(l));cell.appendChild(det);}
try{fetch(SITE+'/directory?area='+encodeURIComponent(AREA)).then(function(r){return r.json();}).then(function(d){
var live=(d&&d.listings)||[];if(!live.length)return;
var table=document.querySelector('.board table');if(!table)return;
var rows=[].slice.call(table.querySelectorAll('tr[data-name]'));
var byName={};rows.forEach(function(tr){byName[tr.getAttribute('data-name')]=tr;});
var n=0,maxTs=0;
live.forEach(function(l){if(l.updatedAt&&l.updatedAt>maxTs)maxTs=l.updatedAt;});
live.forEach(function(l){
var key=norm(l.name);var tr=byName[key];
if(!tr){rows.forEach(function(r){if(tr)return;var k=r.getAttribute('data-name');if(k&&(k.indexOf(key)===0||key.indexOf(k)===0))tr=r;});}
if(tr){var sc=tr.querySelector('[data-cell=status]');if(sc){sc.innerHTML='';sc.appendChild(pill(l.status));}var pc=tr.querySelector('[data-cell=spots]');if(pc)pc.textContent=spotsTxt(l);tr.setAttribute('data-live','1');attachDetails(tr,l);n++;}
else{var ntr=document.createElement('tr');ntr.setAttribute('data-name',key);var t1=document.createElement('td');var b=document.createElement('strong');b.textContent=l.name||'';t1.appendChild(b);var t2=document.createElement('td');t2.setAttribute('data-cell','status');t2.appendChild(pill(l.status));var t3=document.createElement('td');t3.setAttribute('data-cell','spots');t3.textContent=spotsTxt(l);var t4=document.createElement('td');ntr.appendChild(t1);ntr.appendChild(t2);ntr.appendChild(t3);ntr.appendChild(t4);(table.querySelector('tbody')||table).appendChild(ntr);attachDetails(ntr,l);n++;}
});
if(n){var note=document.querySelector('[data-live-note]');if(note){var c=note.querySelector('[data-live-count]');if(c)c.textContent=n;var pl=note.querySelector('[data-live-plural]');if(pl)pl.textContent=n===1?'':'es';var as=note.querySelector('[data-live-asof]');if(as&&maxTs){try{as.textContent=' · as of '+new Date(maxTs).toLocaleDateString(undefined,{month:'short',day:'numeric'});}catch(e){}}note.style.display='flex';}}
}).catch(function(){});}catch(e){}
})();</script>
<script>(function(){try{var els=document.querySelectorAll('.reveal');if(!('IntersectionObserver' in window)){for(var i=0;i<els.length;i++)els[i].classList.add('in');return;}var io=new IntersectionObserver(function(en){en.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target);}});},{threshold:.12,rootMargin:'0px 0px -8% 0px'});els.forEach(function(e){io.observe(e);});}catch(e){var l=document.querySelectorAll('.reveal');for(var i=0;i<l.length;i++)l[i].classList.add('in');}})();</script>`
  return layout({
    path, wide: false, heroHtml,
    title: `Daycares Accepting Enrolments in ${s.name} — Live Openings | Mitten`,
    desc: `See which ${s.name} daycares are accepting enrolments and how many spots are open — a free live childcare board, updated by the centres themselves.`,
    h1: `Daycares accepting enrolments in ${s.name}`,
    sub: `A free, live board of ${s.name} daycares and their openings — kept current by the centres themselves.`,
    tag: `${s.region} · Childcare board`,
    jsonld: [
      {
        '@context': 'https://schema.org', '@type': 'CollectionPage',
        name: `Daycares accepting enrolments in ${s.name}`,
        description: `A free board of ${total} childcare centres in ${s.name}, ${s.region}, with enrolment status set by each centre.`,
        url: `${DOMAIN}${path}`,
        dateModified: TODAY,
        inLanguage: 'en-CA',
        isPartOf: { '@type': 'WebSite', name: 'Mitten', url: DOMAIN },
        about: { '@type': 'Thing', name: `Childcare in ${s.name}, ${s.region}` },
      },
      {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: DOMAIN },
          { '@type': 'ListItem', position: 2, name: 'Find a daycare', item: `${DOMAIN}/childcare` },
          { '@type': 'ListItem', position: 3, name: s.name, item: `${DOMAIN}${path}` },
        ],
      },
      {
        '@context': 'https://schema.org', '@type': 'ItemList',
        name: `${s.name} childcare centres`,
        numberOfItems: total,
        itemListOrder: 'https://schema.org/ItemListUnordered',
        itemListElement: rows.map((d, i) => ({
          '@type': 'ListItem', position: i + 1,
          item: childCareLd(d, s.name, s.region, path),
        })),
      },
      faqLd(faqs),
    ],
    body,
  })
}
// Per-area subsidy page — local-intent SEO ("childcare subsidies in <area>"),
// wired to that area's live board + the calculator + the subsidy guides.
function subsidyAreaPage(s) {
  const path = `/childcare-subsidies/${s.slug}`
  const n = s.daycares.length
  const faqs = [
    [`How much is the child care subsidy in ${s.name}?`, `${esc(s.name)} families get the same BC subsidies as the rest of the province. At a participating centre, CCFRI lowers fees automatically — up to $900/month for infants and toddlers and $545 for 3-years-to-Kindergarten (group rates). The income-tested Affordable Child Care Benefit (household income up to about $111,000) can reduce your fee further, and $10-a-day sites cap full-time fees at roughly $200/month.`],
    [`Do ${s.name} daycares offer CCFRI and $10-a-day?`, `Most licensed ${esc(s.name)} centres take part in CCFRI, and a growing number are $10-a-day (CWELCC) sites. Check each centre on our <a href="/childcare/${s.slug}">${esc(s.name)} childcare board</a> or ask the centre directly.`],
    [`How do I apply for child care subsidy in ${s.name}?`, `CCFRI is automatic at a participating centre — there's nothing to apply for. For the Affordable Child Care Benefit you apply through My Family Services and submit a CF2798 Child Care Arrangement form with your provider — see our <a href="/guides/how-to-apply-affordable-child-care-benefit-bc">step-by-step guide</a>.`],
  ]
  const body = DIR_CSS + `
<p>Child care in <strong>${esc(s.name)}</strong>, ${s.region} costs far less than the sticker price once subsidies are applied. ${esc(s.name)} families have access to the same three BC programs as everyone in the province — here's how each one works, what you'll actually pay, and how to claim them.</p>
<div class="vtrio">
<div class="vcard"><div class="ic">🧾</div><span class="pin">automatic</span><h3>CCFRI fee reduction</h3><p>Your centre opts in and the reduction lands on your invoice automatically — no application, no income test. Up to $900/month for under-3s.</p></div>
<div class="vcard"><div class="ic">💸</div><span class="pin">income-tested</span><h3>Affordable Child Care Benefit</h3><p>You apply and renew yearly; household income up to ~$111,000 qualifies. Stacks on top of CCFRI — for lower incomes it can reach close to $0.</p></div>
<div class="vcard"><div class="ic">🔟</div><span class="pin">at $10/day sites</span><h3>$10-a-day (CWELCC)</h3><p>At participating ${esc(s.name)} sites, full-time fees are capped at about $200/month ($10/day).</p></div>
</div>
<h2>CCFRI fee reductions (2025–26)</h2>
<table>
<thead><tr><th>Age category</th><th>Group / centre</th><th>Family / in-home</th></tr></thead>
<tbody>
<tr><td>Infant (0–18 months)</td><td>$900</td><td>$600</td></tr>
<tr><td>Toddler (18–36 months)</td><td>$900</td><td>$600</td></tr>
<tr><td>3 years to Kindergarten</td><td>$545</td><td>$500</td></tr>
<tr><td>Kindergarten</td><td>$320</td><td>$320</td></tr>
<tr><td>Grade 1 to age 12</td><td>$115</td><td>$145</td></tr>
<tr><td>Preschool (part-day)</td><td>$95</td><td>—</td></tr>
</tbody>
</table>
<p class="note"><strong>What will you actually pay in ${esc(s.name)}?</strong> Enter your numbers in the free <a href="/tools/bc-child-care-subsidy-calculator">BC child care subsidy calculator</a> — it estimates your CCFRI reduction, ACCB eligibility and the $10-a-day cap in one go.</p>
<h2>How ${esc(s.name)} families apply</h2>
<ol>
<li><strong>CCFRI — nothing to do.</strong> Ask your ${esc(s.name)} centre if they're a CCFRI participant (most are); the reduction shows on your invoice.</li>
<li><strong>Affordable Child Care Benefit — apply online</strong> via <a href="https://gov.bc.ca/affordablechildcarebenefit" target="_blank" rel="noopener">My Family Services</a>, with your SIN, CRA Notice of Assessment, your child's birth certificate and banking details. Full walkthrough: <a href="/guides/how-to-apply-affordable-child-care-benefit-bc">how to apply for the ACCB</a>.</li>
<li><strong>Complete the CF2798</strong> with your provider — our free <a href="/tools/cf2798-child-care-arrangement-form">CF2798 helper</a> fills most of it for you.</li>
<li><strong>Renew every year</strong> so your reduction doesn't lapse.</li>
</ol>
<div class="cta"><h3>Find a ${esc(s.name)} daycare with space</h3>
<p>We track <strong>${n}</strong> ${esc(s.name)} centres on a free, live board — many take CCFRI and subsidy. See who's accepting enrolments right now.</p>
<a class="btn" href="/childcare/${s.slug}">See ${esc(s.name)} openings →</a></div>
<h2>Learn more</h2>
<div class="subs"><a href="/guides/ccfri-explained-for-parents">CCFRI explained</a><a href="/guides/how-to-apply-affordable-child-care-benefit-bc">Applying for the ACCB</a><a href="/tools/cf2798-child-care-arrangement-form">CF2798 helper</a><a href="/tools/bc-child-care-subsidy-calculator">Subsidy calculator</a><a href="/childcare/${s.slug}">${esc(s.name)} daycare board</a></div>
${faqBlock(faqs)}`
  return layout({
    path, wide: false,
    title: `Child Care Subsidies in ${s.name}, BC — CCFRI, ACCB & $10/Day (2026)`,
    desc: `How much child care costs in ${s.name} after subsidies: CCFRI fee reductions by age, Affordable Child Care Benefit eligibility, $10-a-day sites, and how ${s.name} families apply. Free calculator.`,
    h1: `Child care subsidies in ${s.name}`,
    sub: `What ${s.name} families actually pay after CCFRI, the Affordable Child Care Benefit and $10-a-day — and how to claim each one.`,
    tag: `${s.region} · Subsidies`,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'WebPage', name: `Child care subsidies in ${s.name}`, url: `${DOMAIN}${path}`, dateModified: TODAY, inLanguage: 'en-CA', isPartOf: { '@type': 'WebSite', name: 'Mitten', url: DOMAIN }, about: { '@type': 'Thing', name: `Child care subsidies in ${s.name}, ${s.region}` } },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: DOMAIN },
        { '@type': 'ListItem', position: 2, name: 'Find a daycare', item: `${DOMAIN}/childcare` },
        { '@type': 'ListItem', position: 3, name: `${s.name} subsidies`, item: `${DOMAIN}${path}` },
      ] },
      faqLd(faqs),
    ],
    body,
  })
}
function directoryIndex() {
  const body = DIR_CSS + `
<p>Mitten&rsquo;s free childcare boards show which daycares are <strong>accepting enrolments</strong> — and how many spots are open — area by area, kept current by the centres themselves. Pick your area:</p>
<div class="grid">${DIRECTORY.map((s) => `<a class="tile" href="/childcare/${s.slug}"><span class="tag">${esc(s.region)}</span><h3>${esc(s.name)}</h3><p>${s.daycares.length} daycares · live openings</p></a>`).join('')}</div>
<div class="cta"><h3>Run a daycare? Claim your free listing.</h3><p>Set your enrolment status and open spots so local parents find you first — free, one minute. Plus Mitten&rsquo;s parent app whenever you want it.</p><a class="btn" href="/signup">Claim your free listing →</a></div>
<p class="note">Statuses are set by the daycares themselves. &ldquo;Unconfirmed&rdquo; centres haven&rsquo;t updated their availability with us yet — always call to confirm. Are you an owner? <a href="/signup">Claim your listing</a> to set yours.</p>`
  return layout({
    path: '/childcare', wide: true,
    title: 'Daycares Accepting Enrolments Near You — Live Childcare Boards | Mitten',
    desc: 'Find daycares accepting enrolments by area across BC — live openings and open-spot counts, updated by the centres themselves. Free childcare boards for parents.',
    h1: 'Find daycares accepting enrolments',
    sub: 'Live local boards of which daycares have space — kept current by the centres themselves.',
    tag: 'Childcare boards',
    jsonld: [
      {
        '@context': 'https://schema.org', '@type': 'CollectionPage',
        name: 'Mitten Childcare Boards', url: `${DOMAIN}/childcare`,
        description: `Free childcare boards across ${DIRECTORY.length} BC areas — which daycares are accepting enrolments, set by the centres themselves.`,
        dateModified: TODAY, inLanguage: 'en-CA',
        isPartOf: { '@type': 'WebSite', name: 'Mitten', url: DOMAIN },
      },
      {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: DOMAIN },
          { '@type': 'ListItem', position: 2, name: 'Find a daycare', item: `${DOMAIN}/childcare` },
        ],
      },
      {
        '@context': 'https://schema.org', '@type': 'ItemList',
        name: 'Childcare boards by area', numberOfItems: DIRECTORY.length,
        itemListElement: DIRECTORY.map((s, i) => ({
          '@type': 'ListItem', position: i + 1, name: `${s.name} daycares`, url: `${DOMAIN}/childcare/${s.slug}`,
        })),
      },
    ],
    body,
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

const urls = ['/', '/resources', '/about']

// About — real story + E-E-A-T (Organization + Person schema, named founder).
write('about/index.html', layout({
  path: '/about',
  title: 'About Mitten — Childcare Software Built in BC by OKTD',
  desc: 'Mitten is a childcare app built in Langley, BC by OKTD for a real daycare — Pacific Coast Childcare Academy — and now offered to every BC daycare. Who we are and how we research our childcare guides.',
  h1: 'About Mitten',
  sub: 'A childcare app built in British Columbia — for a real daycare, by the studio that runs it.',
  tag: 'About',
  jsonld: [
    { '@context': 'https://schema.org', '@type': 'AboutPage', url: `${DOMAIN}/about`, name: 'About Mitten' },
    { '@context': 'https://schema.org', ...PUBLISHER },
    { '@context': 'https://schema.org', ...AUTHOR },
  ],
  body: `
<p>Mitten is a childcare management app — daily reports, photos, messaging, billing, payroll prep — built in <strong>Langley, British Columbia</strong>. It didn't start as a product. It started as software <strong>OKTD</strong> (our web &amp; app studio) built for a real client daycare, <strong>Pacific Coast Childcare Academy</strong>, who still use it every day. Once it worked for them, we opened it to every BC daycare.</p>
<p>That origin shapes everything: Mitten is <strong>Canadian-built and Canadian-hosted</strong>, priced in the open (free for your first 5 children, then $20/mo + $2 per child), takes <strong>no cut of your tuition payments</strong>, and is built around how childcare actually works here — CCFRI, CRA tax receipts, e-Transfer, provincial ratios — not adapted from a US product.</p>
<h2>Who writes our guides &amp; research</h2>
<p>Our resource library — owner guides, free tools, and the <a href="/research">research hub</a> — is written and edited by <strong>Ben Choi</strong>, Mitten's founder, with the same care we put into the app. We're a software team, not clinicians, and we say so on every research page. Our rule is simple and absolute: <strong>every factual claim links to a primary source</strong> — a peer-reviewed study, a national position statement, or a Canadian health or tax guideline — with a visible review date. If the evidence changes, the article changes.</p>
<h2>How to reach us</h2>
<p>We read every message. Found an error in a guide, or want to suggest a topic? <a href="mailto:info@oktd.ca">info@oktd.ca</a>. Mitten · OKTD · 83–7947 209 St, Langley, BC V2Y 0Y6.</p>`,
}))

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

for (const r of RESEARCH) {
  const path = `/research/${r.slug}`
  urls.push(path)
  write(`research/${r.slug}.html`, layout({
    path, title: r.title, desc: r.desc, h1: r.h1, sub: r.sub, tag: r.kind,
    jsonld: [
      { ...articleLd(path, r.title, r.desc), dateModified: r.reviewed, citation: r.cites.map(([, u]) => u) },
      ...(r.faqs && r.faqs.length ? [faqLd(r.faqs)] : []),
    ],
    body: r.kind === 'Take'
      ? RESEARCH_CSS + researchMeta(r) + `<div class="r-take">${r.body}</div>` + (r.anchorSlug ? `<a class="r-anchor" href="/research/${r.anchorSlug}">Read the research behind this take →</a>` : '') + (r.cites.length ? citationsBlock(r.cites) : '') + cta()
      : RESEARCH_CSS + researchMeta(r) + tldrBox(r.tldr) + `<div class="r-body">` + r.body + `</div>` + audienceBoxes(r.audience) + howWeResearch() + citationsBlock(r.cites) + cta() + faqBlock(r.faqs),
  }))
}

urls.push('/research')
write('research/index.html', researchHub())


write('resources/index.html', hubPage())

urls.push('/childcare')
write('childcare/index.html', directoryIndex())
// Fetch live owner-claimed listings and bake them into the static board pages, so
// crawlers + AI see real statuses/profiles. Resilient: on any error, fall back to
// the pre-list (all "Unconfirmed"). The client overlay still keeps it fresh between rebuilds.
async function fetchLive(slug) {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8000)
    const r = await fetch(`${CONVEX_SITE}/directory?area=${encodeURIComponent(slug)}`, { signal: ctrl.signal })
    clearTimeout(t)
    if (!r.ok) return []
    const d = await r.json()
    return Array.isArray(d?.listings) ? d.listings : []
  } catch {
    return []
  }
}
const liveByArea = {}
await Promise.all(DIRECTORY.map(async (s) => { liveByArea[s.slug] = await fetchLive(s.slug) }))
const claimedTotal = Object.values(liveByArea).reduce((n, arr) => n + arr.length, 0)
for (const s of DIRECTORY) {
  urls.push(`/childcare/${s.slug}`)
  write(`childcare/${s.slug}.html`, suburbPage(s, liveByArea[s.slug]))
  urls.push(`/childcare-subsidies/${s.slug}`)
  write(`childcare-subsidies/${s.slug}.html`, subsidyAreaPage(s))
}
console.log(`  ↳ baked ${claimedTotal} live claimed listing(s) into the childcare boards`)

write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${DOMAIN}${u}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}
</urlset>`)

console.log(`✓ content built: ${RESEARCH.length} research papers, ${GUIDES.length} guides, ${COMPETITORS.length + 1} competitor pages, ${TOOLS.length} tools, ${DIRECTORY.length} childcare boards, hub + sitemap (${urls.length} URLs)`)
