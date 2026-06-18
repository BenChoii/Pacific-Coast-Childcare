import { action } from './_generated/server'
import { v } from 'convex/values'

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

export async function chat(messages, maxTokens = 220) {
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
    const url = await ctx.storage.getUrl(storageId)
    if (!url) return { configured: true, error: 'Could not read the uploaded image.' }
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
  handler: async (_ctx, { childName, kind, keywords }) => {
    const first = (childName || 'the child').split(' ')[0]
    return await chat([
      {
        role: 'system',
        content:
          'You are a warm, professional early-childhood educator writing a short daily-report note to a parent about their child. Keep it to 1–2 friendly, specific sentences. At most one emoji. Never invent medical details, injuries, or facts you were not given.',
      },
      {
        role: 'user',
        content: `Child's first name: ${first}\nActivity type: ${kind}\nEducator's rough notes/keywords: ${keywords || '(none — write a pleasant generic note for this activity type)'}\n\nWrite the note to the parent.`,
      },
    ], 160)
  },
})

// Parent: a warm "day in a glance" recap built from the day's activity log.
export const dailyRecap = action({
  args: { childName: v.string(), activities: v.string() },
  handler: async (_ctx, { childName, activities }) => {
    const first = (childName || 'your child').split(' ')[0]
    if (!activities.trim()) {
      return { configured: true, text: `${first} is having a lovely day! Check back soon — the educators will post updates as the day unfolds. 💙` }
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
