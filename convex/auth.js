import { Password } from '@convex-dev/auth/providers/Password'
import { convexAuth } from '@convex-dev/auth/server'
import { internal } from './_generated/api'

export const normalizeEmail = email => String(email || '').trim().toLowerCase()

// Password reset uses Convex Auth's hashed, expiring verification records and
// session invalidation. The SMTP secret stays only in the trusted Vercel relay.
const resetProvider = {
  id: 'mitten-password-reset', type: 'email', name: 'Mitten password recovery',
  from: 'Mitten <onboarding@mitten.care>', maxAge: 10 * 60,
  async generateVerificationToken() {
    const numbers = new Uint32Array(1)
    do { crypto.getRandomValues(numbers) } while (numbers[0] >= 4_200_000_000)
    return String(numbers[0] % 100_000_000).padStart(8, '0')
  },
  async authorize(params, account) {
    if (String(params.email || '') !== account.providerAccountId) throw new Error('Invalid recovery code.')
  },
  async sendVerificationRequest({ identifier, token, expires }) {
    if (!process.env.MITTEN_OWNER_EVENTS_KEY) throw new Error('Password recovery email is not configured.')
    const response = await fetch('https://mitten.care/api/auth-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.MITTEN_OWNER_EVENTS_KEY}` },
      body: JSON.stringify({ email: identifier, code: token, expiresAt: expires.getTime() }), signal: AbortSignal.timeout(50_000),
    })
    if (!response.ok) throw new Error('Recovery email could not be sent. Please try again later.')
  },
}
const password = Password({
  reset: resetProvider,
  profile(params) {
    return {
      // _accountEmail is set by our server wrapper, never trusted from callers.
      email: params._accountEmail || normalizeEmail(params.email),
      emailNormalized: normalizeEmail(params.email), name: String(params.name || '').trim().slice(0, 160),
      role: ['parent', 'staff', 'admin'].includes(params.role) ? params.role : 'parent',
    }
  },
})
const baseAuthorize = password.options.authorize
password.options.authorize = async (params, ctx) => {
  const email = normalizeEmail(params.email)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) throw new Error('Enter a valid email address.')
  const identity = await ctx.runQuery(internal.users.authIdentity, { email, exactEmail: String(params.email || '').trim(), flow: String(params.flow || ''), ...(params.inviteToken ? { inviteToken: String(params.inviteToken) } : {}) })
  if (params.flow === 'reset') {
    // Unknown accounts and throttled requests have the same public response.
    if (!identity.userId) return null
    const limit = await ctx.runMutation(internal.users.reserveRecovery, { userId: identity.userId })
    if (!limit.allowed) return null
  }
  return await baseAuthorize({ ...params, email: identity.accountEmail, _accountEmail: identity.accountEmail }, ctx)
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  callbacks: {
    async beforeSessionCreation(ctx, { userId }) {
      const user = await ctx.db.get(userId)
      if (user?.accessStatus === 'suspended') throw new Error('Your daycare access has ended. Contact the owner.')
    },
  },
  providers: [password],
})
