//#region src/lib/schema-required.d.ts
type PathPart = PropertyKey | {
  readonly key: PropertyKey;
};
type StandardIssue = {
  readonly path?: readonly PathPart[];
  readonly expected?: unknown;
};
type StandardSchemaLike = {
  readonly "~standard": {
    readonly validate: (value: unknown) => {
      readonly value: unknown;
    } | {
      readonly issues: readonly StandardIssue[];
    } | Promise<unknown>;
  };
};
/**
 * Normalise a field name (`members[3].name` or `members.3.name`) to the key
 * `getRequiredPaths` records (`members[0].name`).
 */
declare function toRequiredPathKey(name: string): string;
declare function getRequiredPaths(schema: StandardSchemaLike): Set<string>;
//#endregion
export { type StandardSchemaLike, getRequiredPaths, toRequiredPathKey };