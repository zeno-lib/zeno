//#region src/lib/validation-error.d.ts
type FieldMessage = string | readonly string[];
declare class ValidationError extends Error {
  readonly fields: Readonly<Record<string, FieldMessage>>;
  readonly formError?: string;
  constructor(fields: Readonly<Record<string, FieldMessage>>, options?: {
    formError?: string;
    message?: string;
  });
}
//#endregion
export { type FieldMessage, ValidationError };