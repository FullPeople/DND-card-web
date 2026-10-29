export interface CorpusInput {url:string;sha256:string}
export interface CorpusSource extends CorpusInput {repository:string;revision:string;path:string;gitBlobSha1:string;sourceBytes:number;retrievalUrl:string}
export interface CorpusMapping {schemaVersion:1;inputSetSha256:string;rows:CorpusSource[]}
export interface CorpusStats {reusedInputs:number;downloadedInputs:number}
export type CorpusFetch=(url:string,options:RequestInit)=>Promise<Response>;
export const INPUT_COUNT:229;
export const INPUT_SET_SHA256:string;
export const MAX_FILE_BYTES:number;
export const SOURCE_REVISIONS:Readonly<Record<string,string>>;
export function readMapping():CorpusMapping;
export function validateInputs(inputs:unknown):CorpusInput[];
export function validateMapping(mapping:unknown,inputs:CorpusInput[]):CorpusSource[];
export function fetchVerifiedBody(row:CorpusSource,fetcher?:CorpusFetch):Promise<Buffer>;
export function readVerifiedCache(row:CorpusSource,caches:string[]):Promise<Buffer|undefined>;
export function materializeRows(rows:CorpusSource[],options:{output:string;caches:string[];fetcher?:CorpusFetch}):Promise<CorpusStats>;
export function buildReceipt(input:CorpusStats&{reportSha256:string;mappingSha256:string}):{schemaVersion:1;verified:true;inputCount:229;inputSetSha256:string;reportSha256:string;mappingSha256:string;sourceRevisions:Record<string,string>;reusedInputs:number;downloadedInputs:number;sourceBodiesPublished:false};
export function parseArgs(args:string[]):{report:string;output:string;receipt:string;caches:string[]};
