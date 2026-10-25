import { useEffect, useMemo, useState } from 'react'
import { useAuthToken } from '@convex-dev/auth/react'

// Object URLs live only in this mounted view. Revocation/account changes remove
// them; the persistent storage object is encrypted and never an image URL.
export function useProtectedMedia(rows) {
  const token=useAuthToken()
  const ids=[...new Set(rows.filter(row=>row.imageId&&!row.imageUrl).map(row=>row.imageId))]
  const key=ids.join(',')
  const [media,setMedia]=useState({token:null,key:'',urls:{},errors:{}})
  const [retry,setRetry]=useState(0)
  useEffect(()=>{
    const urls={},errors={},controller=new AbortController();let current=true
    if(!token||!key){setMedia({token,key,urls,errors});return}
    const base=import.meta.env.VITE_CONVEX_URL?.replace(/\.cloud\/?$/,'.site')
    const load=async()=>{
      // Bound concurrent image decodes/downloads on parents' phones.
      for(let offset=0;offset<ids.length;offset+=4){
        if(!current)break
        await Promise.all(ids.slice(offset,offset+4).map(async id=>{
          try {
            const response=await fetch(`${base}/files/private?storageId=${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal})
            if(!response.ok)throw new Error('Image unavailable')
            const blob=await response.blob()
            if(!blob.type.startsWith('image/'))throw new Error('Image unavailable')
            const url=URL.createObjectURL(blob)
            if(current)urls[id]=url;else URL.revokeObjectURL(url)
          } catch {if(current)errors[id]=true}
        }))
        if(current)setMedia({token,key,urls:{...urls},errors:{...errors}})
      }
    }
    load()
    return()=>{current=false;controller.abort();Object.values(urls).forEach(url=>URL.revokeObjectURL(url))}
  },[token,key,retry])
  return useMemo(()=>rows.map(row=>row.imageId&&!row.imageUrl?{...row,imageUrl:media.token===token&&media.key===key?media.urls[row.imageId]||null:null,imageLoading:!!token&&(media.key!==key||(!media.urls[row.imageId]&&!media.errors[row.imageId])),imageError:!!media.errors[row.imageId],retryImage:()=>setRetry(value=>value+1)}:row),[rows,media,token,key])
}
