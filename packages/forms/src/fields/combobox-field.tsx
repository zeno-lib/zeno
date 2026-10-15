"use client"

import { describedBy } from "@zeno-lib/forms/lib/aria"
import { useFieldContext } from "@zeno-lib/forms/lib/contexts"
import { getEmptyValue } from "@zeno-lib/forms/lib/empty-value"
import { useIsFormDisabled } from "@zeno-lib/forms/lib/form-disabled"
import {
  useHideFieldErrors,
  useIsFieldRequired,
  useIsFieldRequiredBySchema,
  useIsInvalid,
} from "@zeno-lib/forms/lib/use-is-invalid"
import { type ReactNode, useId } from "react"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { InputGroupAddon } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { RequiredIndicator } from "../lib/required-indicator"

type ComboboxItemObject<V> = { value: V; label: string }

/** Items under a heading. */
type ComboboxItemGroup<T> = { label: string; items: readonly T[] }

/** An item of `items`, or of one of its groups. */
type ComboboxOption<T> = T extends ComboboxItemGroup<infer I> ? I : T

/** What picking an item stores: `item.value` for an object, else the item. */
type ComboboxOptionValue<T> =
  T extends ComboboxItemGroup<infer I>
    ? ComboboxOptionValue<I>
    : T extends ComboboxItemObject<infer V>
      ? V
      : T

type ComboboxFieldProps<T = string> = {
  /**
   * Items shown in the dropdown. Pass plain strings (value === label) or
   * `{ value, label }` objects when the value isn't a string (e.g. numeric
   * database IDs, or an object). To show them under headings, pass
   * `{ label, items }` groups instead.
   */
  items: readonly T[]
  description?: ReactNode
  label?: ReactNode
  placeholder?: string
  /** Message shown when filtering produces zero matches. */
  emptyMessage?: ReactNode
  /** Override per-row rendering. Default: plain `<ComboboxItem>{label}</ComboboxItem>`. */
  renderItem?: (item: ComboboxOption<T>) => ReactNode
  /**
   * Whether an item's value is the stored value. Defaults to `Object.is`.
   * Pass it when the values are objects (`{ kind, id }`), which a reload or a
   * refetch rebuilds: `(a, b) => a.kind === b.kind && a.id === b.id`. Never
   * called with an empty value.
   */
  // biome-ignore lint/style/useConsistentMethodSignatures: a method's parameters are bivariant, so a comparator typed with the value fits `form.<Field>`, whose props see the items as `unknown`.
  isItemEqualToValue?(
    itemValue: ComboboxOptionValue<T>,
    value: ComboboxOptionValue<T>
  ): boolean
  /**
   * Show the clear button when a value is selected. Defaults to `true` on an
   * optional field and `false` on a required one (from the schema or
   * `required`), where clearing could only make the form invalid.
   */
  showClear?: boolean
  disabled?: boolean
  className?: string
  /**
   * Mark the field required, or not, over the schema. Drives the `*`,
   * `aria-required` and the `showClear` default.
   */
  required?: boolean
  /**
   * Controlled input text — pair with `onInputValueChange` for server-side
   * search. When omitted, Base UI manages the input value internally.
   */
  inputValue?: string
  /** Fires on every keystroke in the search input. */
  onInputValueChange?: (value: string) => void
  /**
   * Replace Base UI's built-in client-side filter. Pass `null` for
   * server-driven search where `items` is already filtered by the consumer.
   */
  filter?: ((item: ComboboxOption<T>, query: string) => boolean) | null
  /**
   * Show a spinner addon inside the input while options are being fetched.
   * Pair with `onInputValueChange` to drive a debounced server query.
   */
  loading?: boolean
}

function isItemObject(item: unknown): item is ComboboxItemObject<unknown> {
  return (
    typeof item === "object" &&
    item !== null &&
    "value" in item &&
    "label" in item
  )
}

// What Base UI takes for a group: an object with an `items` array.
function isItemGroup(item: unknown): item is ComboboxItemGroup<unknown> {
  return (
    typeof item === "object" &&
    item !== null &&
    Array.isArray((item as { items?: unknown }).items)
  )
}

function itemValue(item: unknown): unknown {
  return isItemObject(item) ? item.value : item
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

function ComboboxField<T = string>({
  className,
  description,
  disabled,
  emptyMessage = "No results.",
  filter,
  inputValue,
  isItemEqualToValue,
  items,
  label,
  loading,
  onInputValueChange,
  placeholder,
  renderItem,
  required,
  showClear,
}: ComboboxFieldProps<T>) {
  const field = useFieldContext()
  const isDisabled = useIsFormDisabled(field.form) || Boolean(disabled)
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
  const canClear = showClear ?? !requiresValue

  const options = items.flatMap((item) =>
    isItemGroup(item) ? item.items : [item]
  ) as ComboboxOption<T>[]
  const isSameValue = (a: unknown, b: unknown): boolean => {
    if (Object.is(a, b)) {
      return true
    }
    if (a === null || a === undefined || b === null || b === undefined) {
      return false
    }
    return (
      isItemEqualToValue?.(
        a as ComboboxOptionValue<T>,
        b as ComboboxOptionValue<T>
      ) ?? false
    )
  }

  const fieldValue = field.state.value
  // Base UI shows the value it gets as text, so a stored id whose item isn't
  // in `items` (options still loading, or a search that dropped it) would
  // show raw. Only a plain string or number item is its own label.
  const match = options.find((option) =>
    isSameValue(itemValue(option), fieldValue)
  )
  const plainItems = options.length > 0 && !options.some(isItemObject)
  const value = (match ??
    (plainItems ? (fieldValue ?? null) : null)) as ComboboxOption<T> | null

  const renderOption = (option: ComboboxOption<T>) => {
    if (renderItem) {
      return renderItem(option)
    }
    return (
      <ComboboxItem key={valueKey(itemValue(option))} value={option}>
        {isItemObject(option) ? option.label : String(option)}
      </ComboboxItem>
    )
  }

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
      <Combobox<ComboboxOption<T>>
        disabled={isDisabled}
        filter={filter}
        inputValue={inputValue}
        items={items}
        onInputValueChange={onInputValueChange}
        onValueChange={(next) => {
          if (next === null) {
            field.handleChange(getEmptyValue(field, undefined))
            return
          }
          field.handleChange(itemValue(next))
        }}
        value={value}
      >
        <ComboboxInput
          aria-describedby={describedBy(
            [description, descriptionId],
            [showError, errorId]
          )}
          aria-invalid={isInvalid || undefined}
          aria-required={requiresValue || undefined}
          className={className}
          disabled={isDisabled}
          id={id}
          name={field.name}
          onBlur={field.handleBlur}
          placeholder={placeholder}
          showClear={canClear && value !== null && value !== "" && !loading}
        >
          {loading && (
            <InputGroupAddon align="inline-end">
              <Spinner />
            </InputGroupAddon>
          )}
        </ComboboxInput>
        <ComboboxContent>
          <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
          <ComboboxList>
            {(item: T) =>
              isItemGroup(item) ? (
                <ComboboxGroup items={item.items} key={item.label}>
                  <ComboboxLabel>{item.label}</ComboboxLabel>
                  <ComboboxCollection>{renderOption}</ComboboxCollection>
                </ComboboxGroup>
              ) : (
                renderOption(item as ComboboxOption<T>)
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

export type { ComboboxFieldProps, ComboboxItemGroup, ComboboxItemObject }
export { ComboboxField }
