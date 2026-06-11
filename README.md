# 🐚 Pacific Coast Childcare Academy — Family & Educator Portal

A childcare management portal for **Pacific Coast Childcare Academy** (Vancouver, BC · ages 2.5–5). One calm, connected place for parents, educators, and the director — built to compete with [NestliCare](https://nestlicare.com/), styled to match the academy's brand.

**🔗 Live:** https://pacific-coast-childcare.vercel.app

![stack](https://img.shields.io/badge/React-18-0E74C1) ![stack](https://img.shields.io/badge/Convex-backend-6E84C8) ![stack](https://img.shields.io/badge/Vercel-deployed-000)

## ✨ Features

- **👶 Parents** — live daily learning timeline, photo feed, teacher messaging, check-in/out, **tuition payments**, calendar, child profile.
- **🧑‍🏫 Educators** — one-tap attendance + QR kiosk, activity logging (posts to families instantly), photo sharing, messaging, weekly lesson plans.
- **🏫 Director** — enrolment pipeline, billing health, staff scheduling, room occupancy, reports — with live charts.

All real-time and persistent: logging an activity, sending a message, paying tuition, or checking a child in/out updates a shared **Convex** database and syncs across devices.

## 🔐 Accounts
Real email/password accounts via **Convex Auth**, with a role chosen at sign-up (parent / educator / director). Sessions persist. A no-login **demo** role-picker is also on the landing page for instant exploration.

## 🎨 Brand
Matches the academy's marketing site: ocean-blue ink `#0E74C1`, soft pink + baby-blue pastels, **Instrument Serif** headlines, **Geist** body, **Geist Mono** eyebrow labels, and the real logo.

## 🧱 Stack
React 18 · Vite · Tailwind 3 · Framer Motion · Recharts · lucide-react · **Convex** (DB + auth + serverless functions) · **Stripe** Checkout · Vercel.

## 🚀 Develop
```bash
npm install
npx convex dev        # connects to the dev deployment, watches convex/
npm run dev           # http://localhost:5173
```
Seed/reset demo data: `npx convex run seed:init` · `npx convex run seed:reset` (add `--prod` for production).

## ☁️ Deploy
```bash
# Build the frontend against the prod Convex deployment + push functions:
npx convex deploy --yes --cmd 'npm run build'
# Deploy the static dist/ to Vercel:
vercel deploy --prod
```

## 💳 Activate Stripe payments
Payments are wired and live — they just need a key. The "Pay now" button uses Stripe Checkout when a key is present, and an instant-pay demo otherwise.

```bash
# Test key from dashboard.stripe.com → Developers → API keys
npx convex env set STRIPE_SECRET_KEY sk_test_xxx --prod   # prod
npx convex env set STRIPE_SECRET_KEY sk_test_xxx          # dev (optional)
```
Read at runtime — **no redeploy needed**. Test card: `4242 4242 4242 4242`, any future expiry/CVC.

## 📁 Structure
```
convex/                 # backend
  schema.ts             # tables (auth + children, activities, messages, invoices, …)
  *.ts                  # queries/mutations per collection
  auth.js               # Convex Auth (Password + role)
  payments.ts           # Stripe Checkout actions
  seed.ts               # init / reset demo data
src/
  context/AppContext.jsx   # live Convex data + auth + toasts
  components/              # Login, Auth, Shell, UI, Toasts
  views/                   # parent / staff / admin + shared Messages, Photos
  data/mockData.js         # static reference data (programs, charts)
```
