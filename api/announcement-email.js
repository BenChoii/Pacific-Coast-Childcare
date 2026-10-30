import { timingSafeEqual } from 'node:crypto'
import nodemailer from 'nodemailer'

const clean = (value, limit) => typeof value === 'string' && value.length <= limit && !/[\r\n]/.test(value)

// Private relay for director announcements. Audience and membership checks
// happen again in Convex immediately before delivery.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const expected = process.env.MITTEN_OWNER_EVENTS_KEY || ''
  const supplied = String(req.headers.authorization || '').replace(/^Bearer /, '')
  if (!expected || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return res.status(401).json({ error: 'Not authorized' })
  const event = req.body || {}
  if (!clean(event.email, 254) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(event.email) || !clean(event.facility, 160) || !clean(event.title, 120) || !clean(event.author || '', 160) || typeof event.body !== 'string' || !event.body.trim() || event.body.length > 5000 || !/^[a-z0-9]+$/.test(event.id || '')) return res.status(400).json({ error: 'Invalid announcement' })
  if (/@[^@]*\.invalid$/i.test(event.email)) return res.status(400).json({ error: 'Test addresses cannot receive email' })
  if (!process.env.MITTEN_SMTP_PASSWORD) return res.status(503).json({ error: 'Email unavailable' })
  const port = Number(process.env.MITTEN_SMTP_PORT || 465)
  const user = process.env.MITTEN_SMTP_USER || 'onboarding@mitten.care'
  const transport = nodemailer.createTransport({ host: process.env.MITTEN_SMTP_HOST || 'mail.spacemail.com', port, secure: port === 465,
    auth: { user, pass: process.env.MITTEN_SMTP_PASSWORD }, connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000 })
  try {
    await transport.sendMail({ from: `${event.facility} via Mitten <${process.env.MITTEN_FROM || user}>`, to: event.email,
      messageId: `<announcement-${event.id}@mitten.care>`, subject: `${event.facility}: ${event.title}`,
      text: `${event.body.trim()}\n\n${event.author ? `From ${event.author}, ` : ''}${event.facility}\n\nSee all announcements in Mitten:\nhttps://mitten.care/app?open=messages` })
    return res.status(200).json({ ok: true })
  } catch { return res.status(502).json({ error: 'The announcement email could not be delivered' }) }
}
