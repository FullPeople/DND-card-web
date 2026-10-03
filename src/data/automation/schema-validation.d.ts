export interface SchemaError {instancePath:string;message?:string}
export interface SchemaValidator {(value:unknown):boolean;errors:SchemaError[]|null}
export const envelopeSchema:SchemaValidator,overlaysSchema:SchemaValidator,recordSchema:SchemaValidator;
