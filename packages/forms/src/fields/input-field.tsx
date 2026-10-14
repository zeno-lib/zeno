"use client"

import { useFieldContext } from "@zeno-lib/forms/lib/contexts"
import { useFieldControl } from "@zeno-lib/forms/lib/use-field-control"
import { Children, type ComponentProps, type ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { FieldShell } from "./field-shell"

type InputFieldProps = Omit<
  ComponentProps<typeof Input>,
  "children" | "id" | "name" | "onBlur"
> & {
  children?: ReactNode
  description?: ReactNode
  label?: ReactNode
  /**
   * Mark the field required, or not, over the schema. Drives the `*` and
   * `aria-required`.
   */
  required?: boolean
}

function InputField({
  children,
  description,
  label,
  required,
  ...props
}: InputFieldProps) {
  const field = useFieldContext<string>()
  // The label names the input through `htmlFor`, so the input needs no
  // `aria-labelledby` and the hook doesn't get `label`.
  const { controlProps, ...shell } = useFieldControl<string>({
    description,
    required,
  })
  const hasAddons = Children.count(children) > 0

  // A text input keeps the `""` the user typed, where `controlProps.onChange`
  // would store the field's empty value.
  const inputProps = {
    ...controlProps,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      field.handleChange(event.target.value),
    value: field.state.value ?? "",
    ...props,
  }

  return (
    <FieldShell {...shell} description={description} label={label}>
      {hasAddons ? (
        <InputGroup>
          <InputGroupInput {...inputProps} />
          {children}
        </InputGroup>
      ) : (
        <Input {...inputProps} />
      )}
    </FieldShell>
  )
}

export type { InputFieldProps }
export { InputField }
