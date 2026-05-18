"use client"

import {
  Form,
  FormProvider,
  useFieldContext,
  useForm,
  useIsInvalid,
} from "@zeno-lib/forms"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@zeno-lib/ui/card"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@zeno-lib/ui/combobox"
import { Field, FieldError, FieldGroup, FieldLabel } from "@zeno-lib/ui/field"
import { useState } from "react"
import { z } from "zod"

import { toastSubmitted, wrapperClass } from "./preview-utils"

type SkillItem = { value: string; label: string; creatable?: boolean }
type SkillGroup = { value: string; items: SkillItem[] }

const baseGroups: SkillGroup[] = [
  {
    items: [
      { label: "React", value: "react" },
      { label: "Vue", value: "vue" },
      { label: "Svelte", value: "svelte" },
      { label: "Tailwind CSS", value: "tailwind" },
    ],
    value: "Frontend",
  },
  {
    items: [
      { label: "Node.js", value: "node" },
      { label: "Python", value: "python" },
      { label: "Go", value: "go" },
      { label: "Rust", value: "rust" },
    ],
    value: "Backend",
  },
  {
    items: [
      { label: "Docker", value: "docker" },
      { label: "Kubernetes", value: "kubernetes" },
      { label: "Terraform", value: "terraform" },
    ],
    value: "DevOps",
  },
]

function SkillsField() {
  const field = useFieldContext<string[]>()
  const isInvalid = useIsInvalid(field)
  const [query, setQuery] = useState("")
  const [customSkills, setCustomSkills] = useState<SkillItem[]>([])
  const anchorRef = useComboboxAnchor()

  const allGroups = customSkills.length
    ? [...baseGroups, { items: customSkills, value: "Custom" }]
    : baseGroups
  const allItems = allGroups.flatMap((g) => g.items)

  // Append a "Create …" item when the query has no exact match.
  const trimmed = query.trim()
  const hasMatch = allItems.some(
    (s) => s.label.toLowerCase() === trimmed.toLowerCase()
  )
  const groupsForView =
    !trimmed || hasMatch
      ? allGroups
      : [
          ...allGroups,
          {
            items: [
              { creatable: true, label: `Create "${trimmed}"`, value: trimmed },
            ],
            value: "New",
          },
        ]

  const selectedValues = field.state.value ?? []
  const selectedItems = selectedValues
    .map((v) => allItems.find((s) => s.value === v))
    .filter((s): s is SkillItem => s != null)

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name}>Skills</FieldLabel>
      <Combobox
        inputValue={query}
        isItemEqualToValue={(a: SkillItem, b: SkillItem) => a.value === b.value}
        items={groupsForView}
        multiple
        onInputValueChange={setQuery}
        onValueChange={(next: SkillItem[]) => {
          const created = next.find((i) => i.creatable)
          if (created) {
            const newSkill = {
              label: created.value,
              value: created.value.toLowerCase(),
            }
            setCustomSkills((c) => [...c, newSkill])
            field.handleChange([...selectedValues, newSkill.value])
            setQuery("")
          } else {
            field.handleChange(next.map((i) => i.value))
          }
        }}
        value={selectedItems}
      >
        <ComboboxChips ref={anchorRef}>
          <ComboboxValue>
            {(value: SkillItem[]) =>
              value.map((item) => (
                <ComboboxChip key={item.value}>{item.label}</ComboboxChip>
              ))
            }
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent anchor={anchorRef}>
          <ComboboxInput
            placeholder="Search or type to create…"
            showTrigger={false}
          />
          <ComboboxEmpty>No skill matches.</ComboboxEmpty>
          <ComboboxList>
            {(group: SkillGroup) => (
              <ComboboxGroup items={group.items} key={group.value}>
                <ComboboxLabel>{group.value}</ComboboxLabel>
                <ComboboxCollection>
                  {(item: SkillItem) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
              </ComboboxGroup>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  )
}

export function SkillsPickerExample() {
  const form = useForm({
    onSubmit: ({ value }) => toastSubmitted(value),
    schema: z.object({
      skills: z.array(z.string()).min(1, "Pick at least one skill"),
    }),
  })
  const { AppField, ResetButton, SubmitButton } = form
  return (
    <FormProvider form={form}>
      <Card className={wrapperClass}>
        <CardHeader>
          <CardTitle>Profile skills</CardTitle>
          <CardDescription>
            Multi-select, grouped, with search inside the popup and on-the-fly
            create.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form id="skills-form">
            <FieldGroup>
              <AppField name="skills">{() => <SkillsField />}</AppField>
            </FieldGroup>
          </Form>
        </CardContent>
        <CardFooter>
          <Field orientation="horizontal">
            <ResetButton />
            <SubmitButton form="skills-form">Save</SubmitButton>
          </Field>
        </CardFooter>
      </Card>
    </FormProvider>
  )
}
