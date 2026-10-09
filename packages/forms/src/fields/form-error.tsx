"use client"

import { useFormContext } from "@zeno-lib/forms/lib/contexts"
import { useSubmitError } from "@zeno-lib/forms/lib/submit-error"
import { useSelector } from "@zeno-lib/forms/tanstack"
import type { ComponentProps, ReactNode } from "react"
import { FieldError } from "@/components/ui/field"

type FormErrorProps = Omit<
  ComponentProps<typeof FieldError>,
  "children" | "errors"
> & {
  /**
   * Shown when the submit handler throws (a network failure, an unexpected
   * server error). Defaults to `"Something went wrong. Try again."`. A
   * function gets what was thrown.
   */
  submitErrorMessage?: ReactNode | ((error: unknown) => ReactNode)
}

/**
 * The form-level error, as a `role="alert"` message: the `formErrors` an
 * action returns through `submitAction`, a `ValidationError`'s `formError`,
 * or `submitErrorMessage` when the submit throws. Renders nothing otherwise.
 * It clears when the user edits the form, and a thrown one also when they
 * submit again.
 */
function FormError({
  submitErrorMessage = "Something went wrong. Try again.",
  ...props
}: FormErrorProps) {
  const form = useFormContext()
  const formError = useSelector(form.store, (state) => state.errorMap.onSubmit)
  const submitError = useSubmitError(form)

  if (submitError) {
    return (
      <FieldError data-slot="form-error" {...props}>
        {typeof submitErrorMessage === "function"
          ? submitErrorMessage(submitError.error)
          : submitErrorMessage}
      </FieldError>
    )
  }
  // `submitAction` joins several messages with a line break. A schema's
  // form-level result is an object, not a message, and isn't shown here.
  if (typeof formError !== "string" || formError === "") {
    return null
  }
  return (
    <FieldError
      data-slot="form-error"
      errors={formError.split("\n").map((message) => ({ message }))}
      {...props}
    />
  )
}

export type { FormErrorProps }
export { FormError }
