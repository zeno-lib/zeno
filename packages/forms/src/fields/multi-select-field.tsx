"use client"

import { describedBy } from "@zeno-lib/forms/lib/aria"
import { useFieldContext } from "@zeno-lib/forms/lib/contexts"
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
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
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

/** The value stored per selected item: `item.value` for objects, else the item. */
type MultiSelectValue<T> = T extends MultiSelectItemObject<infer V> ? V : T

type MultiSelectFieldProps<T = string> = {
  /**
   * Options shown in the dropdown. Pass plain strings or numbers (value ===
   * label), or `{ value, label }` objects. The form value is an array of the
   * selected values (`item.value` for objects).
   */
  items: readonly T[]
  description?: ReactNode
  label?: ReactNode
  /** Shown in the search input while nothing is selected. */
  placeholder?: string
  /** Message shown when filtering produces zero matches. */
  emptyMessage?: ReactNode
  /** Override per-row rendering. Default: the item's label. */
  renderItem?: (item: T) => ReactNode
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

function itemValue(item: unknown): unknown {
  return isItemObject(item) ? item.value : item
}

function itemLabel(item: unknown): string {
  return isItemObject(item) ? item.label : String(item)
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
  items,
  label,
  placeholder,
  renderItem,
  required,
  showClear = true,
}: MultiSelectFieldProps<T>) {
  const field = useFieldContext<MultiSelectValue<T>[] | null | undefined>()
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

  const values = field.state.value ?? []
  // Map stored values back to item identities, in selection order, so Base UI
  // compares by reference and the chips keep the order the user picked.
  const selected = values
    .map((value) => items.find((item) => Object.is(itemValue(item), value)))
    .filter((item): item is T => item !== undefined)

  return (
    <Field data-field={field.name} data-invalid={isInvalid}>
      {label && (
        <FieldLabel htmlFor={id}>
          {label}
          {isRequired && <RequiredIndicator />}
        </FieldLabel>
      )}
      <Combobox
        disabled={disabled}
        items={items}
        multiple
        onValueChange={(next: T[]) =>
          field.handleChange(next.map(itemValue) as MultiSelectValue<T>[])
        }
        value={selected}
      >
        <ComboboxChips className={className} ref={anchor}>
          <ComboboxValue>
            {(chips: T[]) => (
              <>
                {chips.map((item) => (
                  <ComboboxChip key={String(itemValue(item))}>
                    {itemLabel(item)}
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
          {showClear && selected.length > 0 && !disabled && (
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
              renderItem ? (
                renderItem(item)
              ) : (
                <ComboboxItem key={String(itemValue(item))} value={item}>
                  {itemLabel(item)}
                </ComboboxItem>
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

export type { MultiSelectFieldProps, MultiSelectItemObject, MultiSelectValue }
export { MultiSelectField }
