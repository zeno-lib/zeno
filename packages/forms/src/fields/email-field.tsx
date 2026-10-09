import { InputField, type InputFieldProps } from "./input-field"

type EmailFieldProps = Omit<InputFieldProps, "inputMode" | "type">

// An address is typed as is: no capital first letter, autocorrect or spell
// check.
function EmailField({
  autoCapitalize = "none",
  autoComplete = "email",
  autoCorrect = "off",
  label = "Email",
  spellCheck = false,
  ...props
}: EmailFieldProps) {
  return (
    <InputField
      autoCapitalize={autoCapitalize}
      autoComplete={autoComplete}
      autoCorrect={autoCorrect}
      inputMode="email"
      label={label}
      spellCheck={spellCheck}
      type="email"
      {...props}
    />
  )
}

export { EmailField }
