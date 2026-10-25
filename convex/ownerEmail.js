import { internalAction } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'

// Reuse the existing Vercel mailbox without exposing its credentials to clients.
export const deliver = internalAction({
  args: { id: v.id('ownerEvents') },
  handler: async (ctx, { id }) => {
    const event = await ctx.runMutation(internal.notifications.claim, { id })
    if (!event) return
    try {
      if (!process.env.MITTEN_OWNER_EVENTS_KEY) throw new Error('Not configured')
      const response = await fetch('https://mitten.care/api/owner-event', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.MITTEN_OWNER_EVENTS_KEY}` },
        body: JSON.stringify(event), signal: AbortSignal.timeout(50_000),
      })
      if (!response.ok) throw new Error('Email relay failed')
      await ctx.runMutation(internal.notifications.finish, { id, ok: true })
    } catch {
      await ctx.runMutation(internal.notifications.finish, { id, ok: false, error: 'Owner email could not be delivered. Retry from Activity & alerts or contact support.' })
    }
  },
})
