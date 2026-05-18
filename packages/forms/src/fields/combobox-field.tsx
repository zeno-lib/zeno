"use client"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@zeno-lib/ui/combobox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@zeno-lib/ui/field"
import { InputGroupAddon } from "@zeno-lib/ui/input-group"
import { Spinner } from "@zeno-lib/ui/spinner"
import type { ReactNode } from "react"

import { describedBy } from "../lib/aria"
import { useFieldContext } from "../lib/contexts"
import { RequiredIndicator } from "../lib/required-indicator"
import {
  useHideFieldErrors,
  useIsFieldRequired,
  useIsInvalid,
} from "../lib/use-is-invalid"

type ComboboxItemObject<V> = { value: V; label: string }

type ComboboxFieldProps<T = string> = {
  /**
   * Items shown in the dropdown. Pass plain strings (value === label) or
   * `{ value, label }` objects when the value isn't a string (e.g. numeric
   * database IDs).
   */
  items: readonly T[]
  description?: ReactNode
  label?: ReactNode
  placeholder?: string
  /** Message shown when filtering produces zero matches. */
  emptyMessage?: ReactNode
  /** Override per-row rendering. Default: plain `<ComboboxItem>{label}</ComboboxItem>`. */
  renderItem?: (item: T) => ReactNode
  /**
   * If `true`, show the clear button when a value is selected. Defaults to
   * `true` — pass `false` for required-style comboboxes where clearing is
   * disallowed.
   */
  showClear?: boolean
  className?: string
  /** Force the required `*` indicator on or off. Defaults to schema-derived. */
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
  filter?: ((item: T, query: string) => boolean) | null
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

function ComboboxField<T = string>({
  className,
  description,
  emptyMessage = "No results.",
  filter,
  inputValue,
  items,
  label,
  loading,
  onInputValueChange,
  placeholder,
  renderItem,
  required,
  showClear = true,
}: ComboboxFieldProps<T>) {
  const field = useFieldContext()
  const errorId = `${field.name}-error`
  const descriptionId = `${field.name}-description`
  const isInvalid = useIsInvalid(field)
  const hideErrors = useHideFieldErrors(field)
  const showError = isInvalid && !hideErrors
  const schemaRequired = useIsFieldRequired(field)
  const isRequired = required ?? schemaRequired

  const fieldValue = field.state.value
  const hasObjectItems = items.some(isItemObject)
  const value = hasObjectItems
    ? ((items.find((item) => isItemObject(item) && item.value === fieldValue) ??
        null) as T | null)
    : ((fieldValue ?? null) as T | null)

  return (
    <Field data-invalid={isInvalid}>
      {label && (
        <FieldLabel htmlFor={field.name}>
          {label}
          {isRequired && <RequiredIndicator />}
        </FieldLabel>
      )}
      <Combobox
        filter={filter}
        inputValue={inputValue}
        items={items}
        onInputValueChange={onInputValueChange}
        onValueChange={(next) => {
          if (next == null) {
            field.handleChange(undefined)
            return
          }
          field.handleChange(isItemObject(next) ? next.value : next)
        }}
        value={value}
      >
        <ComboboxInput
          aria-describedby={describedBy(
            [description, descriptionId],
            [showError, errorId]
          )}
          aria-invalid={isInvalid || undefined}
          className={className}
          id={field.name}
          name={field.name}
          onBlur={field.handleBlur}
          placeholder={placeholder}
          showClear={showClear && value != null && value !== "" && !loading}
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
            {(item: T) => {
              if (renderItem) {
                return renderItem(item)
              }
              if (isItemObject(item)) {
                return (
                  <ComboboxItem key={String(item.value)} value={item}>
                    {item.label}
                  </ComboboxItem>
                )
              }
              return (
                <ComboboxItem key={String(item)} value={item}>
                  {String(item)}
                </ComboboxItem>
              )
            }}
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

export type { ComboboxFieldProps, ComboboxItemObject }
export { ComboboxField }
