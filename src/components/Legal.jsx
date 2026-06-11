import { BRAND } from '../brand.js'
import BrandLockup from './BrandLockup.jsx'

// Public Terms of Service + Privacy Policy. Plain-language, tailored to a
// Canadian childcare SaaS. This is a solid starting point — have a lawyer
// review before relying on it for a regulated, children's-data product.
const UPDATED = 'June 2026'
const CONTACT = 'info@oktd.ca'
const ADDRESS = '83–7947 209 St, Langley, BC V2Y 0Y6, Canada'

export default function Legal({ page = 'terms' }) {
  const isPrivacy = page === 'privacy'
  return (
    <div className="min-h-screen bg-tint">
      <header className="sticky top-0 z-10 border-b border-line bg-white/80 px-5 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <a href="/"><BrandLockup variant="nav" /></a>
          <nav className="flex gap-4 text-sm font-bold text-slate-500">
            <a href="/terms" className={!isPrivacy ? 'text-brand-700' : 'hover:text-brand-600'}>Terms</a>
            <a href="/privacy" className={isPrivacy ? 'text-brand-700' : 'hover:text-brand-600'}>Privacy</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        {isPrivacy ? <Privacy /> : <Terms />}
        <p className="mt-12 border-t border-line pt-6 text-center text-xs font-semibold text-slate-400">
          {BRAND.short} · {ADDRESS} · {CONTACT}
        </p>
      </main>
    </div>
  )
}

function H({ children }) { return <h2 className="mt-8 text-xl font-extrabold text-brand-700">{children}</h2> }
function P({ children }) { return <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600">{children}</p> }
function Li({ children }) { return <li className="text-sm font-medium leading-relaxed text-slate-600">{children}</li> }

function Terms() {
  return (
    <article>
      <p className="eyebrow">Legal</p>
      <h1 className="mt-1 text-4xl text-brand-700">Terms of Service</h1>
      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-400">Last updated {UPDATED}</p>

      <P>
        These Terms govern your use of {BRAND.short}, a childcare-management platform operated from {ADDRESS}.
        By creating an account or using the service, you (the daycare, its staff, or a parent/guardian) agree to these Terms.
      </P>

      <H>1. Your account & your facility</H>
      <P>
        When you create a daycare on {BRAND.short}, you become the account owner and are responsible for the activity in your
        workspace, for the accuracy of the information you enter, and for keeping your login credentials secure. You are
        responsible for obtaining consent from the parents/guardians of the children you enroll to store their information on {BRAND.short}.
      </P>

      <H>2. Free tier & subscription</H>
      <ul className="mt-3 list-disc space-y-1.5 pl-5">
        <Li>Your facility is <strong>free</strong> while you have 5 or fewer enrolled children.</Li>
        <Li>When you enroll your 6th child, a paid monthly subscription begins. We collect a payment card and bill the monthly amount shown to you before you confirm.</Li>
        <Li>Your first 5 enrolled children are free. From the 6th child, pricing is $20/month plus $2/month for each additional child beyond the sixth. Your bill adjusts automatically as you add or remove children, prorated by our payment processor.</Li>
        <Li>Subscriptions renew monthly until cancelled. You can cancel anytime from your billing settings; you retain access through the end of the paid period.</Li>
        <Li>Fees are in Canadian dollars and are non-refundable except where required by law.</Li>
      </ul>

      <H>3. Payments</H>
      <P>
        Payments are processed by Stripe, Inc. We do not store full card numbers. By subscribing you also agree to Stripe's
        terms. If a payment fails, we may suspend paid features until the balance is resolved.
      </P>

      <H>4. Acceptable use</H>
      <P>
        Don't use {BRAND.short} to break the law, infringe others' rights, upload malicious code, attempt to access other
        facilities' data, or harass anyone. You must have the legal right to upload any photo or information about a child.
      </P>

      <H>5. Your data is yours</H>
      <P>
        You retain ownership of the data you put into {BRAND.short}. We act as a processor of that data on your behalf. You can
        export or request deletion of your facility's data at any time by contacting {CONTACT}. We never sell your data.
      </P>

      <H>6. Availability & changes</H>
      <P>
        We work hard to keep {BRAND.short} available but provide it "as is" without warranties. We may update features and these
        Terms; material changes will be posted here with a new date. Continued use after changes means you accept them.
      </P>

      <H>7. Limitation of liability</H>
      <P>
        To the extent permitted by law, {BRAND.short} is not liable for indirect or consequential damages, and our total
        liability is limited to the amount you paid us in the prior 12 months. Nothing here limits liability that cannot be
        limited by law.
      </P>

      <H>8. Contact</H>
      <P>Questions about these Terms? Email {CONTACT} or write to us at {ADDRESS}.</P>
    </article>
  )
}

function Privacy() {
  return (
    <article>
      <p className="eyebrow">Legal</p>
      <h1 className="mt-1 text-4xl text-brand-700">Privacy Policy</h1>
      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-400">Last updated {UPDATED}</p>

      <P>
        {BRAND.short} helps daycares and families stay connected. We take privacy seriously — especially because our service
        involves information about children. This policy explains what we collect, why, and your choices, consistent with
        Canada's <strong>PIPEDA</strong> and applicable provincial privacy law.
      </P>

      <H>Who controls the data</H>
      <P>
        Each daycare (facility) is the owner of the information about its children and families. {BRAND.short} processes that
        information on the facility's behalf. Facilities are responsible for obtaining parent/guardian consent to use {BRAND.short}.
      </P>

      <H>What we collect</H>
      <ul className="mt-3 list-disc space-y-1.5 pl-5">
        <Li><strong>Account info:</strong> names, email addresses and roles of owners, educators and parents.</Li>
        <Li><strong>Child & care info</strong> entered by the facility: name, age, room, allergies, attendance, daily activities, photos, and messages.</Li>
        <Li><strong>Billing info:</strong> handled by Stripe; we store only a customer/subscription reference, never full card numbers.</Li>
        <Li><strong>Technical info:</strong> basic logs needed to run and secure the service.</Li>
      </ul>

      <H>How we use it</H>
      <P>
        Only to provide the service: showing each facility its own data, sending in-app messages and updates, processing
        subscriptions, and keeping the platform secure. We do <strong>not</strong> sell personal information or use children's
        data for advertising or model training.
      </P>

      <H>Data isolation</H>
      <P>
        Every facility's data is isolated and scoped to that facility. One daycare cannot see another's children, families,
        messages or photos.
      </P>

      <H>Sharing & processors</H>
      <P>
        We use trusted processors to run {BRAND.short}: Convex (database/backend hosting) and Vercel (web hosting), and Stripe
        (payments). They process data under their own security and privacy commitments. We disclose information if required by
        law.
      </P>

      <H>Retention & deletion</H>
      <P>
        We keep data while your facility's account is active. You can request export or deletion of your facility's data at any
        time by emailing {CONTACT}; we'll action it within a reasonable period.
      </P>

      <H>Your rights</H>
      <P>
        Parents and staff can ask their facility to correct or remove their information. You may also contact us directly at
        {' '}{CONTACT} to exercise access or correction rights under applicable privacy law.
      </P>

      <H>Contact</H>
      <P>Privacy questions or requests: {CONTACT} · {ADDRESS}.</P>
    </article>
  )
}
