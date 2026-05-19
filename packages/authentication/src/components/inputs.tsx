import { Input } from "@zeno-lib/ui/input"
import { Label } from "@zeno-lib/ui/label"
import type { ChangeEvent } from "react"

import { useAuthForm } from "./context"

export const EmailInput = () => {
  const { email, loading, setEmail } = useAuthForm()
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="email">Email</Label>
      <Input
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect="off"
        defaultValue={email}
        disabled={loading}
        id="email"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          setEmail(event.target.value)
        }}
        placeholder="name@example.com"
        type="email"
        value={email}
      />
    </div>
  )
}

export const PasswordInput = () => {
  const { loading, password, setPassword } = useAuthForm()
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="password">Password</Label>
      <Input
        autoCapitalize="none"
        autoComplete="password"
        autoCorrect="off"
        defaultValue={password}
        disabled={loading}
        id="password"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          setPassword(event.target.value)
        }}
        placeholder="Password"
        type="password"
        value={password}
      />
    </div>
  )
}
