"use client"

import { describedBy } from "@zeno-lib/forms/lib/aria"
import { useFieldContext } from "@zeno-lib/forms/lib/contexts"
import { getEmptyValue } from "@zeno-lib/forms/lib/empty-value"
import { useIsFormDisabled } from "@zeno-lib/forms/lib/form-disabled"
import {
  findOption,
  type ItemGroup,
  type ItemObject,
  type ItemOption,
  type ItemValue,
  isItemGroup,
  isItemObject,
  isSameValue,
  itemLabel,
  itemValue,
  toItemList,
  type ValueComparator,
  valueKey,
} from "@zeno-lib/forms/lib/item-options"
import {
  useHideFieldErrors,
  useIsFieldRequired,
  useIsFieldRequiredBySchema,
  useIsInvalid,
} from "@zeno-lib/forms/lib/use-is-invalid"
import { type ReactNode, useId, useMemo, useState } from "react"
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

type ComboboxItemObject<V> = ItemObject<V>

/** Items under a heading. */
type ComboboxItemGroup<T> = ItemGroup<T>

/** An item of `items`, or of one of its groups. */
type ComboboxOption<T> = ItemOption<T>

/** What picking an item stores: `item.value` for an object, else the item. */
type ComboboxOptionValue<T> = ItemValue<T>

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

// Base UI copies the selected label into the input whenever `value` is a new
// object, so items rebuilt on every render (mapped from fetched rows) would
// overwrite what the user types. Keep the item found until it stands for
// another value or label.
function useHeldOption<O>(
  match: O | undefined,
  isEqual: ValueComparator | undefined
): O | undefined {
  const [held, setHeld] = useState(match)
  const keepsHeld =
    held !== undefined &&
    match !== undefined &&
    isSameValue(itemValue(held), itemValue(match), isEqual) &&
    itemLabel(held) === itemLabel(match)
  if (held !== match && !keepsHeld) {
    setHeld(match)
  }
  return keepsHeld ? held : match
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

  const list = useMemo(() => toItemList(items), [items])
  const isEqual = isItemEqualToValue as ValueComparator | undefined

  const fieldValue = field.state.value
  // Base UI shows the value it gets as text, so a stored id whose item isn't
  // in `items` (options still loading, or a search that dropped it) would
  // show raw. Only a plain string or number item is its own label.
  const match = useHeldOption(findOption(list, fieldValue, isEqual), isEqual)
  const plainItems = list.options.length > 0 && !list.options.some(isItemObject)
  const value = (match ??
    (plainItems ? (fieldValue ?? null) : null)) as ComboboxOption<T> | null

  const renderOption = (option: ComboboxOption<T>) => {
    if (renderItem) {
      return renderItem(option)
    }
    return (
      <ComboboxItem key={valueKey(itemValue(option))} value={option}>
        {itemLabel(option)}
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
        // The held item may be one `items` no longer has.
        isItemEqualToValue={(item, selected) =>
          isSameValue(itemValue(item), itemValue(selected), isEqual)
        }
        items={list.items}
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
            {(item: T, index: number) =>
              isItemGroup(item) ? (
                // Two groups can share a heading, or have none.
                <ComboboxGroup items={item.items} key={index}>
                  {item.label && <ComboboxLabel>{item.label}</ComboboxLabel>}
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
