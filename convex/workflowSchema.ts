import { defineTable } from 'convex/server'
import { v } from 'convex/values'

// Additive workflow tables. Existing fields remain readable during migration.
export const workflowTables = {
  attendanceEvents: defineTable({
    facilityId: v.id('facilities'), childId: v.id('children'), date: v.string(),
    status: v.string(), occurredAt: v.number(), displayTime: v.string(), byUserId: v.optional(v.id('users')),
  }).index('by_facility_date', ['facilityId', 'date']).index('by_child_date', ['childId', 'date']),
  conversationReads: defineTable({
    facilityId: v.id('facilities'), conversationId: v.id('conversations'), userId: v.id('users'), lastReadAt: v.number(), lastReadSequence: v.optional(v.number()),
  }).index('by_conversation_user', ['conversationId', 'userId']),
  photoReactions: defineTable({
    facilityId: v.id('facilities'), photoId: v.id('photos'), userId: v.id('users'), createdAt: v.number(),
  }).index('by_photo', ['photoId']).index('by_photo_user', ['photoId', 'userId']),
  storedUploads: defineTable({
    facilityId: v.id('facilities'), storageId: v.id('_storage'), uploadedBy: v.optional(v.id('users')),
    purpose: v.string(), mimeType: v.string(), size: v.number(), createdAt: v.number(), onboardingProfileId: v.optional(v.id('employeeProfiles')),
  }).index('by_storage', ['storageId']).index('by_facility', ['facilityId']),
  childDocuments: defineTable({
    facilityId: v.id('facilities'), childId: v.id('children'), label: v.string(),
    status: v.union(v.literal('requested'), v.literal('received'), v.literal('reviewed')),
    storageId: v.optional(v.id('_storage')), notes: v.optional(v.string()), createdBy: v.id('users'),
    createdAt: v.number(), updatedAt: v.number(), reviewedAt: v.optional(v.number()), reviewedBy: v.optional(v.id('users')),
  }).index('by_child', ['childId']).index('by_facility', ['facilityId']).index('by_storage',['storageId']),
  incidents: defineTable({
    facilityId: v.id('facilities'), childId: v.id('children'), childName: v.string(), occurredAt: v.number(),
    date: v.string(), description: v.string(), actionTaken: v.string(), followUp: v.optional(v.string()),
    status: v.union(v.literal('draft'), v.literal('shared')), createdBy: v.optional(v.id('users')),
    createdAt: v.number(), updatedAt: v.number(), sharedAt: v.optional(v.number()),
    acknowledgements: v.optional(v.array(v.object({ userId: v.id('users'), at: v.number() }))),
  }).index('by_facility', ['facilityId']).index('by_child', ['childId']),
}
