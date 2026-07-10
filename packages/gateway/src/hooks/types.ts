/**
 * Gateway hooks — own contract, not a `Plugin.kind` extension
 * (T4.1, ADRs D176, D177).
 *
 * Three fire points:
 *  - `pre_inbound`  — runs sequentially; first `{ block: true }` short-circuits.
 *  - `post_outbound` — fire-and-forget; errors logged.
 *  - `on_error`     — fire-and-forget; called when the handler throws.
 *
 * Signature mirrors the SDK's `pre_tool_call` veto (D101) so consumers
 * have a single mental model for "block or continue" hooks.
 *
 * @public
 */

import type { OutboundMessage, SendResult } from "../adapter/base.js";
import type { MessageEvent as GatewayMessageEvent } from "../types/message-event.js";

/** Closed enum of hook fire points. */
export type HookName = "pre_inbound" | "post_outbound" | "on_error";

/**
 * Decision returned by a `pre_inbound` hook.
 *
 * - `block: true` short-circuits the chain — handler does NOT run.
 * - `message` set → runner calls `ctx.reply(message)` BEFORE short-circuit (EC-D).
 * - `block: false` or `undefined` → continue.
 */
export interface HookDecision {
  readonly block?: boolean;
  readonly message?: string;
}

/** Context passed to `pre_inbound` hooks. */
export interface PreInboundContext {
  readonly event: GatewayMessageEvent;
}

/** Context passed to `post_outbound` hooks. */
export interface PostOutboundContext {
  readonly event: GatewayMessageEvent;
  readonly outbound: OutboundMessage;
  readonly result: SendResult;
}

/** Context passed to `on_error` hooks. */
export interface OnErrorContext {
  readonly event: GatewayMessageEvent;
  readonly error: Error;
}

/** A gateway hook: any of the three fire-point methods are optional. */
export interface GatewayHook {
  readonly name: string;
  // biome-ignore lint/suspicious/noConfusingVoidType: sync-or-async hook ergonomics — matches SDK pre_tool_call signature (D101).
  pre_inbound?(ctx: PreInboundContext): Promise<HookDecision | void> | HookDecision | void;
  post_outbound?(ctx: PostOutboundContext): Promise<void> | void;
  on_error?(ctx: OnErrorContext): Promise<void> | void;
}

// NOTE: the `HookExecutor` run engine lives in `./executor.ts` — this module is
// the contract (interfaces + the `HookName` enum) only, so the filename predicts
// its contents (see ADR / roadmap M0).
