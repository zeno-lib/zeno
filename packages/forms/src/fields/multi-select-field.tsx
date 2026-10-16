"use client"

import { describedBy } from "@zeno-lib/forms/lib/aria"
import { useFieldContext } from "@zeno-lib/forms/lib/contexts"
import { useIsFormDisabled } from "@zeno-lib/forms/lib/form-disabled"
import {
  findOption,
  type ItemGroup,
  type ItemObject,
  type ItemOption,
  type ItemValue,
  isItemGroup,
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
import { XIcon } from "lucide-react"
import { type ReactNode, useId, useMemo } from "react"
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

type MultiSelectItemObject<V> = ItemObject<V>

/** Items under a heading. */
type MultiSelectItemGroup<T> = ItemGroup<T>

/** An item of `items`, or of one of its groups. */
type MultiSelectOption<T> = ItemOption<T>

/** The value stored per selected item: `item.value` for objects, else the item. */
type MultiSelectValue<T> = ItemValue<T>

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

  const list = useMemo(() => toItemList(items), [items])
  const isEqual = isItemEqualToValue as ValueComparator | undefined

  const values = field.state.value ?? []
  // Map stored values back to item identities, in selection order, so Base UI
  // compares by reference and the chips keep the order the user picked.
  const selected = values
    .map((value) => findOption(list, value, isEqual))
    .filter((option): option is MultiSelectOption<T> => option !== undefined)

  // Base UI only knows the values it has a chip for. Keep the others (their
  // group still loading) where they were, so picking an option doesn't drop
  // them.
  const onValueChange = (next: MultiSelectOption<T>[]) => {
    const picked = next.map(itemValue)
    const kept = values.filter(
      (value) =>
        findOption(list, value, isEqual) === undefined ||
        picked.some((other) => isSameValue(other, value, isEqual))
    )
    const added = picked.filter(
      (other) => !values.some((value) => isSameValue(other, value, isEqual))
    )
    field.handleChange([...kept, ...added] as MultiSelectValue<T>[])
  }

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
        items={list.items}
        multiple
        onValueChange={onValueChange}
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
            {(item: T, index: number) =>
              isItemGroup(item) ? (
                // Two groups can share a heading, or have none.
                <ComboboxGroup items={item.items} key={index}>
                  {item.label && <ComboboxLabel>{item.label}</ComboboxLabel>}
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
