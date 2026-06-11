import { query, mutation, action, internalQuery, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { requireFacility, randomToken } from './lib'

// ── Application-layer encryption for SIN + banking ──────────────────────────
// AES-256-GCM with a key from the ONBOARDING_ENC_KEY env var (base64 of 32 raw
// bytes, e.g. `openssl rand -base64 32`). The DB only ever holds ciphertext +
// a masked tail; raw values are returned solely to an authed admin via reveal().
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function bytesToB64(bytes: Uint8Array) {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0
    out += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)]
    out += i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)] : '='
    out += i + 2 < bytes.length ? B64[c & 63] : '='
  }
  return out
}
function b64ToBytes(str: string) {
  const clean = str.replace(/[^A-Za-z0-9+/]/g, '')
  const bytes: number[] = []
  let bits = 0, val = 0
  for (const ch of clean) {
    val = (val << 6) | B64.indexOf(ch)
    bits += 6
    if (bits >= 8) { bits -= 8; bytes.push((val >> bits) & 0xff) }
  }
  return new Uint8Array(bytes)
}
async function importKey() {
  const b64 = process.env.ONBOARDING_ENC_KEY
  if (!b64) return null
  return await crypto.subtle.importKey('raw', b64ToBytes(b64.trim()), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}
async function encryptText(key: CryptoKey, text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)))
  return bytesToB64(iv) + ':' + bytesToB64(ct)
}
async function decryptText(key: CryptoKey, blob: string) {
  const [ivb, ctb] = blob.split(':')
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(ivb) }, key, b64ToBytes(ctb))
  return new TextDecoder().decode(pt)
}

async function requireAdmin(ctx: any) {
  const f = await requireFacility(ctx)
  if (f.user.role !== 'admin') throw new Error('Only the owner/director can manage onboarding.')
  return f
}

function maskProfile(p: any) {
  return {
    _id: p._id,
    status: p.status,
    inviteName: p.inviteName,
    inviteRole: p.inviteRole,
    token: p.token,
    createdAt: p.createdAt,
    submittedAt: p.submittedAt ?? null,
    fullName: p.fullName ?? null,
    preferredName: p.preferredName ?? null,
    dob: p.dob ?? null,
    address: p.address ?? null,
    phone: p.phone ?? null,
    personalEmail: p.personalEmail ?? null,
    emergencyName: p.emergencyName ?? null,
    emergencyPhone: p.emergencyPhone ?? null,
    startDate: p.startDate ?? null,
    sinMasked: p.sinLast3 ? `•••-•••-${p.sinLast3}` : null,
    bankMasked: p.bankLast4 ? `••••${p.bankLast4}` : null,
    hasSin: !!p.sinEnc,
    hasBank: !!p.bankEnc,
    documents: (p.documents || []).map((d: any) => ({ name: d.name, kind: d.kind, storageId: d.storageId })),
  }
}

// ── Admin side ──────────────────────────────────────────────────────────────
export const status = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    return { encConfigured: !!process.env.ONBOARDING_ENC_KEY }
  },
})

export const createLink = mutation({
  args: { name: v.string(), role: v.string() },
  handler: async (ctx, { name, role }) => {
    const { facilityId } = await requireAdmin(ctx)
    const token = randomToken()
    await ctx.db.insert('employeeProfiles', {
      facilityId,
      token,
      status: 'pending',
      inviteName: name.trim() || 'New employee',
      inviteRole: role.trim() || 'Educator',
      createdAt: Date.now(),
    })
    return { token }
  },
})

export const listProfiles = query({
  args: {},
  handler: async (ctx) => {
    const { facilityId } = await requireAdmin(ctx)
    const rows = await ctx.db
      .query('employeeProfiles')
      .withIndex('by_facility', (q) => q.eq('facilityId', facilityId))
      .order('desc')
      .collect()
    return rows.map(maskProfile)
  },
})

export const getProfile = query({
  args: { profileId: v.id('employeeProfiles') },
  handler: async (ctx, { profileId }) => {
    const { facilityId } = await requireAdmin(ctx)
    const p = await ctx.db.get(profileId)
    if (!p || p.facilityId !== facilityId) return null
    const masked: any = maskProfile(p)
    masked.documents = await Promise.all(
      (p.documents || []).map(async (d: any) => ({ name: d.name, kind: d.kind, url: await ctx.storage.getUrl(d.storageId) })),
    )
    return masked
  },
})

export const deleteProfile = mutation({
  args: { profileId: v.id('employeeProfiles') },
  handler: async (ctx, { profileId }) => {
    const { facilityId } = await requireAdmin(ctx)
    const p = await ctx.db.get(profileId)
    if (!p || p.facilityId !== facilityId) throw new Error('Not found.')
    for (const d of p.documents || []) {
      try { await ctx.storage.delete(d.storageId) } catch { /* ignore */ }
    }
    await ctx.db.delete(profileId)
  },
})

