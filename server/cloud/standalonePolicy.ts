/** Only the previously verified website account/card APIs are promoted. */
export function standaloneCloudPath(pathname:string){
 return pathname==='/api/'||/^\/api\/(?:auth\/qq\/(?:login|callback)|session|health|policy|logout|slots|changes|cards(?:\/[A-Za-z0-9-]{6,36})?)$/.test(pathname);
}
