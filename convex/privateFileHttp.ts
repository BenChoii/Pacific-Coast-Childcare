import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import { openPrivateBlob } from './fileEncryption'

export function registerPrivateFiles(http: any) {
  const cors = (request: Request) => ({
    'Access-Control-Allow-Origin': request.headers.get('Origin') || 'https://mitten.care',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin', 'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff',
  })
  http.route({path:'/files/private', method:'OPTIONS', handler:httpAction(async (_ctx, request) => new Response(null,{status:204,headers:cors(request)}))})
  http.route({path:'/files/private', method:'GET', handler:httpAction(async (ctx, request) => {
    const headers = cors(request)
    try {
      if (!request.headers.get('Authorization')?.startsWith('Bearer ')) return new Response('Sign in to download.',{status:401,headers})
      const storageId = new URL(request.url).searchParams.get('storageId')
      if (!storageId) return new Response('Document required.',{status:400,headers})
      const metadata = await ctx.runQuery(internal.privateFiles.authorizeDownload,{storageId:storageId as any})
      const stored = await ctx.storage.get(storageId as any)
      const blob = stored ? await openPrivateBlob(stored,metadata.mimeType) : null
      if (!blob) return new Response('Document unavailable.',{status:404,headers})
      const filename = metadata.name.replace(/[\r\n"\\/]/g,'_').slice(0,120) || 'document'
      return new Response(blob,{status:200,headers:{...headers,'Content-Type':blob.type || metadata.mimeType,'Content-Disposition':`attachment; filename="${filename}"`}})
    } catch { return new Response('You do not have access to this document.',{status:403,headers}) }
  })})
}
