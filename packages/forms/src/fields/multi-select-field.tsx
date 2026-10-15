"use client"

import { describedBy } from "@zeno-lib/forms/lib/aria"
import { useFieldContext } from "@zeno-lib/forms/lib/contexts"
import { useIsFormDisabled } from "@zeno-lib/forms/lib/form-disabled"
import {
  useHideFieldErrors,
  useIsFieldRequired,
  useIsFieldRequiredBySchema,
  useIsInvalid,
} from "@zeno-lib/forms/lib/use-is-invalid"
import { XIcon } from "lucide-react"
import { type ReactNode, useId } from "react"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { RequiredIndicator } from "../lib/required-indicator"

type MultiSelectItemObject<V> = { value: V; label: string }

/** Items under a heading. */
type MultiSelectItemGroup<T> = { label: string; items: readonly T[] }

/** An item of `items`, or of one of its groups. */
type MultiSelectOption<T> = T extends MultiSelectItemGroup<infer I> ? I : T

/** The value stored per selected item: `item.value` for objects, else the item. */
type MultiSelectValue<T> =
  T extends MultiSelectItemGroup<infer I>
    ? MultiSelectValue<I>
    : T extends MultiSelectItemObject<infer V>
      ? V
      : T

type MultiSelectFieldProps<T = string> = {
  /**
   * Options shown in the dropdown. Pass plain strings or numbers (value ===
   * label), or `{ value, label }` objects. The form value is an array of the
   * selected values (`item.value` for objects). To show them under headings,
   * pass `{ label, items }` groups instead.
   */
  items: readonly T[]
  description?: ReactNode
  label?: ReactNode
  /** Shown in the search input while nothing is selected. */
  placeholder?: string
  /** Message shown when filtering produces zero matches. */
  emptyMessage?: ReactNode
  /** Override per-row rendering. Default: the item's label. */
  renderItem?: (item: MultiSelectOption<T>) => ReactNode
  /**
   * Whether an item's value is a stored value. Defaults to `Object.is`. Pass
   * it when the values are objects (`{ kind, id }`), which a reload or a
   * refetch rebuilds: `(a, b) => a.kind === b.kind && a.id === b.id`. Never
   * called with an empty value.
   */
  // biome-ignore lint/style/useConsistentMethodSignatures: a method's parameters are bivariant, so a comparator typed with the value fits `form.<Field>`, whose props see the items as `unknown`.
  isItemEqualToValue?(
    itemValue: MultiSelectValue<T>,
    value: MultiSelectValue<T>
  ): boolean
  /** Show a button that clears every selection. Defaults to `true`. */
  showClear?: boolean
  /** Accessible label of the clear button. Defaults to `"Clear"`. */
  clearLabel?: string
  disabled?: boolean
  className?: string
  /**
   * Mark the field required, or not, over the schema. Drives the `*` and
   * `aria-required`.
   */
  required?: boolean
}

function isItemObject(item: unknown): item is MultiSelectItemObject<unknown> {
  return (
    typeof item === "object" &&
    item !== null &&
    "value" in item &&
    "label" in item
  )
}

