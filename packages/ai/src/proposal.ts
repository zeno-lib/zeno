import type { ChangeDescription, ChangeValue } from "@zeno-lib/db/next"

/** A described write waiting for the user, as the sealed proposal holds it. */
export type Proposal = {
  /** Unique per proposal: what `markUsed` records. */
  readonly id: string
  /** The write definition's name. */
  readonly tool: string
  /**
   * The input the model sent, raw: `describe` and `invoke` parse it themselves,
   * and a parsed input is not always valid input (a `transform`).
   */
  readonly input: unknown
  /** The user it was proposed to: the caller's `claims.sub`. */
  readonly user: string
  /** Each field's `from` as `describe` read it, in order. */
  readonly from: readonly (readonly [field: string, from: ChangeValue])[]
  /** When it stops being confirmable, in milliseconds since the epoch. */
  readonly expiresAt: number
}

export const MIN_SECRET_LENGTH = 32

// Domain separation: a MAC this route made for anything else never verifies.
const VERSION = "zp1"
const encoder = new TextEncoder()
const BASE64URL = /^[\w-]+$/u
// Base64 to base64url: `+` and `/` swapped, padding dropped.
const BASE64URL_OF: Record<string, string> = { "/": "_", "+": "-" }

const toBase64Url = (bytes: Uint8Array) => {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/[+/=]/gu, (c) => BASE64URL_OF[c] ?? "")
}

const fromBase64Url = (text: string) =>
  Uint8Array.from(
    atob(text.replace(/[-_]/gu, (c) => (c === "-" ? "+" : "/"))),
    (c) => c.charCodeAt(0)
  )

const isChangeValue = (value: unknown): value is ChangeValue =>
  value === null || ["boolean", "number", "string"].includes(typeof value)

// The payload is ours once the MAC verifies; this only guards a payload
// sealed by another version of this code with the same secret.
const isProposal = (value: unknown): value is Proposal => {
  const proposal = value as Partial<Proposal> | null
  return (
    typeof proposal === "object" &&
    proposal !== null &&
    typeof proposal.id === "string" &&
    typeof proposal.tool === "string" &&
    typeof proposal.user === "string" &&
    typeof proposal.expiresAt === "number" &&
    "input" in proposal &&
    Array.isArray(proposal.from) &&
    proposal.from.every(
      (entry) =>
        Array.isArray(entry) &&
        entry.length === 2 &&
        typeof entry[0] === "string" &&
        isChangeValue(entry[1])
    )
  )
}

/** The `from` of each field of a change, in the order `Proposal.from` keeps. */
export const fromValues = (change: ChangeDescription): Proposal["from"] =>
  change.changes.map(({ field, from }) => [field, from] as const)

/**
 * Whether `change` still starts where the proposal did: the same fields, in
 * the same order, each with the same `from`.
 */
export const startsFrom = (
  sealed: Proposal["from"],
  change: ChangeDescription
): boolean => {
  // Through JSON like the sealed values, so a `from` JSON can't keep
  // (`NaN`, `Infinity`, `undefined`) compares as it was sealed, not as stale.
  const now: Proposal["from"] = JSON.parse(JSON.stringify(fromValues(change)))
  return (
    sealed.length === now.length &&
    now.every(([field, from], index) => {
      const [sealedField, sealedFrom] = sealed[index] ?? []
      return sealedField === field && sealedFrom === from
    })
  )
}

/**
 * Seals proposals with HMAC-SHA-256 and opens them again. The first secret
 * seals; any of them opens, so a secret can be rotated without breaking the
 * proposals already shown.
 */
export function createProposalSeal(secrets: readonly string[]): {
  seal: (proposal: Proposal) => Promise<string>
  open: (token: string) => Promise<Proposal | null>
} {
  let keys: Promise<CryptoKey[]> | undefined
  const getKeys = () => {
    keys ??= Promise.all(
      secrets.map((secret) =>
        crypto.subtle.importKey(
          "raw",
          encoder.encode(secret),
          { hash: "SHA-256", name: "HMAC" },
          false,
          ["sign", "verify"]
        )
      )
    )
    return keys
  }
  const signed = (payload: string) => encoder.encode(`${VERSION}.${payload}`)

  return {
    open: async (token) => {
      const [version, payload, signature, ...rest] = token.split(".")
      if (
        version !== VERSION ||
        rest.length > 0 ||
        !(payload && signature) ||
        !(BASE64URL.test(payload) && BASE64URL.test(signature))
      ) {
        return null
      }
      let mac: Uint8Array<ArrayBuffer>
      try {
        mac = fromBase64Url(signature)
      } catch {
        // `atob` throws on a length no encoder makes (4n + 1).
        return null
      }
      const data = signed(payload)
      // `verify` compares in constant time.
      const verified = await Promise.all(
        (await getKeys()).map((key) =>
          crypto.subtle.verify("HMAC", key, mac, data)
        )
      )
      if (!verified.includes(true)) {
        return null
      }
      try {
        const proposal: unknown = JSON.parse(
          new TextDecoder().decode(fromBase64Url(payload))
        )
        return isProposal(proposal) ? proposal : null
      } catch {
        return null
      }
    },
    seal: async (proposal) => {
      const [key] = await getKeys()
      if (!key) {
        throw new TypeError("A proposal seal needs a secret")
      }
      const payload = toBase64Url(encoder.encode(JSON.stringify(proposal)))
      const mac = await crypto.subtle.sign("HMAC", key, signed(payload))
      return `${VERSION}.${payload}.${toBase64Url(new Uint8Array(mac))}`
    },
  }
}
