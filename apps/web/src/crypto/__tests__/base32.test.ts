import { describe, expect, it } from "vitest"

import { decode, encode } from "../base32"

const enc = new TextEncoder()

describe("base32", () => {
  it("matches RFC 4648 test vectors", () => {
    expect(encode(enc.encode(""))).toBe("")
    expect(encode(enc.encode("f"))).toBe("MY======")
    expect(encode(enc.encode("fo"))).toBe("MZXQ====")
    expect(encode(enc.encode("foo"))).toBe("MZXW6===")
    expect(encode(enc.encode("foob"))).toBe("MZXW6YQ=")
    expect(encode(enc.encode("fooba"))).toBe("MZXW6YTB")
    expect(encode(enc.encode("foobar"))).toBe("MZXW6YTBOI======")
  })

  it("decodes the same vectors back", () => {
    expect(Array.from(decode("MZXW6YTBOI======"))).toEqual(Array.from(enc.encode("foobar")))
    expect(Array.from(decode("MZXW6YTB"))).toEqual(Array.from(enc.encode("fooba")))
    expect(Array.from(decode("MY======"))).toEqual(Array.from(enc.encode("f")))
  })

  it("accepts lower case and omits padding when decoding", () => {
    expect(Array.from(decode("mzxw6ytboi"))).toEqual(Array.from(enc.encode("foobar")))
    expect(Array.from(decode("mzxw6ytboi======"))).toEqual(Array.from(enc.encode("foobar")))
  })

  it("round-trips arbitrary bytes", () => {
    const bytes = Uint8Array.from([0, 1, 2, 3, 4, 5, 250, 251, 252, 253, 254, 255])
    expect(Array.from(decode(encode(bytes)))).toEqual(Array.from(bytes))
  })

  it("rejects invalid characters", () => {
    expect(() => decode("MZ8W6YTBOI")).toThrow()
  })
})