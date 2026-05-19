"use client"

import { Form, FormProvider, useForm } from "@zeno-lib/forms"
import { FieldGroup } from "@zeno-lib/ui/field"
import { useMemo, useState } from "react"
import { z } from "zod"

import { wrapperClass } from "./preview-utils"

const schema = z.object({
  query: z.string().min(2, "Type at least 2 characters"),
})

const ITEMS = [
  "Authentication package",
  "Forms package",
  "Supabase package",
  "UI primitives",
  "Documentation site",
  "End-to-end tests",
  "Tailwind config",
  "TypeScript config",
]

export function LiveSearchExample() {
  const [query, setQuery] = useState("")
  const form = useForm({
    defaultValues: { query: "" },
    listeners: {
      onChange: ({ formApi }) => {
        const result = schema.safeParse(formApi.state.values)
        setQuery(result.success ? formApi.state.values.query : "")
      },
    },
  })
  const { InputField } = form

  const matches = useMemo(() => {
    if (!query) {
      return ITEMS
    }
    const needle = query.toLowerCase()
    return ITEMS.filter((item) => item.toLowerCase().includes(needle))
  }, [query])

  return (
    <div className={wrapperClass}>
      <FormProvider form={form}>
        <Form>
          <FieldGroup>
            <InputField
              label="Search packages"
              name="query"
              placeholder="Type to filter…"
            />
          </FieldGroup>
        </Form>
      </FormProvider>
      <ul className="mt-3 space-y-1 text-sm">
        {matches.length === 0 ? (
          <li className="text-muted-foreground">No matches.</li>
        ) : (
          matches.map((item) => (
            <li className="rounded-sm bg-muted px-2 py-1" key={item}>
              {item}
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
