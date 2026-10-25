import { action, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import { api, internal } from './_generated/api'
import { requireFacility } from './lib'
import { assertOwnedUpload } from './files'
import { openPrivateBlob } from './fileEncryption'

// Free OpenRouter models, tried in order (availability shifts over time, so we
// fall through to the next if one is unavailable). Override with OPENROUTER_MODEL.
const FREE_MODELS = [
  'openrouter/free', // OpenRouter's auto-router across whatever free models are live
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-4-31b-it:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'openai/gpt-oss-120b:free',
  'z-ai/glm-4.5-air:free',
]

export async function chat(messages: any[], maxTokens = 220) {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return { configured: false }
  const models = [process.env.OPENROUTER_MODEL, ...FREE_MODELS].filter(Boolean)
  let lastErr = ''
  for (const model of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://mitten.care',
          'X-Title': 'Mitten',
        },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7 }),
      })
      const json = await res.json()
      if (!res.ok) { lastErr = json?.error?.message || `status ${res.status}`; continue }
      const text = json?.choices?.[0]?.message?.content?.trim()
      if (text) return { configured: true, text }
    } catch (e) {
      lastErr = String(e)
    }
  }
  return { configured: true, error: lastErr || 'No response' }
}

// ── Paper intake form OCR ───────────────────────────────────────────────────
// Free vision-capable models, tried in order (same fallback philosophy as chat).
const VISION_MODELS = [
  'qwen/qwen2.5-vl-72b-instruct:free',
  'google/gemma-3-27b-it:free',
  'meta-llama/llama-3.2-11b-vision-instruct:free',
  'openrouter/free',
]

async function visionChat(imageUrl: string, prompt: string, maxTokens = 600) {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return { configured: false }
  let lastErr = ''
  for (const model of VISION_MODELS) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://mitten.care',
          'X-Title': 'Mitten',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageUrl } },
              ],
            },
          ],
          max_tokens: maxTokens,
          temperature: 0.1,
        }),
      })
      const json = await res.json()
      if (!res.ok) { lastErr = json?.error?.message || `status ${res.status}`; continue }
      const text = json?.choices?.[0]?.message?.content?.trim()
      if (text) return { configured: true, text }
    } catch (e) {
      lastErr = String(e)
    }
  }
  return { configured: true, error: lastErr || 'No response' }
}

// Read a photographed paper intake form → structured enrolment fields.
// Returns { fields } for the review screen; never auto-creates records — a
// human confirms (and can correct) everything the model read.
export const scanIntake = action({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, { storageId }) => {
    await ctx.runQuery(internal.users.actionMembership, { staffOnly: true })
    await ctx.runQuery(internal.ai.authorizeIntake,{storageId})
    const stored=await ctx.storage.get(storageId)
    const blob=stored?await openPrivateBlob(stored):null
    if(!blob) return {configured:true,error:'Could not read the uploaded image.'}
    const bytes=new Uint8Array(await blob.arrayBuffer())
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192))
    const url=`data:${blob.type};base64,${btoa(binary)}`
    const res = await visionChat(
      url,
      `This is a photo of a childcare/daycare enrolment or intake form (possibly handwritten). Extract what you can read and return ONLY a JSON object — no prose, no markdown fence — with exactly these keys (use "" when unreadable or absent):
{"childFirst":"","childLast":"","childAge":"","childDob":"","parentName":"","parentEmail":"","parentPhone":"","emergencyName":"","emergencyPhone":"","allergies":"","notes":""}
"childAge" like "3 yrs" if an age or birthdate is present; "allergies" as a comma-separated string; "notes" = any medical/dietary/custody notes worth a director's attention, max 140 chars.`,
      500,
    )
    if (!res.configured) return { configured: false }
    if (res.error || !res.text) return { configured: true, error: 'The free AI models are busy — try again, or type the form in manually.' }
    try {
      const match = res.text.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('no json')
      const raw = JSON.parse(match[0])
      const s = (x: any) => (typeof x === 'string' ? x.trim() : '')
      return {
        configured: true,
        fields: {
          childFirst: s(raw.childFirst), childLast: s(raw.childLast),
          childAge: s(raw.childAge), childDob: s(raw.childDob),
          parentName: s(raw.parentName), parentEmail: s(raw.parentEmail), parentPhone: s(raw.parentPhone),
          emergencyName: s(raw.emergencyName), emergencyPhone: s(raw.emergencyPhone),
          allergies: s(raw.allergies), notes: s(raw.notes),
        },
      }
    } catch {
      return { configured: true, error: 'Couldn’t make sense of the scan — try a clearer photo, or type it in manually.' }
    }
  },
})

// Educator: turn a child + activity type + rough keywords into a warm,
// parent-ready note in one tap.
export const draftNote = action({
  args: { childName: v.string(), kind: v.string(), keywords: v.optional(v.string()) },
  handler: async (ctx, { childName, kind, keywords }) => {
    await ctx.runQuery(internal.users.actionMembership, { staffOnly: true })
    const first = (childName || 'the child').split(' ')[0]
    if(!keywords?.trim())return {configured:true,error:'Add the actual facts or observations before asking for a draft.'}
    if(keywords.length>5000||childName.length>200||kind.length>50)throw new Error('Please shorten the notes.')
    return await chat([
      {
        role: 'system',
        content:
          'You are a warm, professional early-childhood educator writing a short daily-report note to a parent about their child. Keep it to 1–2 friendly, specific sentences. At most one emoji. Never invent medical details, injuries, or facts you were not given.',
      },
      {
        role: 'user',
        content: `Child's first name: ${first}\nActivity type: ${kind}\nEducator's rough notes/keywords: ${keywords}\n\nWrite the note to the parent.`,
      },
    ], 160)
  },
})

// Parent: a warm "day in a glance" recap built from the day's activity log.
export const dailyRecap = action({
  args: {childId:v.optional(v.id('children')),date:v.optional(v.string()),childName:v.optional(v.string()),activities:v.optional(v.string())},
  handler: async (ctx, {childId,date}):Promise<any> => {
    await ctx.runQuery(internal.users.actionMembership, {})
    if(!childId)throw new Error('Select the child and date for this summary.')
    const kids=await ctx.runQuery(api.children.list,{date})
    const child=kids.find((c:any)=>c.id===childId)
    if(!child)throw new Error('Child not available.')
    const records=await ctx.runQuery(api.activities.list,{childId,date,limit:100})
    const activities=records.map((entry:any)=>`${entry.time} · ${entry.title}: ${entry.detail}`).join('\n').slice(0,16000)
    const first=child.first
    if (!activities.trim()) {
      return { configured: true, text: `No activities have been recorded for ${first} on this date. Check the daily log for updates.` }
    }
    return await chat([
      {
        role: 'system',
        content:
          "You write a warm, upbeat 'day in a glance' recap for a parent, summarizing their child's day at daycare from the educators' activity log. 2–3 sentences, address the parent's child by first name, be specific and reassuring. At most one emoji. Don't invent anything not in the log.",
      },
      {
        role: 'user',
        content: `Child's first name: ${first}\nToday's logged activities:\n${activities}\n\nWrite the recap.`,
      },
    ], 220)
  },
})

export const authorizeIntake=internalQuery({args:{storageId:v.id('_storage')},handler:async(ctx,{storageId})=>{const {facilityId,userId,user}=await requireFacility(ctx);if(!['admin','staff'].includes(user.role||''))throw new Error('Educator access required.');await assertOwnedUpload(ctx,storageId,facilityId,userId,['intake']);return true}})
