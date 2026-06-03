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

- Create a `vitest.config.ts` using the default config:

```ts
// vitest.config.ts
export { defaultConfig as default } from "@zeno-lib/test/configs"
```

For React packages, use `reactConfig` instead:

```ts
// vitest.config.ts
export { reactConfig as default } from "@zeno-lib/test/configs"
```

### Extending the config

To override shared defaults, merge a shared config with package-specific options:

```ts
// vitest.config.ts
import { defineConfig, mergeConfig, reactConfig } from "@zeno-lib/test/configs"

export default mergeConfig(
  reactConfig,
  defineConfig({
    test: {
      // package-specific overrides
    },
  }),
)
```

Use `defaultConfig` instead of `reactConfig` for non-React packages.

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
