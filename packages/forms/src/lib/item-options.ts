// The items of `ComboboxField` and `MultiSelectField`: plain values, which
// are their own label, `{ value, label }` objects, or `{ label, items }`
// groups of either.

/** An item whose value isn't its label. */
type ItemObject<V> = { value: V; label: string }

/** Items under a heading. */
type ItemGroup<T> = { label: string; items: readonly T[] }

/** An item of `items`, or of one of its groups. */
type ItemOption<T> = T extends ItemGroup<infer I> ? I : T

/** What picking an item stores: `item.value` for an object, else the item. */
type ItemValue<T> =
  T extends ItemGroup<infer I>
    ? ItemValue<I>
    : T extends ItemObject<infer V>
      ? V
      : T

/** Whether an item's value is a stored one, as `isItemEqualToValue` says. */
type ValueComparator = (itemValue: unknown, value: unknown) => boolean

function isItemObject(item: unknown): item is ItemObject<unknown> {
  return (
    typeof item === "object" &&
    item !== null &&
    "value" in item &&
    "label" in item
  )
}

/** What Base UI takes for a group: an object with an `items` array. */
function isItemGroup(item: unknown): item is ItemGroup<unknown> {
  return (
    typeof item === "object" &&
    item !== null &&
    Array.isArray((item as { items?: unknown }).items)
  )
}

function itemValue(item: unknown): unknown {
  return isItemObject(item) ? item.value : item
}

function itemLabel(item: unknown): string {
  return isItemObject(item) ? item.label : String(item)
}

/** A React key per value: `1` and `"1"` get two, an object gets its JSON. */
function valueKey(value: unknown): string {
  if (typeof value !== "object" || value === null) {
    return `${typeof value}:${String(value)}`
  }
  try {
    return `object:${JSON.stringify(value)}`
  } catch {
    return `object:${String(value)}`
  }
}

type ItemList<T> = {
  /**
   * `items` as Base UI takes them. It tells a grouped list by its first entry
   * alone, so once there is a group, each run of plain items beside one goes
   * under a group with no heading (`label: ""`).
   */
  readonly items: readonly T[]
  /** Every option, the grouped ones included, in order. */
  readonly options: readonly ItemOption<T>[]
  /** The first option of each `valueKey`, so finding a value is no scan. */
  readonly byKey: ReadonlyMap<string, ItemOption<T>>
}

function toItemList<T>(items: readonly T[]): ItemList<T> {
  const hasGroup = items.some(isItemGroup)
  const options: ItemOption<T>[] = []
  const groups: ItemGroup<unknown>[] = []
  let run: unknown[] | undefined
  for (const item of items) {
    if (isItemGroup(item)) {
      for (const option of item.items) {
        options.push(option as ItemOption<T>)
      }
      groups.push(item)
      run = undefined
    } else {
      options.push(item as ItemOption<T>)
      if (hasGroup && !run) {
        run = []
        groups.push({ items: run, label: "" })
      }
      run?.push(item)
    }
  }
  const byKey = new Map<string, ItemOption<T>>()
  for (const option of options) {
    const key = valueKey(itemValue(option))
    if (!byKey.has(key)) {
      byKey.set(key, option)
    }
  }
  return {
    byKey,
    items: hasGroup ? (groups as unknown as readonly T[]) : items,
    options,
  }
}

/**
 * `Object.is`, then `isItemEqualToValue`, which never sees an empty value.
 */
function isSameValue(
  a: unknown,
  b: unknown,
  isItemEqualToValue: ValueComparator | undefined
): boolean {
  if (Object.is(a, b)) {
    return true
  }
  if (a === null || a === undefined || b === null || b === undefined) {
    return false
  }
  return isItemEqualToValue?.(a, b) ?? false
}

/** The option whose value is `value`, if `items` has it. */
function findOption<T>(
  list: ItemList<T>,
  value: unknown,
  isItemEqualToValue: ValueComparator | undefined
): ItemOption<T> | undefined {
  const hit = list.byKey.get(valueKey(value))
  if (
    hit !== undefined &&
    isSameValue(itemValue(hit), value, isItemEqualToValue)
  ) {
    return hit
  }
  // A comparator can match values whose keys differ (`{ id }` against
  // `{ id, name }`).
  return list.options.find((option) =>
    isSameValue(itemValue(option), value, isItemEqualToValue)
  )
}

export type {
  ItemGroup,
  ItemList,
  ItemObject,
  ItemOption,
  ItemValue,
  ValueComparator,
}
export {
  findOption,
  isItemGroup,
  isItemObject,
  isSameValue,
  itemLabel,
  itemValue,
  toItemList,
  valueKey,
}
