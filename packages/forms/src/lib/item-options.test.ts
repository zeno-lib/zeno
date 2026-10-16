import { describe, expect, test } from "vitest"

import { valueKey } from "./item-options"

describe("valueKey", () => {
  test("keeps values that print alike apart, so React keys don't collide", () => {
    expect(valueKey(1)).not.toBe(valueKey("1"))
    expect(valueKey(null)).not.toBe(valueKey("null"))
    expect(valueKey({ id: 1 })).not.toBe(valueKey('{"id":1}'))
  })
})
