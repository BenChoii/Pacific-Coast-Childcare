import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const financeTables = {
  privateFileRotations: defineTable({facilityId:v.id('facilities'),sourceId:v.id('_storage'),replacementId:v.optional(v.id('_storage')),status:v.string(),createdAt:v.number(),updatedAt:v.number(),error:v.optional(v.string()),claimToken:v.optional(v.string())}).index('by_source',['sourceId']).index('by_replacement',['replacementId']).index('by_status',['status']),
  paymentAttempts: defineTable({
    facilityId: v.id('facilities'), invoiceId: v.id('invoices'), invId: v.string(), amountCents: v.number(), currency: v.string(),
    status: v.string(), createdAt: v.number(), updatedAt: v.number(), stripeSessionId: v.optional(v.string()),
    stripeAccountId: v.optional(v.string()), checkoutUrl: v.optional(v.string()), paidAt: v.optional(v.number()),
  }).index('by_invoice', ['invoiceId', 'createdAt']).index('by_session', ['stripeSessionId']),
  stripeWebhookEvents: defineTable({eventId: v.string(), type: v.string(), createdAt: v.number()}).index('by_event', ['eventId']),
  clockSessions: defineTable({facilityId: v.id('facilities'), educatorId: v.id('educators'), startedAt: v.number(), endedAt: v.optional(v.number())})
    .index('by_facility', ['facilityId', 'startedAt']).index('by_educator', ['educatorId', 'startedAt']),
}
