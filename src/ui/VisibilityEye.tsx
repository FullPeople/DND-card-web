export function VisibilityEye({hidden,className=''}:{hidden:boolean;className?:string}){
 return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{hidden&&<path d="M3 3 21 21"/>}</svg>;
}
