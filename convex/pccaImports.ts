import { internalAction, internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { sealPrivateBlob } from './fileEncryption'
import { validateFileBytes } from './files'
import { recordOwnerEvent } from './notifications'

// Owner-supplied PCCA Daily Program Schedule (emailed by Kiran, Oct 27 2026),
// imported only into the explicitly identified facility. Repeat runs are no-ops.
const PCCA = 'md71dthy9rnqejp2msa0sjd0sx88whxq'
const SOURCE_KEY = 'pcca-daily-program-schedule-2026-10'
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const block = (startTime: string, endTime: string, title: string, detail: string, weekdays = WEEK) => ({ startTime, endTime, title, detail, weekdays })
const AGENDA = [
  block('07:30', '08:30', 'Welcome & Soft Arrivals', 'Quiet invitations, sensory exploration, puzzles, books, fine motor activities, independent play and social connections'),
  block('08:30', '09:00', 'Morning Circle & Little Leaders', 'Calendar, weather, attendance helper, classroom jobs, affirmations, sharing circle, leadership opportunities and confidence building'),
  block('09:00', '09:30', 'Structured Learning Block 1', 'Early literacy, phonics, numeracy, counting, patterning, problem solving and school readiness activities'),
  block('09:30', '10:00', 'Morning Snack & Ready for Life Skills', 'Healthy eating habits, table manners, serving independently, cleaning up, responsibility and self-help routines'),
  block('10:00', '10:30', 'Outdoor Adventure & Gross Motor Play', 'Nature exploration, obstacle courses, cooperative games, movement and physical development'),
  block('10:30', '11:15', 'World & Wonder Workshop: Global Citizens', 'Cultures, traditions, languages, music and world exploration', ['Mon']),
  block('10:30', '11:15', 'World & Wonder Workshop: STEM Lab', 'Science experiments, investigations and hands-on discovery', ['Tue']),
  block('10:30', '11:15', 'World & Wonder Workshop: Music, Movement & Yoga', 'Dance, rhythm, mindfulness, balance and body awareness', ['Wed']),
  block('10:30', '11:15', 'World & Wonder Workshop: Global Citizens & Cultural Exploration', 'Geography, celebrations, foods and traditions from around the world', ['Thu']),
  block('10:30', '11:15', 'World & Wonder Workshop: Building, Engineering & Cooperative Challenges', 'Construction, teamwork, creativity and problem-solving', ['Fri']),
  block('11:15', '12:00', 'Creative Studio', 'Art, painting, mixed media, creativity, self-expression and project work connected to weekly learning'),
  block('12:00', '12:30', 'Family-Style Lunch & Social Development', 'Conversation skills, independence, responsibility and community building'),
  block('12:30', '14:30', 'Rest & Recharge Time', 'Rest, relaxation, quiet activities and individualized comfort routines'),
  block('14:30', '15:00', 'Wake-Up Routine & Movement Break', 'Stretching, breathing exercises, movement games and active transitions'),
  block('15:00', '15:30', 'Inner Compass Circle', 'Emotional awareness, friendship skills, gratitude, positive communication, self-regulation and reflection'),
  block('15:30', '16:00', 'Afternoon Snack & Community Conversations', 'Healthy eating, social skills and relationship building'),
  block('16:00', '16:30', 'Structured Learning Block 2: Life Skills & Little Leaders', 'Practical life skills, teamwork, leadership opportunities, responsibility, confidence building, communication and independence'),
  block('16:30', '17:30', 'Outdoor Adventure & Exploration', 'Free play, sports, gardening, nature observation and cooperative outdoor experiences'),
  block('17:30', '18:00', 'Home Time & Family Connections', 'From 5:30 PM: reflection, storytelling, calm activities and parent communication'),
]

export const scheduleUploadUrl = internalMutation({
  args: {},
  handler: async ctx => await ctx.storage.generateUploadUrl(),
})

export const importDailySchedule = internalAction({
  args: { rawStorageId: v.id('_storage'), name: v.string(), mimeType: v.string() },
  handler: async (ctx, { rawStorageId, name, mimeType }): Promise<any> => {
    const raw = await ctx.storage.get(rawStorageId)
    if (!raw) throw new Error('Uploaded schedule not found.')
    const bytes = new Uint8Array(await raw.arrayBuffer())
    validateFileBytes(bytes, mimeType)
    const storageId = await ctx.storage.store(await sealPrivateBlob(new Blob([bytes], { type: mimeType })))
    await ctx.storage.delete(rawStorageId)
    try {
      return await ctx.runMutation(internal.pccaImports.saveDailySchedule, { storageId, name, mimeType, size: bytes.byteLength })
    } catch (error) {
      await ctx.storage.delete(storageId)
      throw error
    }
  },
})

export const saveDailySchedule = internalMutation({
  args: { storageId: v.id('_storage'), name: v.string(), mimeType: v.string(), size: v.number() },
  handler: async (ctx, { storageId, name, mimeType, size }) => {
    const facility = await ctx.db.get(PCCA as any) as any
    if (!facility || facility.slug !== 'pacific-coast-childcare-academy' || !facility.ownerUserId) throw new Error('Expected the Pacific Coast Childcare facility with its owner.')
    const plans = await ctx.db.query('parentPlans').withIndex('by_facility', q => q.eq('facilityId', facility._id)).collect()
    if (plans.some(p => p.sourceKey === SOURCE_KEY)) throw new Error('Daily schedule already imported; edit it in the app instead.')
    await ctx.db.insert('storedUploads', { storageId, facilityId: facility._id, uploadedBy: facility.ownerUserId, purpose: 'learning-plan', mimeType, size, createdAt: Date.now() })
    const now = Date.now()
    const id = await ctx.db.insert('parentPlans', { facilityId: facility._id, kind: 'schedule', title: 'Daily Program Schedule', period: 'week', startDate: '2026-10-30', endDate: '2027-08-31',
      overview: 'Our daily program for all classes, Monday to Friday. The World & Wonder Workshop changes each weekday.', activities: '', goals: '',
      attachments: [{ storageId, name, mimeType, size }], agenda: AGENDA, status: 'published', publishedAt: now, sourceKey: SOURCE_KEY, createdBy: facility.ownerUserId, createdAt: now, updatedAt: now })
    await recordOwnerEvent(ctx, { facilityId: facility._id, actorId: facility.ownerUserId, type: 'lesson-plan.published', summary: 'Added the owner-supplied Daily Program Schedule (photo and time blocks) for all classes, Oct 30 2026 to Aug 31 2027.' })
    return { id, blocks: AGENDA.length }
  },
})
