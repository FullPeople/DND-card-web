import type {Raw} from '../core/model';

/** Cached input has the same top-level shape as a successful JSON response. */
export function rawCatalogBody(value:unknown):value is Raw{
 return !!value&&typeof value==='object'&&!Array.isArray(value);
}

export function rawCatalogCache(value:unknown):value is {body:Raw;revision:string}{
 if(!rawCatalogBody(value))return false;
 return rawCatalogBody(value.body)&&typeof value.revision==='string'&&value.revision.length>0;
}
