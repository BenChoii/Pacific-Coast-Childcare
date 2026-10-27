import { timingSafeEqual } from 'node:crypto'
import nodemailer from 'nodemailer'

const clean = (value, limit) => typeof value === 'string' && value.length <= limit && !/[\r\n]/.test(value)

// Private relay for the authenticated outbox. Recipient membership/class checks
// happen again in Convex immediately before delivery. Files stay behind login.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const expected = process.env.MITTEN_OWNER_EVENTS_KEY || ''
  const supplied = String(req.headers.authorization || '').replace(/^Bearer /, '')
  if (!expected || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return res.status(401).json({ error: 'Not authorized' })
  const event = req.body || {}
  if (!clean(event.email, 254) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(event.email) || !clean(event.facility, 160) || !clean(event.title, 160) || !clean(event.room, 100) || !/^[a-z0-9]+$/.test(event.id || '') || !/^\d{4}-\d{2}-\d{2}$/.test(event.startDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(event.endDate || '') || !['schedule', 'learning'].includes(event.kind)) return res.status(400).json({ error: 'Invalid update' })
  if (/@[^@]*\.invalid$/i.test(event.email)) return res.status(400).json({ error: 'Test addresses cannot receive email' })
  if (!process.env.MITTEN_SMTP_PASSWORD) return res.status(503).json({ error: 'Email unavailable' })
  const port = Number(process.env.MITTEN_SMTP_PORT || 465)
  const user = process.env.MITTEN_SMTP_USER || 'onboarding@mitten.care'
  const transport = nodemailer.createTransport({ host: process.env.MITTEN_SMTP_HOST || 'mail.spacemail.com', port, secure: port === 465,
    auth: { user, pass: process.env.MITTEN_SMTP_PASSWORD }, connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000 })
  try {
    const kind = event.kind === 'schedule' ? 'schedule' : 'learning plan'
    await transport.sendMail({ from: `Mitten <${process.env.MITTEN_FROM || user}>`, to: event.email,
      messageId: `<family-plan-${event.id}@mitten.care>`, subject: `${event.facility}: new ${kind}`,
      text: `${event.facility} shared a new ${kind}${event.room ? ` for ${event.room}` : ' for all classes'}.\n\n${event.title}\n${event.startDate}${event.endDate !== event.startDate ? ` through ${event.endDate}` : ''}\n\nSign in to see the uploaded schedule or learning plan:\nhttps://mitten.care/app?open=calendar\n\nThis update is from your daycare. Your child’s information and uploaded files remain inside Mitten.` })
    return res.status(200).json({ ok: true })
  } catch { return res.status(502).json({ error: 'The update email could not be delivered' }) }
}
