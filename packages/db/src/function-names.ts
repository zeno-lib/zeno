// The naming convention `functionPolicies` writes policies against and
// `selectFunctionPermissions` calls: `<prefix>_<operation>_<table>`. Shared so
// the two cannot drift apart.

export const FUNCTION_POLICY_OPERATIONS = [
  "select",
  "insert",
  "update",
  "delete",
] as const

export type FunctionPolicyOperation =
  (typeof FUNCTION_POLICY_OPERATIONS)[number]

export const DEFAULT_FUNCTION_PREFIX = "can"

export const functionPolicyName = (
  prefix: string,
  operation: FunctionPolicyOperation,
  tableName: string
) => `${prefix}_${operation}_${tableName}`
