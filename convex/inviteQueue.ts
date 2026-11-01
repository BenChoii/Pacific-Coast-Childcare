import { internal } from './_generated/api'

export const testAddress = (value: string) => /@[^@]*\.(invalid|test)$/i.test(value) || /@example\.(com|org|net)$/i.test(value)

// Queue the invitation email. Callers have already validated the invite and its
// address; test addresses are recorded but never handed to the mail relay.
export async function queueInviteEmail(ctx: any, inviteId: any, email: string) {
  if (testAddress(email)) { await ctx.db.patch(inviteId, { emailStatus: 'skipped', emailAttempts: 0 }); return false }
  await ctx.db.patch(inviteId, { emailStatus: 'pending', emailAttempts: 0, emailSendingAt: undefined, emailDeliveryToken: undefined })
  await ctx.scheduler.runAfter(0, internal.inviteEmails.deliver, { id: inviteId })
  return true
}

