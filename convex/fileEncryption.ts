// A Convex storage ID can be used to construct a public storage URL. Private
// objects therefore contain ciphertext, even when a previously authorized user
// retained the ID. Only the authenticated HTTP service decrypts their contents.
const MAGIC = new TextEncoder().encode('MITTEN-PRIVATE-1\n')
const IV_LENGTH = 12

async function key() {
  const encoded=process.env.PRIVATE_FILES_KEY
  if(!encoded) throw new Error('Private uploads are temporarily unavailable. Contact Mitten support.')
  let bytes:Uint8Array
  try {bytes=Uint8Array.from(atob(encoded.trim()),c=>c.charCodeAt(0))} catch {throw new Error('Private file encryption is not configured.')}
  if(bytes.length!==32)throw new Error('Private file encryption is not configured.')
  return await crypto.subtle.importKey('raw',new Uint8Array(bytes).buffer,{name:'AES-GCM'},false,['encrypt','decrypt'])
}
export async function isPrivateBlob(blob:Blob) {
  const prefix=new Uint8Array(await blob.slice(0,MAGIC.length).arrayBuffer())
  return prefix.length===MAGIC.length && prefix.every((byte,index)=>byte===MAGIC[index])
}
export async function sealPrivateBlob(blob:Blob):Promise<Blob> {
  if(await isPrivateBlob(blob))return blob
  const cryptoKey=await key()
  const mime=blob.type||'application/octet-stream'
  const header=new TextEncoder().encode(mime+'\n')
  const bytes=new Uint8Array(await blob.arrayBuffer())
  const plain=new Uint8Array(header.length+bytes.length);plain.set(header);plain.set(bytes,header.length)
  const iv=crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:MAGIC},cryptoKey,plain)
  return new Blob([MAGIC,iv,encrypted],{type:'application/octet-stream'})
}
export async function openPrivateBlob(blob:Blob,fallbackMime='application/octet-stream'):Promise<Blob> {
  // Legacy objects are readable only behind the same authorization gate until
  // the bounded migration has copied, verified and revoked their old URLs.
  if(!await isPrivateBlob(blob))return blob
  const bytes=new Uint8Array(await blob.arrayBuffer())
  if(bytes.length<=MAGIC.length+IV_LENGTH)throw new Error('Private file is damaged.')
  const plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(MAGIC.length,MAGIC.length+IV_LENGTH),additionalData:MAGIC},await key(),bytes.slice(MAGIC.length+IV_LENGTH)))
  const separator=plain.indexOf(10)
  if(separator<1||separator>200)throw new Error('Private file is damaged.')
  const mime=new TextDecoder().decode(plain.slice(0,separator))
  return new Blob([plain.slice(separator+1)],{type:/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(mime)?mime:fallbackMime})
}
