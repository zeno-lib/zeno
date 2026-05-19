"use client"

import { Form, FormProvider, useForm } from "@zeno-lib/forms"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zeno-lib/ui/card"
import { FieldGroup } from "@zeno-lib/ui/field"
import { useEffect, useState } from "react"

import { wrapperClass } from "./preview-utils"

const ALL_USERS = [
  "Alice Anderson",
  "Bob Brown",
  "Charlie Chen",
  "Diana Davis",
  "Eli Edwards",
  "Fatima Fischer",
  "Grace Grant",
  "Hassan Hayes",
  "Ines Ito",
  "Jonas Jensen",
  "Kira Kowalski",
  "Liam Lopez",
  "Mira Martinez",
  "Noah Nakamura",
  "Olivia Owens",
]

async function searchUsers(query: string): Promise<string[]> {
  await new Promise((resolve) => setTimeout(resolve, 350))
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) {
    return []
  }
  return ALL_USERS.filter((name) => name.toLowerCase().includes(trimmed))
}

export function AsyncSearchExample() {
  const [query, setQuery] = useState("")
  const [items, setItems] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    let cancelled = false
    const handle = window.setTimeout(async () => {
      const results = await searchUsers(trimmed)
      if (!cancelled) {
        setItems(results)
        setLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [query])

  const form = useForm({
    defaultValues: { assignee: "" },
  })
  const { ComboboxField } = form

  return (
    <FormProvider form={form}>
      <Card className={wrapperClass}>
        <CardHeader>
          <CardTitle>Assign reviewer</CardTitle>
          <CardDescription>
            Type to search the team. Results load from a (simulated) API with a
            350 ms delay.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form>
            <FieldGroup>
              <ComboboxField
                emptyMessage={
                  query.trim() && !loading ? "No matches." : "Type to search…"
                }
                filter={null}
                inputValue={query}
                items={items}
                label="Assignee"
                loading={loading}
                name="assignee"
                onInputValueChange={setQuery}
                placeholder="Search teammates…"
              />
            </FieldGroup>
          </Form>
        </CardContent>
      </Card>
    </FormProvider>
  )
}
