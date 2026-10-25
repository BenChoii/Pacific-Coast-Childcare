import { timingSafeEqual } from 'node:crypto'
import nodemailer from 'nodemailer'

// Called only by the trusted Convex outbox; not a public mail-sending endpoint.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const expected = process.env.MITTEN_OWNER_EVENTS_KEY || ''
  const supplied = String(req.headers.authorization || '').replace(/^Bearer /, '')
  if (!expected || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return res.status(401).json({ error: 'Not authorized' })
  const event = req.body || {}
  if (!event.probe && (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(event.email || '') || !/^[a-z0-9]+$/.test(event.id || '') || typeof event.summary !== 'string' || event.summary.length > 500)) return res.status(400).json({ error: 'Invalid event' })
  if (!process.env.MITTEN_SMTP_PASSWORD) return res.status(503).json({ error: 'Owner email delivery is not configured.' })
  const port = Number(process.env.MITTEN_SMTP_PORT || 465)
  const user = process.env.MITTEN_SMTP_USER || 'onboarding@mitten.care'
  const transport = nodemailer.createTransport({
    host: process.env.MITTEN_SMTP_HOST || 'mail.spacemail.com', port, secure: port === 465,
    auth: { user, pass: process.env.MITTEN_SMTP_PASSWORD },
    connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000,
  })
  try {
    if (event.probe === true) { await transport.verify(); return res.status(200).json({ ok: true, configured: true }) }
    await transport.sendMail({
      from: `Mitten <${process.env.MITTEN_FROM || user}>`, to: event.email,
      subject: `${String(event.facility || 'Your daycare').replace(/[\r\n]/g, ' ').slice(0, 120)} · ${String(event.type || 'Activity').replace(/[\r\n_.]/g, ' ').slice(0, 70)}`,
      text: `${event.summary}\n\n${new Date(event.createdAt).toLocaleString('en-CA', { timeZone: 'America/Vancouver' })} Pacific\n\nOpen your dashboard for details: https://mitten.care/app`,
      messageId: `<owner-event-${event.id}@mitten.care>`,
    })
    return res.status(200).json({ ok: true })
  } catch (error) {
    if (event.probe === true) return res.status(502).json({ error: 'Owner email connection failed.', code: error.code || 'UNKNOWN', responseCode: error.responseCode || null })
    return res.status(502).json({ error: 'Owner email delivery failed.' })
  }
}
