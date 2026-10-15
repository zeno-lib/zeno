/**
 * The props a component renders with: `props` over `defaults`. A prop passed
 * as `undefined` keeps its default, as a destructuring default would.
 */
export function withDefaultProps<P extends object>(
  defaults: Partial<P> | undefined,
  props: P
): P {
  if (defaults === undefined) {
    return props
  }
  const merged: Record<string, unknown> = { ...defaults }
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) {
      merged[key] = value
    }
  }
  return merged as P
}
