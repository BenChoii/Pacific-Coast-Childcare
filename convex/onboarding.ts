import { query, mutation, action, internalQuery, internalMutation } from './_generated/server'
import type { QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { requireFacility, randomToken } from './lib'
import { recordOwnerEvent } from './notifications'
import { getAuthUserId } from '@convex-dev/auth/server'
import { validateFileBytes } from './files'
import { sealPrivateBlob } from './fileEncryption'

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
    expiresAt: p.expiresAt ?? p.createdAt + 7 * 86400_000,
    revokedAt: p.revokedAt ?? null, revision: p.revision || 1,
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
    documents: (p.documents || []).map((d: any) => ({ name: d.name, kind: d.kind, storageId: d.storageId, hasFile: true })),
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
    const { facilityId, userId } = await requireAdmin(ctx)
    if (name.length > 160 || role.length > 160) throw new Error('Keep the employee name and role under 160 characters.')
    const token = randomToken()
    await ctx.db.insert('employeeProfiles', {
      facilityId,
      token,
      status: 'pending',
      inviteName: name.trim() || 'New employee',
      inviteRole: role.trim() || 'Educator',
      createdAt: Date.now(), expiresAt: Date.now() + 7 * 86400_000, revision: 1,
    })
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'employee_onboarding_link_created', summary: 'A secure employee onboarding link was created. It expires in 7 days and still needs to be shared with the employee.' })
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
    return maskProfile(p)
  },
})

