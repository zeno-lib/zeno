"use client"

import { TanStackDevtools } from "@tanstack/react-devtools"
import { formDevtoolsPlugin } from "@tanstack/react-form-devtools"

export function DevtoolsPanel() {
  return <TanStackDevtools plugins={[formDevtoolsPlugin()]} />
}
