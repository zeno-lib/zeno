//#region src/lib/schema-defaults.d.ts
type SchemaNode = {
  readonly _zod?: {
    readonly def?: SchemaDef;
  };
};
type SchemaDef = {
  readonly type?: string;
  readonly innerType?: SchemaNode;
  readonly shape?: Record<string, SchemaNode>;
  readonly in?: SchemaNode;
  readonly defaultValue?: unknown;
};
declare function extractZodDefaults(schema: SchemaNode): Record<string, unknown>;
declare function deepMergeDefaults(schemaDefaults: Record<string, unknown>, userDefaults: Record<string, unknown> | undefined): Record<string, unknown>;
//#endregion
export { deepMergeDefaults, extractZodDefaults };