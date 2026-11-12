// What the server and the approval card agree on. The card's bundle imports
// this file, so it holds constants and types only.
import type { ChangeDescription } from "@zeno-lib/db/next"

/** The app-only tool the card's Confirm calls with the proposal. */
export const APPLY_TOOL = "apply_change"

/** The card's UI resource, linked from every propose tool. */
export const CARD_URI = "ui://zeno-lib/change-approval.html"

/** The `_meta` key that carries the sealed proposal to the card. */
export const PROPOSAL_META_KEY = "zeno-lib/proposal"

/** Why `apply_change` refused a proposal. */
export type ProposalRefusal =
  /** The proposal is not one this server sealed, or names a tool it doesn't serve. */
  | "invalid"
  /** The proposal is past its expiry. */
  | "expired"
  /** The proposal was made for another user. */
  | "wrong-user"
  /** The record changed since the proposal: `change` is what confirming would do now. */
  | "stale"
  /** The proposal was already applied once. */
  | "used"

/**
 * The `structuredContent` the card renders: from a propose tool (`proposed`)
 * and from `apply_change`. A `stale` result carries a fresh proposal in
 * `_meta`, for the new change.
 */
export type ApprovalContent =
  | {
      readonly status: "proposed" | "applied" | "stale"
      readonly change: ChangeDescription
    }
  | {
      /** `failed`: the write ran and threw, or a form write refused its input. */
      readonly status: Exclude<ProposalRefusal, "stale"> | "failed"
      readonly message: string
    }
