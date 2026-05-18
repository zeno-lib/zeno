# Setup

In the package you want to do testing, do the following:

- import this package by adding `"@zeno-lib/vitest": "workspace:*"` into `devDependencies` inside `package.json.
- also add `vitest` into `devDependencies`.
- create tests by creating `x.test.ts` files.
- Here is a content example:

```ts
import { describe, expect, test } from "vitest"

describe("Example", () => {
  test("Example", () => {
    expect(true).toBe(true)
  })
})

```