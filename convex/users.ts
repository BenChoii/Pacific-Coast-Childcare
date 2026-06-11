import { query } from './_generated/server'
import { getAuthUserId } from '@convex-dev/auth/server'

// The currently signed-in user (or null in demo / signed-out mode).
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) return null
    const user = await ctx.db.get(userId)
    if (!user) return null
    return {
      id: user._id,
      name: user.name ?? '',
      email: user.email ?? '',
      role: user.role ?? 'parent',
      facilityId: user.facilityId ?? null,
      hasFacility: !!user.facilityId,
      imageUrl: user.imageId ? await ctx.storage.getUrl(user.imageId) : null,
    }
  },
})
