const encode=(s:string)=>new TextEncoder().encode(s);
export const safeFileName=(name:string)=>name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,100)||'角色';

function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
/** Uncompressed ZIP: PNG is already compressed. UTF-8 names, deterministic layout. */
export async function pngArchive(files:{name:string;blob:Blob}[]):Promise<Blob>{
  const chunks:BlobPart[]=[],directory:BlobPart[]=[];let offset=0,size=0;
  for(const file of files){
    const name=encode(file.name),data=new Uint8Array(await file.blob.arrayBuffer()),crc=crc32(data);
    const local=new Uint8Array(30+name.length),l=new DataView(local.buffer);
    l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,name.length,true);local.set(name,30);
    const central=new Uint8Array(46+name.length),c=new DataView(central.buffer);
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.set(name,46);
    chunks.push(local,data);directory.push(central);offset+=local.length+data.length;size+=central.length;
  }
  const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
  return new Blob([...chunks,...directory,end],{type:'application/zip'});
}

export async function sheetPdf(pages:Blob[]):Promise<Blob>{
  const images:{bytes:Uint8Array;width:number;height:number}[]=[];
  for(const blob of pages){
    const bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('无法生成 PDF 图像');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0);bitmap.close();
    const jpeg=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('PDF 图像生成失败')),'image/jpeg',0.94));
    images.push({bytes:new Uint8Array(await jpeg.arrayBuffer()),width:canvas.width,height:canvas.height});
  }
  return imagePdf(images);
}

export function imagePdf(images:{bytes:Uint8Array;width:number;height:number}[]):Blob{
  if(!images.length)throw Error('请选择至少一页');
  const parts:BlobPart[]=[],offsets:number[]=[0];let position=0;
  const append=(value:string|Uint8Array)=>{const bytes=typeof value==='string'?encode(value):value;parts.push(bytes as BlobPart);position+=bytes.length;};
  const object=(id:number,body:string|(()=>void))=>{offsets[id]=position;append(`${id} 0 obj\n`);if(typeof body==='string')append(body);else body();append('\nendobj\n');};
  append('%PDF-1.4\n');object(1,'<< /Type /Catalog /Pages 2 0 R >>');
  object(2,`<< /Type /Pages /Count ${images.length} /Kids [${images.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`);
  images.forEach((image,i)=>{const page=3+i*3,content=page+1,picture=page+2;object(page,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.276 841.89] /Resources << /XObject << /Im ${picture} 0 R >> >> /Contents ${content} 0 R >>`);const commands='q 595.276 0 0 841.89 0 0 cm /Im Do Q';object(content,`<< /Length ${encode(commands).length} >>\nstream\n${commands}\nendstream`);object(picture,()=>{append(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`);append(image.bytes);append('\nendstream');});});
  const start=position;append(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);for(const offset of offsets.slice(1))append(`${String(offset).padStart(10,'0')} 00000 n \n`);append(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`);
  return new Blob(parts,{type:'application/pdf'});
}
