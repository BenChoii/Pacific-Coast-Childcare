// Serverless email endpoint for the Pacific Coast Childcare Academy booking forms.
//
// The marketing site (a separate Lovable app) POSTs a tour/contact booking here;
// we send TWO confirmations from the Mitten mailbox (ben@mitten.care, which has
// live SPF+DKIM for mitten.care via Spacemail):
//   1. to the parent  — "your tour is confirmed"
//   2. to the daycare owner (Kiran, info@pacificcoastchildcareacademy.ca) — the booking details
//
// Convex can't open SMTP sockets, so this lives as a Vercel Node function on
// mitten.care/api/book-tour. Env vars (set on the `pacific-coast-childcare`
// Vercel project): MITTEN_SMTP_PASSWORD (required), plus optional overrides
// MITTEN_SMTP_HOST / MITTEN_SMTP_PORT / MITTEN_SMTP_USER / MITTEN_FROM / OWNER_EMAIL.
import nodemailer from 'nodemailer'

const SMTP_HOST = process.env.MITTEN_SMTP_HOST || 'mail.spacemail.com'
const SMTP_PORT = Number(process.env.MITTEN_SMTP_PORT || 465)
const SMTP_USER = process.env.MITTEN_SMTP_USER || 'ben@mitten.care'
const SMTP_PASS = process.env.MITTEN_SMTP_PASSWORD
const FROM_EMAIL = process.env.MITTEN_FROM || SMTP_USER
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'info@pacificcoastchildcareacademy.ca'
// Also drop the lead onto the daycare's director CRM (Mitten dashboard). Routed
// by facility slug; set MITTEN_FACILITY_SLUG to the daycare's Mitten slug to turn
// it on (when unset, we just email — no CRM capture).
const CONVEX_SITE = process.env.MITTEN_CONVEX_SITE || 'https://glad-rooster-439.convex.site'
const FACILITY_SLUG = process.env.MITTEN_FACILITY_SLUG || ''

const ACADEMY = {
  name: 'Pacific Coast Childcare Academy',
  email: 'info@pacificcoastchildcareacademy.ca',
  phone: '778-871-9837',
  address: '20040 40A Ave, Langley, B.C. V3A 1K9',
}

const REASON_LABEL = {
  tour: 'Tour', package: 'Package request', waitlist: 'Waitlist',
  birthday: 'Birthday booking', faq: 'FAQ request',
}

const esc = (s) => String(s || '').replace(/[<>&"]/g, (c) => (
  { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]
))
const clean = (v, max) => String(v ?? '').trim().slice(0, max)

function shell(inner) {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#F3F8FC;padding:28px 0">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #E2ECF4">
      <div style="background:#0E74C1;padding:22px 30px;color:#fff;font-size:20px;font-weight:700">${ACADEMY.name}</div>
      <div style="padding:28px 30px;color:#1E293B;font-size:15px;line-height:1.6">${inner}</div>
      <div style="padding:18px 30px;border-top:1px solid #EEF3F8;color:#64748B;font-size:12.5px;line-height:1.6">
        ${esc(ACADEMY.address)}<br>${esc(ACADEMY.phone)} · ${esc(ACADEMY.email)}
        <div style="margin-top:10px;color:#9aabba;font-size:11px">Sent by Pacific Coast Childcare Academy via Mitten · mitten.care</div>
      </div>
    </div>
  </div>`
}

function detailRows(d) {
  const row = (k, v) => v ? `<tr><td style="padding:4px 14px 4px 0;color:#64748B;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:4px 0;color:#1E293B">${esc(v)}</td></tr>` : ''
  return `<table style="border-collapse:collapse;font-size:14px;margin:6px 0 2px">
    ${row('Parent', d.name)}${row('Email', d.email)}${row('Phone', d.phone)}
    ${row("Child's age", d.age)}${row('Preferred time', d.slot)}${row('Request', d.reasonLabel)}
    ${d.message ? row('Message', d.message) : ''}
  </table>`
}

function parentEmail(d) {
  const isTour = d.reason === 'tour'
  const subject = isTour
    ? `Your tour at ${ACADEMY.name} is confirmed 🎉`
    : `We've received your ${d.reasonLabel.toLowerCase()} — ${ACADEMY.name}`
  const lead = isTour
    ? `<p style="margin:0 0 14px">Hi ${esc(d.name.split(' ')[0] || 'there')}, your tour at <strong>${ACADEMY.name}</strong> is confirmed. We can't wait to meet your family! 💛</p>`
    : `<p style="margin:0 0 14px">Hi ${esc(d.name.split(' ')[0] || 'there')}, thanks for reaching out to <strong>${ACADEMY.name}</strong> — we've received your ${esc(d.reasonLabel.toLowerCase())}.</p>`
  const next = `<p style="margin:0 0 14px">${d.slot ? `You asked about <strong>${esc(d.slot)}</strong>. ` : ''}Kiran will personally reach out within <strong>1 business day</strong> to finalize the details and answer any questions.</p>`
  const yours = `<div style="margin:16px 0;padding:14px 16px;background:#F3F8FC;border-radius:12px">${detailRows({ ...d, name: '', email: '' })}</div>`
  const html = shell(`${lead}${next}${d.slot || d.age || d.message ? yours : ''}
    <p style="margin:14px 0 0">In the meantime, feel free to reply to this email or call us at ${esc(ACADEMY.phone)}.</p>
    <p style="margin:14px 0 0">Warmly,<br>The team at ${ACADEMY.name}</p>`)
  const text = `${isTour ? `Your tour at ${ACADEMY.name} is confirmed.` : `We've received your ${d.reasonLabel.toLowerCase()}.`}\n\n` +
    `${d.slot ? `Preferred time: ${d.slot}\n` : ''}Kiran will reach out within 1 business day to finalize the details.\n\n` +
    `${ACADEMY.name}\n${ACADEMY.address}\n${ACADEMY.phone} · ${ACADEMY.email}`
  return { subject, html, text }
}

