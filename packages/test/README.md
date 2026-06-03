# Setup

In the package you want to do testing, do the following:

- Add `"@zeno-lib/test": "workspace:*"` to `devDependencies` in `package.json`.
- Add test scripts (the `vitest` CLI is provided by this package):

```json
{
  "scripts": {
    "test": "vitest --run",
    "test:watch": "vitest watch"
  }
}
```

- Create a `vitest.config.ts` using the shared config:

```ts
// vitest.config.ts
export { default } from "@zeno-lib/test/configs/default"
```

For React packages, use `@zeno-lib/test/configs/react` instead:

```ts
// vitest.config.ts
import { defineReactConfig } from "@zeno-lib/test/configs/react"

export default defineReactConfig()
```

- Create tests in `*.test.ts` (or `*.test.tsx` for React) files.

Example test:

```ts
import { describe, expect, test } from "@zeno-lib/test"

describe("Example", () => {
  test("Example", () => {
    expect(true).toBe(true)
  })
})
```

For React component tests, import from the subpaths:

```tsx
import { describe, expect, test } from "@zeno-lib/test"
import { render, screen } from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
```
