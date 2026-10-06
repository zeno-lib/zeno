//#region src/lib/action-result.d.ts
type ActionError = {
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly formErrors: readonly string[];
};
type ActionResult<TData> = {
  readonly ok: true;
  readonly data: TData;
} | {
  readonly ok: false;
  readonly error: ActionError;
};
type ActionIssue = {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey | {
    readonly key: PropertyKey;
  }> | undefined;
};
declare function toFieldName(path: ActionIssue["path"]): string;
declare function toActionError(issues: readonly ActionIssue[]): ActionError;
//#endregion
export { type ActionError, type ActionIssue, type ActionResult, toActionError, toFieldName };