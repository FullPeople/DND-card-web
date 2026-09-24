/** Decode locally and store a bounded raster rather than the original upload. */
export async function compressPortrait(file:File):Promise<string>{
 if(!/^image\/(png|jpeg|webp|gif|avif|bmp)$/.test(file.type))throw new Error('请选择 PNG、JPEG、WebP、GIF、AVIF 或 BMP 图片');
 const image=await createImageBitmap(file);try{
  let edge=1280,quality=.86,blob:Blob|null=null;
  for(let i=0;i<8;i++){
   const factor=Math.min(1,edge/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*factor));canvas.height=Math.max(1,Math.round(image.height*factor));canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);
   blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));if(blob&&blob.size<=450000)break;quality=Math.max(.5,quality-.1);edge=Math.round(edge*.8);
  }
  if(!blob||blob.size>450000)throw new Error('图片压缩失败');
  return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob!);});
 }finally{image.close();}
}
