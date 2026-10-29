import type {Buffer} from 'node:buffer';

export interface Destinations {output:string;receipt:string}
export interface SourceReader {
 read():PromiseLike<{done:boolean;value?:Uint8Array}>;
 cancel?():unknown;
}
export interface SourceResponse {
 ok:boolean;
 redirected:boolean;
 url?:string;
 headers:{get(name:string):string|null};
 body:{getReader():SourceReader}|null;
}
export type SourceFetcher=(url:string,options:{redirect:'error';signal:AbortSignal})=>SourceResponse|PromiseLike<SourceResponse>;
export interface RawBookProof {rawBytes:number;rawSha256:string;gitBlobSha1:string}
export interface SideSourceReceipt extends RawBookProof {
 schemaVersion:1;
 kind:'optional-class-list-semantic-side-source';
 verified:true;
 repository:string;
 revision:string;
 path:string;
 retrievalUrl:string;
 semanticSideSourceOnly:true;
 runtimeInputExtension:false;
 sourceBodiesPublished:false;
}
export const SOURCE:Readonly<RawBookProof&{repository:string;revision:string;path:string;retrievalUrl:string}>;
export const DEADLINE_MS:60000;
export function parseArgs(args:readonly string[]):Destinations;
export function validateDestinations(options:Destinations):Promise<Destinations>;
export function validateRawBook(bytes:Buffer):RawBookProof;
export function fetchVerifiedBook(fetcher?:SourceFetcher):Promise<Buffer>;
export function run(args:readonly string[],fetcher?:SourceFetcher):Promise<SideSourceReceipt>;
