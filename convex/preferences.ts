import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { requireFacility } from './lib'

export const get = query({args:{},handler:async ctx => {
  const uid = await getAuthUserId(ctx)
  const user = uid ? await ctx.db.get(uid) : null
  return {density:user?.preferences?.density || 'comfortable',textSize:user?.preferences?.textSize || 'standard'}
}})
export const save = mutation({args:{density:v.union(v.literal('comfortable'),v.literal('compact')),textSize:v.union(v.literal('standard'),v.literal('large'))},handler:async (ctx,args)=>{
  const {userId} = await requireFacility(ctx)
  await ctx.db.patch(userId,{preferences:args})
}})
export const setOwnerEmailMode = mutation({args:{mode:v.union(v.literal('all'),v.literal('important'),v.literal('off'))},handler:async(ctx,{mode})=>{
  const {user,facilityId,facility} = await requireFacility(ctx)
  if(user.role!=='admin' || facility.ownerUserId!==user._id) throw new Error('Only the daycare owner can change owner email delivery.')
  await ctx.db.patch(facilityId,{ownerEmailMode:mode})
}})
export const setTimezone=mutation({args:{timezone:v.string()},handler:async(ctx,{timezone})=>{
  const {user,facilityId}=await requireFacility(ctx)
  if(user.role!=='admin') throw new Error('Only a director can change the daycare timezone.')
  try {new Intl.DateTimeFormat('en-CA',{timeZone:timezone}).format(new Date())} catch {throw new Error('Choose a valid timezone.')}
  await ctx.db.patch(facilityId,{timezone})
}})
