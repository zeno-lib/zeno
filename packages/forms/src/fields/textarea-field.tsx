"use client"

import { useFieldContext } from "@zeno-lib/forms/lib/contexts"
import { getNoTextValue } from "@zeno-lib/forms/lib/empty-value"
import { useFieldControl } from "@zeno-lib/forms/lib/use-field-control"
import { Children, type ComponentProps, type ReactNode } from "react"
import { InputGroup, InputGroupTextarea } from "@/components/ui/input-group"
import { Textarea } from "@/components/ui/textarea"
import { FieldShell } from "./field-shell"

type TextAreaFieldProps = Omit<
  ComponentProps<typeof Textarea>,
  "children" | "id" | "name" | "onBlur" | "onChange" | "value"
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

function TextAreaField({
  children,
  description,
  disabled,
  label,
  required,
  ...props
}: TextAreaFieldProps) {
  const field = useFieldContext<string | null>()
  // The label names the textarea through `htmlFor`, so the textarea needs no
  // `aria-labelledby` and the hook doesn't get `label`.
  const { controlProps, ...shell } = useFieldControl<string | null>({
    description,
    disabled,
    required,
  })
  const hasAddons = Children.count(children) > 0

  // A textarea keeps the `""` the user typed, where `controlProps.onChange`
  // would store the field's empty value, unless the schema takes `null`: then
  // no text is `null`, as the field starts, so it saves as none.
  const textareaProps = {
    ...controlProps,
    onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
      field.handleChange(event.target.value || getNoTextValue(field)),
    value: field.state.value ?? "",
    ...props,
  }

  return (
    <FieldShell {...shell} description={description} label={label}>
      {hasAddons ? (
        <InputGroup>
          <InputGroupTextarea {...textareaProps} />
          {children}
        </InputGroup>
      ) : (
        <Textarea {...textareaProps} />
      )}
    </FieldShell>
  )
}

export { TextAreaField }
