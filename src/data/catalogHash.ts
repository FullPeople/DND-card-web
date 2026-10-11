/** Keep the existing canonical JSON revision identical on the worker and fallback paths. */
export async function hashCatalogJson(body:unknown):Promise<string>{
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(body)));
 return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
