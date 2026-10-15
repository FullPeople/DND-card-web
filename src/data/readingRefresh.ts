/** An explicit update applies once to its selected data, not every later navigation. */
export class ReadingRefresh{
 private version=0;
 private requests=new Map<string,number>();
 request(keys:readonly string[]){
  const version=++this.version;this.requests=new Map(keys.map(key=>[key,version]));return version;
 }
 pending(key:string){return this.requests.get(key);}
 complete(key:string,version:number|undefined){
  if(version!==undefined&&this.requests.get(key)===version)this.requests.delete(key);
 }
}