// Preserve employment records; this action archives access, never silently
// destroys legal/payroll history or files.
export const deleteProfile = mutation({
  args: { profileId: v.id('employeeProfiles') },
  handler: async (ctx, { profileId }) => {
    const { facilityId } = await requireAdmin(ctx)
    const p = await ctx.db.get(profileId)
    if (!p || p.facilityId !== facilityId) throw new Error('Not found.')
    await ctx.db.patch(profileId, { revokedAt: Date.now(), status: 'archived' })
    if (p.loginInviteId) await ctx.db.patch(p.loginInviteId, { used: true })
  },
})
export const revokeLink = mutation({
  args: { profileId: v.id('employeeProfiles') },
  handler: async (ctx, { profileId }) => {
    const { facilityId } = await requireAdmin(ctx)
    const p = await ctx.db.get(profileId)
    if (!p || p.facilityId !== facilityId) throw new Error('Not found.')
    await ctx.db.patch(profileId, { revokedAt: Date.now() })
    if (p.loginInviteId) await ctx.db.patch(p.loginInviteId, { used: true })
  },
})
export const reissueLink = mutation({
  args: { profileId: v.id('employeeProfiles') },
  handler: async (ctx, { profileId }) => {
    const { facilityId } = await requireAdmin(ctx)
    const p = await ctx.db.get(profileId)
    if (!p || p.facilityId !== facilityId) throw new Error('Not found.')
    await ctx.db.patch(profileId, { revokedAt: Date.now() })
    if (p.loginInviteId) await ctx.db.patch(p.loginInviteId, { used: true })
    const token = randomToken()
    await ctx.db.insert('employeeProfiles', {
      facilityId, token, status: 'pending', educatorId: p.educatorId,
      inviteName: p.fullName || p.inviteName, inviteRole: p.inviteRole,
      revision: (p.revision || 1) + 1, createdAt: Date.now(), expiresAt: Date.now() + 7 * 86400_000,
    })
    return { token }
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

// ── Public, token-gated (the employee may not have an account yet) ──────────
const isExpired = (p: Doc<'employeeProfiles'>) => (p.expiresAt ?? p.createdAt + 7 * 86400_000) <= Date.now()
async function tokenProfile(ctx: Pick<QueryCtx, 'db'>, token: string, pending = false): Promise<Doc<'employeeProfiles'>> {
  const p = await ctx.db.query('employeeProfiles').withIndex('by_token', q => q.eq('token', token)).first()
  if (!p || p.revokedAt || p.status === 'archived' || isExpired(p)) throw new Error('This onboarding link has expired or was withdrawn. Ask the owner for a new link.')
  if (pending && p.status !== 'pending') throw new Error('This form has already been submitted. Ask the owner for a correction link.')
  if (p.educatorId) {
    const educator = await ctx.db.get(p.educatorId)
    const member = educator?.userId ? await ctx.db.get(educator.userId) : null
    if (!educator || educator.facilityId !== p.facilityId || (member && (member.accessStatus === 'suspended' || member.facilityId !== p.facilityId))) throw new Error('This employee onboarding link has been withdrawn. Contact the owner.')
  }
  return p
}
export const info = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    let p
    try { p = await tokenProfile(ctx, token) } catch { return null }
    const f = await ctx.db.get(p.facilityId)
    const invite = p.loginInviteId ? await ctx.db.get(p.loginInviteId) : null
    return {
      facilityName: f?.name || 'the daycare', inviteName: p.inviteName, inviteRole: p.inviteRole,
      status: p.status, encConfigured: !!process.env.ONBOARDING_ENC_KEY, fileUploadsConfigured: !!process.env.PRIVATE_FILES_KEY,
      expiresAt: p.expiresAt ?? p.createdAt + 7 * 86400_000,
      portalInviteToken: invite && !invite.used && (!invite.expiresAt || invite.expiresAt > Date.now()) ? invite.token : null,
      loginEmail: p.status === 'submitted' ? p.personalEmail || null : null,
    }
  },
})
export const activeToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const p = await tokenProfile(ctx, token, true)
    return { profileId: p._id, facilityId: p.facilityId }
  },
})
// Old raw upload URLs bypassed size/type/ownership validation. Older clients
// receive a clear upgrade error instead of another unrestricted storage URL.
export const startUpload = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await tokenProfile(ctx, token, true)
    throw new Error('Refresh this page to use secure document uploads.')
  },
})
export const uploadDocument = action({
  args: { token: v.string(), fileName: v.string(), mimeType: v.string(), bytes: v.bytes() },
  handler: async (ctx, { token, fileName, mimeType, bytes }): Promise<{ storageId: Id<'_storage'> }> => {
    const p = await ctx.runQuery(internal.onboarding.activeToken, { token })
    if (!fileName.trim() || fileName.length > 200) throw new Error('Use a file name of up to 200 characters.')
    const data = new Uint8Array(bytes)
    validateFileBytes(data, mimeType)
    const storageId = await ctx.storage.store(await sealPrivateBlob(new Blob([data], { type: mimeType })))
    try {
      await ctx.runMutation(internal.files.registerStoredUpload, {
        storageId, facilityId: p.facilityId, onboardingProfileId: p.profileId,
        purpose: 'hr', mimeType, size: data.byteLength,
      })
    } catch (error) { await ctx.storage.delete(storageId); throw error }
    return { storageId }
  },
})
export const submit = action({
  args: {
    token: v.string(), fullName: v.string(), preferredName: v.string(), dob: v.string(), address: v.string(),
    phone: v.string(), personalEmail: v.string(), emergencyName: v.string(), emergencyPhone: v.string(), startDate: v.string(),
    sin: v.string(), bank: v.object({ institution: v.string(), transit: v.string(), account: v.string() }),
    documents: v.array(v.object({ name: v.string(), kind: v.string(), storageId: v.id('_storage') })), consent: v.boolean(),
  },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    await ctx.runQuery(internal.onboarding.activeToken, { token: args.token })
    if (!args.consent) throw new Error('Please confirm the consent box to submit.')
    const fullName = args.fullName.trim(), personalEmail = args.personalEmail.trim().toLowerCase()
    if (!fullName || fullName.length > 160) throw new Error('Enter your full legal name, up to 160 characters.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail) || personalEmail.length > 320) throw new Error('Enter a valid personal email for your staff login.')
    for (const value of [args.preferredName, args.address, args.phone, args.emergencyName, args.emergencyPhone]) {
      if (value.length > 500) throw new Error('Keep each contact field under 500 characters.')
    }
    for (const date of [args.dob, args.startDate]) {
      if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error('Enter a valid date.')
    }
    if (args.dob && args.dob > new Date().toISOString().slice(0, 10)) throw new Error('Date of birth cannot be in the future.')
    if (args.documents.length > 10 || new Set(args.documents.map(d => d.storageId)).size !== args.documents.length) throw new Error('Attach up to 10 different documents.')
    if (args.documents.some(d => !d.name.trim() || d.name.length > 200 || d.kind !== 'document')) throw new Error('Invalid document details. Upload the file again.')
    const sin = args.sin.replace(/[\s-]/g, '')
    if (sin && !/^\d{9}$/.test(sin)) throw new Error('The SIN must contain exactly 9 digits.')
    const bank = { institution: args.bank.institution.trim(), transit: args.bank.transit.trim(), account: args.bank.account.trim() }
    const hasBank = Object.values(bank).some(Boolean)
    if (hasBank && (!/^\d{3}$/.test(bank.institution) || !/^\d{5}$/.test(bank.transit) || !/^\d{7,12}$/.test(bank.account))) throw new Error('Enter a 3-digit institution, 5-digit transit and 7–12-digit account number, or leave all bank fields empty.')
    const key = sin || hasBank ? await importKey() : null
    if ((sin || hasBank) && !key) throw new Error('Secure payroll storage is not enabled yet. Contact your employer before submitting sensitive information.')
    let sinEnc, sinLast3, bankEnc, bankLast4
    if (sin && key) { sinEnc = await encryptText(key, sin); sinLast3 = sin.slice(-3) }
    if (hasBank && key) { bankEnc = await encryptText(key, JSON.stringify(bank)); bankLast4 = bank.account.slice(-4) }
    await ctx.runMutation(internal.onboarding.saveSubmission, {
      token: args.token,
      fields: {
        fullName, personalEmail, preferredName: args.preferredName.trim(), dob: args.dob, address: args.address.trim(),
        phone: args.phone.trim(), emergencyName: args.emergencyName.trim(), emergencyPhone: args.emergencyPhone.trim(), startDate: args.startDate,
        sinEnc, sinLast3, bankEnc, bankLast4, documents: args.documents,
      },
    })
    return { ok: true }
  },
})
export const saveSubmission = internalMutation({
  args: { token: v.string(), fields: v.any() },
  handler: async (ctx, { token, fields }) => {
    // Recheck in the transaction: two concurrent submissions cannot both win.
    const p = await tokenProfile(ctx, token, true)
    for (const document of fields.documents || []) {
      const upload = await ctx.db.query('storedUploads').withIndex('by_storage', q => q.eq('storageId', document.storageId)).first()
      if (!upload || upload.facilityId !== p.facilityId || upload.purpose !== 'hr' || upload.onboardingProfileId !== p._id) throw new Error('A document is not attached to this onboarding form. Upload it again.')
    }
    const educators = await ctx.db.query('educators').withIndex('by_facility', q => q.eq('facilityId', p.facilityId)).collect()
    const profiles = await ctx.db.query('employeeProfiles').withIndex('by_facility', q => q.eq('facilityId', p.facilityId)).collect()
    let educator: Doc<'educators'> | undefined = p.educatorId ? educators.find(e => e._id === p.educatorId) : undefined
    if (p.educatorId && !educator) throw new Error('The employee record is missing. Ask the owner to create a replacement link.')
    // A prior invitation may have created the account before the HR form.
    // Resolve only an unambiguous same-daycare staff identity; never merge a
    // cross-daycare account or a case-colliding legacy identity.
    const users = (await ctx.db.query('users').collect()).filter(u => u.email?.trim().toLowerCase() === fields.personalEmail)
    if (users.length > 1) throw new Error('Several accounts use this email. Ask the owner to repair the staff account first.')
    const user = users[0]
    if (user && (user.accessStatus === 'suspended' || (user.facilityId && (user.facilityId !== p.facilityId || user.role !== 'staff')))) throw new Error('This email belongs to another or inactive membership. Ask the owner for help before submitting.')
    const byAccount = user ? educators.filter(e => e.userId === user._id) : []
    const relatedIds = [...new Set(profiles.filter(row => row._id !== p._id && row.educatorId && row.personalEmail?.trim().toLowerCase() === fields.personalEmail).map(row => row.educatorId))]
    if (byAccount.length > 1 || relatedIds.length > 1 || (educator && byAccount[0] && educator._id !== byAccount[0]._id)) throw new Error('Several employee records match this email. Ask the owner to link the correct record.')
    if (!educator) educator = byAccount[0] || educators.find(e => e._id === relatedIds[0])
    const displayName = fields.preferredName || fields.fullName
    let educatorId = educator?._id
    if (!educatorId) educatorId = await ctx.db.insert('educators', {
      facilityId: p.facilityId, name: displayName, role: p.inviteRole, room: 'Unassigned', emoji: '🧑‍🏫',
      hireDate: fields.startDate || 'TBD', certifications: [], status: 'out', todaySeconds: 0,
      punches: [], hoursWeek: 0, hoursTarget: 40, pto: '0 days', order: educators.length,
    })
    else await ctx.db.patch(educatorId, { name: displayName, role: p.inviteRole })
    // Issuing an email-bound single-use portal invitation does not sign anyone
    // in or attach an unverified account merely because an email was typed.
    let loginInviteId
    if (!educator?.userId) loginInviteId = await ctx.db.insert('invites', {
      facilityId: p.facilityId, token: randomToken(), role: 'staff', email: fields.personalEmail,
      educatorId, label: displayName, used: false, createdAt: Date.now(), expiresAt: Date.now() + 7 * 86400_000,
    })
    const clean: any = {}
    for (const [k, value] of Object.entries(fields)) if (value !== undefined) clean[k] = value
    const userId = await getAuthUserId(ctx)
    await ctx.db.patch(p._id, { ...clean, status: 'submitted', submittedAt: Date.now(), consentAt: Date.now(), educatorId, loginInviteId, submittedByUserId: userId || undefined })
    await recordOwnerEvent(ctx, { facilityId: p.facilityId, actorId: userId || undefined, type: 'educator_onboarding_completed', summary: 'An educator completed their onboarding form. Review their submission in Educators.' })
  },
})