function ownerEmail(d) {
  const subject = `New ${d.reasonLabel.toLowerCase()} — ${d.name}${d.age ? ` (${d.age})` : ''}`
  const html = shell(`<p style="margin:0 0 8px"><strong>New ${esc(d.reasonLabel.toLowerCase())} from the website.</strong></p>
    ${detailRows(d)}
    <p style="margin:16px 0 0">Reply to this email to reach ${esc(d.name || 'the family')} directly.</p>`)
  const text = `New ${d.reasonLabel.toLowerCase()} from the website.\n\n` +
    `Parent: ${d.name}\nEmail: ${d.email}\nPhone: ${d.phone || '—'}\nChild's age: ${d.age || '—'}\n` +
    `Preferred time: ${d.slot || '—'}\nMessage: ${d.message || '—'}`
  return { subject, html, text }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  body = body || {}

  // Honeypot — bots fill hidden fields; humans never do.
  if (clean(body.website, 200) || clean(body.company, 200)) return res.status(200).json({ ok: true })

  const reason = clean(body.reason, 40).toLowerCase() || 'tour'
  const d = {
    reason,
    reasonLabel: REASON_LABEL[reason] || 'Tour',
    name: clean(body.name, 120),
    email: clean(body.email, 200),
    phone: clean(body.phone, 40),
    age: clean(body.age, 40),
    slot: clean(body.slot, 80),
    message: clean(body.message, 2000),
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)
  if (!d.name || !emailOk) {
    return res.status(400).json({ error: 'Please include your name and a valid email address.' })
  }

  if (!SMTP_PASS) {
    console.error('book-tour: MITTEN_SMTP_PASSWORD not set')
    return res.status(503).json({ error: 'Booking email is not configured yet. Please call us at ' + ACADEMY.phone + '.' })
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })

  const from = `${ACADEMY.name} <${FROM_EMAIL}>`
  const parent = parentEmail(d)
  const owner = ownerEmail(d)

  try {
    await Promise.all([
      transporter.sendMail({ from, to: d.email, replyTo: ACADEMY.email, subject: parent.subject, html: parent.html, text: parent.text }),
      transporter.sendMail({ from: `Mitten <${FROM_EMAIL}>`, to: OWNER_EMAIL, replyTo: `${d.name} <${d.email}>`, subject: owner.subject, html: owner.html, text: owner.text }),
    ])
  } catch (err) {
    console.error('book-tour send failed:', err?.message || err)
    return res.status(502).json({ error: 'We could not send your confirmation just now. Please call us at ' + ACADEMY.phone + '.' })
  }

  // Best-effort: also drop the lead onto the daycare's director CRM (Mitten
  // dashboard) so the same booking that emails them is there to follow up.
  if (FACILITY_SLUG) {
    try {
      await fetch(`${CONVEX_SITE}/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilitySlug: FACILITY_SLUG,
          source: d.reason === 'tour' ? 'book-tour' : 'contact-form',
          reason: d.reason, name: d.name, email: d.email, phone: d.phone,
          age: d.age, slot: d.slot, message: d.message,
        }),
      })
    } catch (e) {
      console.error('book-tour CRM capture failed:', e?.message || e)
    }
  }

  return res.status(200).json({ ok: true })
}
