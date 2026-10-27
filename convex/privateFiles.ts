import { internalQuery } from './_generated/server'
import { v } from 'convex/values'
import { childBelongsToParent, requireFacility } from './lib'

async function fileInfo(ctx: any, storageId: any, name: string, fallback = 'application/octet-stream') {
  const upload = await ctx.db.query('storedUploads').withIndex('by_storage', (q: any) => q.eq('storageId', storageId)).first()
  const metadata = ctx.db.system ? await ctx.db.system.get(storageId) : null
  const mimeType = upload?.mimeType || metadata?.contentType || fallback
  const extension = ({ 'image/jpeg':'.jpg', 'image/png':'.png', 'image/webp':'.webp', 'image/gif':'.gif', 'application/pdf':'.pdf' } as Record<string,string>)[mimeType] || ''
  return { name: /\.[a-z0-9]{2,5}$/i.test(name) ? name : name + extension, mimeType }
}

// Every private request authenticates again. Storage URLs stay server-side,
// including for child/classroom images, so release/suspension stops new reads.
export const authorizeDownload = internalQuery({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, { storageId }) => {
    const { user, userId, facilityId } = await requireFacility(ctx)
    const staff = ['admin', 'staff'].includes(user.role || '')
    if (user.role === 'admin') {
      const books = await ctx.db.query('bookkeepingDocs').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
      const book = books.find(row => row.storageId === storageId)
      if (book) return await fileInfo(ctx, storageId, book.fileName || 'document', book.mimeType)
      const profiles = await ctx.db.query('employeeProfiles').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
      for (const profile of profiles) {
        const document = profile.documents?.find(row => row.storageId === storageId)
        if (document) return await fileInfo(ctx, storageId, document.name || 'employee-document')
      }
    }
    const documents = await ctx.db.query('childDocuments').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
    const document = documents.find(row => row.storageId === storageId)
    if (document) {
      const child = await ctx.db.get(document.childId)
      if (!child || child.facilityId !== facilityId || (user.role !== 'admin' && !childBelongsToParent(child, userId))) throw new Error('Document not available.')
      return await fileInfo(ctx, storageId, document.label)
    }
    const children = await ctx.db.query('children').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
    const avatars = children.filter(child => child.imageId === storageId)
    if (avatars.some(child => staff || childBelongsToParent(child, userId))) return await fileInfo(ctx, storageId, 'child-photo')
    const mine = children.filter(child => childBelongsToParent(child, userId))
    const plans = await ctx.db.query('parentPlans').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
    for (const plan of plans) {
      const attachment = plan.attachments?.find(file => file.storageId === storageId)
      if (!attachment) continue
      const visible = user.role === 'admin' || (plan.status === 'published' && (user.role === 'staff' || (user.role === 'parent' && mine.some(child => !plan.room || (child.room !== 'Unassigned' && child.room === plan.room)))))
      if (!visible) continue
      const upload = await ctx.db.query('storedUploads').withIndex('by_storage', q => q.eq('storageId', storageId)).first()
      if (!upload || upload.facilityId !== facilityId || upload.purpose !== 'learning-plan') continue
      return await fileInfo(ctx, storageId, attachment.name, attachment.mimeType)
    }
    const photos = await ctx.db.query('photos').withIndex('by_image', q => q.eq('imageId', storageId)).collect()
    for (const photo of photos.filter(row => row.facilityId === facilityId)) {
      const shared = photo.audience === 'family'
        ? !!photo.childId && mine.some(child => child._id === photo.childId)
        : [undefined, 'all'].includes(photo.audience) && mine.some(child => !photo.room || photo.room === 'All rooms' || (child.room !== 'Unassigned' && child.room === photo.room))
      if (staff || (user.role === 'parent' && shared)) return await fileInfo(ctx, storageId, 'classroom-photo')
    }
    throw new Error('File not available or your daycare access has ended.')
  },
})
