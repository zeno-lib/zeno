import { expectTypeOf, test } from "@zeno/vitest"

import type { ValidationMode } from "./validation-modes"

test("ValidationMode is the exact union of the four supported modes", () => {
  expectTypeOf<ValidationMode>().toEqualTypeOf<
    "change" | "blur" | "submit" | "blur-then-change"
  >()
})
