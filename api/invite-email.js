import { timingSafeEqual } from 'node:crypto'
import nodemailer from 'nodemailer'

const clean = (value, limit) => typeof value === 'string' && value.length <= limit && !/[\r\n]/.test(value)

// Private relay for parent and educator invitations. Convex rechecks that the
// invite is still open immediately before delivery.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const expected = process.env.MITTEN_OWNER_EVENTS_KEY || ''
  const supplied = String(req.headers.authorization || '').replace(/^Bearer /, '')
  if (!expected || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return res.status(401).json({ error: 'Not authorized' })
  const event = req.body || {}
  if (!clean(event.email, 254) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(event.email) || !clean(event.facility, 160) || !clean(event.childName || '', 160) || !['parent', 'staff', 'admin'].includes(event.role) || !/^[a-f0-9]{16,64}$/.test(event.token || '') || !/^[a-z0-9]+$/.test(event.id || '')) return res.status(400).json({ error: 'Invalid invitation' })
  if (/@[^@]*\.invalid$/i.test(event.email)) return res.status(400).json({ error: 'Test addresses cannot receive email' })
  if (!process.env.MITTEN_SMTP_PASSWORD) return res.status(503).json({ error: 'Email unavailable' })
  const port = Number(process.env.MITTEN_SMTP_PORT || 465)
  const user = process.env.MITTEN_SMTP_USER || 'onboarding@mitten.care'
  const transport = nodemailer.createTransport({ host: process.env.MITTEN_SMTP_HOST || 'mail.spacemail.com', port, secure: port === 465,
    auth: { user, pass: process.env.MITTEN_SMTP_PASSWORD }, connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000 })
  const link = `https://mitten.care/join?t=${event.token}`
  const expires = Number.isFinite(event.expiresAt) ? new Date(event.expiresAt).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', timeZone: 'America/Vancouver' }) : ''
  const what = event.role === 'parent'
    ? `invited you to Mitten to follow ${event.childName ? `${event.childName}'s` : 'your child’s'} day: daily updates, photos, the class schedule and messages with the daycare.`
    : 'invited you to join their team on Mitten.'
  try {
    await transport.sendMail({ from: `${event.facility} via Mitten <${process.env.MITTEN_FROM || user}>`, to: event.email,
      messageId: `<invite-${event.id}-${Date.now()}@mitten.care>`, subject: `${event.facility} invited you to Mitten`,
      text: `Hello,\n\n${event.facility} ${what}\n\nCreate your account with this email address (${event.email}):\n${link}\n\n${expires ? `This link works once and expires on ${expires}. ` : 'This link works once. '}If it has expired, ask the daycare to send a new one.\n\nAlready have a Mitten account? Open the link and choose Sign in.` })
    return res.status(200).json({ ok: true })
  } catch { return res.status(502).json({ error: 'The invitation email could not be delivered' }) }
}
