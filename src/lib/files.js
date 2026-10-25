import { useAuthToken } from '@convex-dev/auth/react'

export async function fileToBase64(file) {
  return new Promise((resolve,reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(new Error('Could not read this file.'))
    reader.readAsDataURL(file)
  })
}

export async function prepareImage(file) {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error('Choose a JPEG, PNG, WebP or GIF image.')
  if (file.size > 20*1024*1024) throw new Error('Choose an image smaller than 20 MB.')
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1,1600/Math.max(bitmap.width,bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1,Math.round(bitmap.width*scale)); canvas.height = Math.max(1,Math.round(bitmap.height*scale))
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height)
    const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/webp',0.85))
    if (!blob) throw new Error('Could not prepare this image.')
    return blob
  } finally { bitmap.close() }
}

export function usePrivateDownload() {
  const token = useAuthToken()
  return async (storageId, filename='document') => {
    if (!token) throw new Error('Please sign in again to download this document.')
    const base = import.meta.env.VITE_CONVEX_URL?.replace(/\.cloud\/?$/,'.site')
    if (!base) throw new Error('Document service unavailable.')
    const response = await fetch(`${base}/files/private?storageId=${encodeURIComponent(storageId)}`,{headers:{Authorization:`Bearer ${token}`}})
    if (!response.ok) throw new Error('This document is unavailable or your access has ended.')
    const blob = await response.blob(); const url = URL.createObjectURL(blob)
    const extension={'application/pdf':'.pdf','image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif'}[blob.type]||''
    const link = document.createElement('a'); link.href=url; link.download=/\.[a-z0-9]{2,6}$/i.test(filename)?filename:filename+extension; link.click()
    setTimeout(()=>URL.revokeObjectURL(url),30_000)
  }
}