// Internal helpers so the reveal action can read with the caller's auth.
export const adminFacilityId = internalQuery({
  args: {},
  handler: async (ctx) => (await requireAdmin(ctx)).facilityId,
})
export const secretRow = internalQuery({
  args: { profileId: v.id('employeeProfiles') },
  handler: async (ctx, { profileId }) => await ctx.db.get(profileId),
})

// Decrypt + return the raw SIN/banking — admin only, on explicit request.
export const reveal = action({
  args: { profileId: v.id('employeeProfiles') },
  handler: async (ctx, { profileId }): Promise<{ sin?: string; bank?: any }> => {
    const facilityId = await ctx.runQuery(internal.onboarding.adminFacilityId, {})
    const p = await ctx.runQuery(internal.onboarding.secretRow, { profileId })
    if (!p || p.facilityId !== facilityId) throw new Error('Not found.')
    const key = await importKey()
    if (!key) throw new Error('Encryption key not configured.')
    const out: { sin?: string; bank?: any } = {}
    if (p.sinEnc) out.sin = await decryptText(key, p.sinEnc)
    if (p.bankEnc) out.bank = JSON.parse(await decryptText(key, p.bankEnc))
    return out
  },
})

// ── Public, token-gated (the employee, who has no account) ──────────────────
export const info = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const p = await ctx.db.query('employeeProfiles').withIndex('by_token', (q) => q.eq('token', token)).first()
    if (!p) return null
    const f = await ctx.db.get(p.facilityId)
    return {
      facilityName: f?.name || 'the daycare',
      inviteName: p.inviteName,
      inviteRole: p.inviteRole,
      status: p.status,
      encConfigured: !!process.env.ONBOARDING_ENC_KEY,
    }
  },
})

export const startUpload = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const p = await ctx.db.query('employeeProfiles').withIndex('by_token', (q) => q.eq('token', token)).first()
    if (!p) throw new Error('This onboarding link is invalid.')
    return await ctx.storage.generateUploadUrl()
  },
})

export const submit = action({
  args: {
    token: v.string(),
    fullName: v.string(),
    preferredName: v.string(),
    dob: v.string(),
    address: v.string(),
    phone: v.string(),
    personalEmail: v.string(),
    emergencyName: v.string(),
    emergencyPhone: v.string(),
    startDate: v.string(),
    sin: v.string(),
    bank: v.object({ institution: v.string(), transit: v.string(), account: v.string() }),
    documents: v.array(v.object({ name: v.string(), kind: v.string(), storageId: v.id('_storage') })),
    consent: v.boolean(),
  },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    if (!args.consent) throw new Error('Please confirm the consent box to submit.')
    const key = await importKey()
    const sin = args.sin.replace(/\D/g, '')
    const acct = args.bank.account.replace(/\D/g, '')
    const hasBank = acct.length > 0
    if ((sin || hasBank) && !key) {
      throw new Error('This daycare hasn’t finished enabling secure onboarding yet — please let them know before submitting sensitive info.')
    }
    let sinEnc, sinLast3, bankEnc, bankLast4
    if (sin && key) { sinEnc = await encryptText(key, sin); sinLast3 = sin.slice(-3) }
    if (hasBank && key) { bankEnc = await encryptText(key, JSON.stringify(args.bank)); bankLast4 = acct.slice(-4) }
    await ctx.runMutation(internal.onboarding.saveSubmission, {
      token: args.token,
      fields: {
        fullName: args.fullName, preferredName: args.preferredName, dob: args.dob, address: args.address,
        phone: args.phone, personalEmail: args.personalEmail, emergencyName: args.emergencyName,
        emergencyPhone: args.emergencyPhone, startDate: args.startDate,
        sinEnc, sinLast3, bankEnc, bankLast4, documents: args.documents,
      },
    })
    return { ok: true }
  },
})

export const saveSubmission = internalMutation({
  args: { token: v.string(), fields: v.any() },
  handler: async (ctx, { token, fields }) => {
    const p = await ctx.db.query('employeeProfiles').withIndex('by_token', (q) => q.eq('token', token)).first()
    if (!p) throw new Error('This onboarding link is invalid.')
    const displayName = (fields.preferredName || '').trim() || (fields.fullName || '').trim() || p.inviteName
    let educatorId = p.educatorId
    if (!educatorId) {
      const existing = await ctx.db.query('educators').withIndex('by_facility', (q) => q.eq('facilityId', p.facilityId)).collect()
      educatorId = await ctx.db.insert('educators', {
        facilityId: p.facilityId, name: displayName, role: p.inviteRole, room: 'Unassigned', emoji: '🧑‍🏫',
        hireDate: fields.startDate || 'TBD', certifications: [], status: 'out',
        todaySeconds: 0, punches: [], hoursWeek: 0, hoursTarget: 40, pto: '0 days', order: existing.length,
      })
    } else {
      await ctx.db.patch(educatorId, { name: displayName, role: p.inviteRole })
    }
    const clean: any = {}
    for (const [k, val] of Object.entries(fields)) if (val !== undefined) clean[k] = val
    await ctx.db.patch(p._id, { ...clean, status: 'submitted', submittedAt: Date.now(), consentAt: Date.now(), educatorId })
  },
})