// What Base UI takes for a group: an object with an `items` array.
function isItemGroup(item: unknown): item is MultiSelectItemGroup<unknown> {
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

// One key per value, objects included.
function valueKey(value: unknown): string {
  if (typeof value !== "object" || value === null) {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Multi-value combobox: the selection renders as removable chips and the form
 * value is an array (`[]` when empty).
 */
function MultiSelectField<T = string>({
  className,
  clearLabel = "Clear",
  description,
  disabled,
  emptyMessage = "No results.",
  isItemEqualToValue,
  items,
  label,
  placeholder,
  renderItem,
  required,
  showClear = true,
}: MultiSelectFieldProps<T>) {
  const field = useFieldContext<MultiSelectValue<T>[] | null | undefined>()
  const isDisabled = useIsFormDisabled(field.form) || Boolean(disabled)
  const anchor = useComboboxAnchor()
  const id = useId()
  const errorId = `${id}-error`
  const descriptionId = `${id}-description`
  const isInvalid = useIsInvalid(field)
  const hideErrors = useHideFieldErrors(field)
  const showError = isInvalid && !hideErrors
  const schemaRequired = useIsFieldRequired(field)
  const isRequired = required ?? schemaRequired
  const schemaRequiresValue = useIsFieldRequiredBySchema(field)
  const requiresValue = required ?? schemaRequiresValue

  const options = items.flatMap((item) =>
    isItemGroup(item) ? item.items : [item]
  ) as MultiSelectOption<T>[]
  const isSameValue = (a: unknown, b: unknown): boolean => {
    if (Object.is(a, b)) {
      return true
    }
    if (a === null || a === undefined || b === null || b === undefined) {
      return false
    }
    return (
      isItemEqualToValue?.(
        a as MultiSelectValue<T>,
        b as MultiSelectValue<T>
      ) ?? false
    )
  }

  const values = field.state.value ?? []
  // Map stored values back to item identities, in selection order, so Base UI
  // compares by reference and the chips keep the order the user picked.
  const selected = values
    .map((value) =>
      options.find((option) => isSameValue(itemValue(option), value))
    )
    .filter((option): option is MultiSelectOption<T> => option !== undefined)

  const renderOption = (option: MultiSelectOption<T>) =>
    renderItem ? (
      renderItem(option)
    ) : (
      <ComboboxItem key={valueKey(itemValue(option))} value={option}>
        {itemLabel(option)}
      </ComboboxItem>
    )

  return (
    <Field
      data-disabled={isDisabled || undefined}
      data-field={field.name}
      data-invalid={isInvalid}
    >
      {label && (
        <FieldLabel htmlFor={id}>
          {label}
          {isRequired && <RequiredIndicator />}
        </FieldLabel>
      )}
      <Combobox
        disabled={isDisabled}
        items={items}
        multiple
        onValueChange={(next: MultiSelectOption<T>[]) =>
          field.handleChange(next.map(itemValue) as MultiSelectValue<T>[])
        }
        value={selected}
      >
        <ComboboxChips className={className} ref={anchor}>
          <ComboboxValue>
            {(chips: MultiSelectOption<T>[]) => (
              <>
                {chips.map((option) => (
                  <ComboboxChip key={valueKey(itemValue(option))}>
                    {itemLabel(option)}
                  </ComboboxChip>
                ))}
                <ComboboxChipsInput
                  aria-describedby={describedBy(
                    [description, descriptionId],
                    [showError, errorId]
                  )}
                  aria-invalid={isInvalid || undefined}
                  aria-required={requiresValue || undefined}
                  id={id}
                  name={field.name}
                  onBlur={field.handleBlur}
                  placeholder={chips.length === 0 ? placeholder : undefined}
                />
              </>
            )}
          </ComboboxValue>
          {showClear && selected.length > 0 && !isDisabled && (
            <Button
              aria-label={clearLabel}
              className="ml-auto"
              onClick={() => field.handleChange([])}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <XIcon />
            </Button>
          )}
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
          <ComboboxList>
            {(item: T) =>
              isItemGroup(item) ? (
                <ComboboxGroup items={item.items} key={item.label}>
                  <ComboboxLabel>{item.label}</ComboboxLabel>
                  <ComboboxCollection>{renderOption}</ComboboxCollection>
                </ComboboxGroup>
              ) : (
                renderOption(item as MultiSelectOption<T>)
              )
            }
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {description && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      {showError && (
        <FieldError errors={field.state.meta.errors} id={errorId} />
      )}
    </Field>
  )
}

export type {
  MultiSelectFieldProps,
  MultiSelectItemGroup,
  MultiSelectItemObject,
  MultiSelectValue,
}
export { MultiSelectField }
