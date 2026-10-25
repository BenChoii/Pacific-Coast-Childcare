import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const notificationTables = {
  ownerEvents: defineTable({
    facilityId: v.id('facilities'),
    actorId: v.optional(v.id('users')),
    type: v.string(),
    summary: v.string(),
    createdAt: v.number(),
    status: v.string(),
    attempts: v.number(),
    sentAt: v.optional(v.number()),
    error: v.optional(v.string()),
  }).index('by_facility', ['facilityId', 'createdAt']),
}
