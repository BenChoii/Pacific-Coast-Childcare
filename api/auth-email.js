import { timingSafeEqual } from 'node:crypto'
import nodemailer from 'nodemailer'

// The authentication provider generates and verifies the expiring code. This
// private relay only delivers it; neither passwords nor SMTP credentials leave
// the server. Do not turn this into an unauthenticated email endpoint.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({error: 'Method not allowed'})
  const expected = process.env.MITTEN_OWNER_EVENTS_KEY || ''
  const supplied = String(req.headers.authorization || '').replace(/^Bearer /, '')
  if (!expected || Buffer.byteLength(expected) !== Buffer.byteLength(supplied) || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return res.status(401).json({error:'Not authorized'})
  const {email, code, expiresAt} = req.body || {}
  const expiry = typeof expiresAt === 'number' ? expiresAt : Date.parse(expiresAt)
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || !/^\d{8}$/.test(String(code || '')) || !Number.isFinite(expiry) || expiry < Date.now() || expiry > Date.now() + 11 * 60_000) return res.status(400).json({error:'Invalid recovery request'})
  if (!process.env.MITTEN_SMTP_PASSWORD) return res.status(503).json({error:'Email unavailable'})
  const port = Number(process.env.MITTEN_SMTP_PORT || 465)
  const user = process.env.MITTEN_SMTP_USER || 'onboarding@mitten.care'
  const transport = nodemailer.createTransport({host:process.env.MITTEN_SMTP_HOST || 'mail.spacemail.com', port, secure:port === 465,
    auth:{user,pass:process.env.MITTEN_SMTP_PASSWORD}, connectionTimeout:15_000,greetingTimeout:15_000,socketTimeout:30_000})
  try {
    await transport.sendMail({from:`Mitten <${process.env.MITTEN_FROM || user}>`,to:email,subject:'Your Mitten password reset code',
      text:`Your Mitten password reset code is: ${code}\n\nThis code expires in 10 minutes. Enter it only at https://mitten.care/app. Never share it with anyone.\n\nIf you did not request a password reset, you can ignore this email. Your password has not changed.`})
    return res.status(200).json({ok:true})
  } catch { return res.status(502).json({error:'Recovery email could not be delivered'}) }
}
