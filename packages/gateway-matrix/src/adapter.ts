/**
 * `MatrixAdapter` — implements BasePlatformAdapter over matrix-js-sdk.
 * ADRs D413-D421.
 *
 * @public
 */

import {
  BasePlatformAdapter,
  type MessageEvent as GatewayMessageEvent,
  type OutboundMessage,
  type SendResult,
} from "@theokit/gateway";

import { AliasCache } from "./alias.js";
import { loadMatrixSdk, type MatrixSdkClient } from "./client.js";
import { ConfigurationError } from "./errors.js";
import { matrixEventToMessageEvent } from "./normalize.js";
import { subscribeToTimeline, type TimelineSubscription } from "./sync.js";
import type { MatrixAdapterOptions, MatrixEventLike, MatrixRoomLike } from "./types.js";

const DEFAULT_FRESHNESS_MS = 60_000;
const INITIAL_SYNC_LIMIT = 10;

export class MatrixAdapter extends BasePlatformAdapter {
  readonly platform = "matrix" as const;
  private readonly opts: MatrixAdapterOptions;
  private client: MatrixSdkClient | undefined;
  private subscription: TimelineSubscription | undefined;
  private inboundHandler: ((event: GatewayMessageEvent) => Promise<void>) | undefined;
  private readonly aliasCache = new AliasCache();
  private connected = false;
  private readonly warnedEncrypted = new Set<string>();
  /** True only between disconnect() and the next connect() — see #12. */
  private tearingDown = false;

  /**
   * `fetch` for the SDK that leaves teardown aborts unsettled instead of
   * rejecting (#12).
   *
   * A request aborted while we are tearing the client down has no consumer left
   * that could act on the outcome, so an unsettled promise costs a continuation
   * and nothing else; the alternative is a rejection with no handler anywhere,
   * which ends the host process. It is scoped to the teardown window on purpose:
   * a consumer using the `getClient()` escape hatch (D421) may pass its own
   * abort signal to `search()` or `slidingSync()` and MUST still see those
   * rejections, so outside teardown every error propagates untouched.
   */
  private teardownSafeFetch(): typeof globalThis.fetch {
    const base = globalThis.fetch.bind(globalThis);
    return (input, init) =>
      base(input, init).catch((err: unknown) => {
        if (this.tearingDown && isAbortError(err)) {
          return new Promise<Response>(() => {
            /* deliberately never settles — see the doc comment */
          });
        }
        throw err;
      });
  }

  constructor(opts: MatrixAdapterOptions) {
    super();
    if (opts.homeserverUrl.length === 0) {
      throw new ConfigurationError({
        code: "homeserver_url_required",
        message: 'gateway-matrix: opts.homeserverUrl is empty (e.g. "https://matrix.org")',
      });
    }
    if (opts.accessToken.length === 0) {
      throw new ConfigurationError({
        code: "access_token_required",
        message:
          "gateway-matrix: opts.accessToken is empty (Element → Settings → Help & About → Advanced → Access Token)",
      });
    }
    if (opts.userId.length === 0 || !opts.userId.startsWith("@")) {
      throw new ConfigurationError({
        code: "user_id_required",
        message: 'gateway-matrix: opts.userId must be a Matrix user id (e.g. "@bot:matrix.org")',
      });
    }
    this.opts = opts;
  }

  async connect(): Promise<boolean> {
    if (this.connected) return true;
    this.tearingDown = false;
    try {
      const cfg = {
        baseUrl: this.opts.homeserverUrl,
        accessToken: this.opts.accessToken,
        userId: this.opts.userId,
        fetchFn: this.teardownSafeFetch(),
      };
      const factory = this.opts.__clientFactory;
      this.client =
        factory === undefined
          ? (await loadMatrixSdk()).createClient(cfg)
          : (factory(cfg) as MatrixSdkClient);
      // Validate the credential BEFORE reporting success. `startClient` kicks
      // off the sync loop asynchronously and resolves whether or not the token
      // is any good — so connect() used to answer `true` for a token the server
      // rejects, leaving an operator with a healthy-looking adapter and total
      // silence. Every sibling adapter returns false here; this one did not,
      // and only a real homeserver could show it.
      await this.client.whoami();
      await this.client.startClient({ initialSyncLimit: INITIAL_SYNC_LIMIT });
      this.attachSync();
      this.connected = true;
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[gateway-matrix] connect failed: ${msg}\n`);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    // Issue #12. `stopClient()` aborts the requests still in flight, and the
    // AbortError escapes as an UNHANDLED rejection — the rejecting promise is
    // the SDK's own `authedRequest` wrapper, which no caller catches and which
    // we cannot reach. Node has terminated on unhandled rejections by default
    // since v15, so an application calling disconnect() inside a reconnect loop
    // could be killed by its own clean shutdown. Measured against a real
    // homeserver: 7 occurrences in 8 connect/disconnect cycles.
    //
    // `teardownSafeFetch` closes it at the only seam the SDK offers. The flag is
    // set here, before the abort, and cleared by the next connect().
    this.tearingDown = true;
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    this.client?.stopClient();
    this.client = undefined;
    this.connected = false;
    this.inboundHandler = undefined;
    this.aliasCache.clear();
  }

  async sendMessage(out: OutboundMessage): Promise<SendResult> {
    if (out.text.length === 0) {
      return { ok: false, error: { code: "empty_text", message: "outbound text is empty" } };
    }
    if (this.client === undefined) {
      return {
        ok: false,
        error: { code: "not_connected", message: "MatrixAdapter.connect() not called" },
      };
    }
    try {
      const roomId = await this.aliasCache.resolve(this.client, out.channel.id);
      if (this.isEncrypted(roomId)) {
        this.warnEncryptedOnce(roomId);
        return {
          ok: false,
          error: {
            code: "encrypted_room_unsupported",
            message: `Matrix room ${roomId} is encrypted; E2EE deferred to v0.2`,
          },
        };
      }
      const res = await this.client.sendTextMessage(roomId, out.text);
      return { ok: true, messageId: res.event_id };
    } catch (err) {
      return mapMatrixError(err);
    }
  }

  onInbound(handler: (event: GatewayMessageEvent) => Promise<void>): () => void {
    // EC-H replace, not stack.
    this.inboundHandler = handler;
    return () => {
      if (this.inboundHandler === handler) this.inboundHandler = undefined;
    };
  }

  /** Escape hatch (D421) — caller can drive matrix-js-sdk directly for advanced features. */
  getClient(): MatrixSdkClient | undefined {
    return this.client;
  }

  /** Used by tests to install a mock SDK client + flip connected flag. */
  _installClient(client: MatrixSdkClient): void {
    this.client = client;
    this.connected = true;
    this.attachSync();
  }

  private attachSync(): void {
    if (this.client === undefined) return;
    const client = this.client;
    const opts = {
      botUserId: this.opts.userId,
      freshnessWindowMs: this.opts.freshnessWindowMs ?? DEFAULT_FRESHNESS_MS,
    };
    this.subscription = subscribeToTimeline(
      client,
      (ev: MatrixEventLike, room: MatrixRoomLike) => {
        void this.dispatchTimelineEvent(ev, room).catch((err: unknown) => {
          const m = err instanceof Error ? err.message : String(err);
          process.stderr.write(`[gateway-matrix] dispatchTimelineEvent failed: ${m}\n`);
        });
      },
      opts,
    );
  }

  private async dispatchTimelineEvent(event: MatrixEventLike, room: MatrixRoomLike): Promise<void> {
    if (this.isEncrypted(room.roomId)) {
      this.warnEncryptedOnce(room.roomId);
      return;
    }
    const normalized = matrixEventToMessageEvent(event, room);
    if (normalized === undefined) return;
    if (this.inboundHandler === undefined) return;
    try {
      await this.inboundHandler(normalized);
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[gateway-matrix] handler threw: ${m}\n`);
    }
  }

  private isEncrypted(roomId: string): boolean {
    if (this.client === undefined) return false;
    if (this.client.isRoomEncrypted === undefined) return false;
    try {
      return this.client.isRoomEncrypted(roomId);
    } catch {
      return false;
    }
  }

  private warnEncryptedOnce(roomId: string): void {
    if (this.warnedEncrypted.has(roomId)) return;
    this.warnedEncrypted.add(roomId);
    process.stderr.write(
      `[gateway-matrix] room ${roomId} is end-to-end encrypted; skipping (E2EE deferred to v0.2)\n`,
    );
  }
}

/**
 * Narrow abort detection. `DOMException.ABORT_ERR` is 20; the message check
 * covers runtimes that report the abort without the standard name or code.
 */
function isAbortError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { name?: unknown; code?: unknown; message?: unknown };
  if (e.name === "AbortError") return true;
  if (e.code === 20) return true;
  return typeof e.message === "string" && /aborted/i.test(e.message);
}

interface MatrixRestError {
  httpStatus?: number;
  errcode?: string;
  message?: string;
  name?: string;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: error mapping ladder is exhaustive — each branch maps one Matrix errcode/HTTP status to one canonical code; splitting hurts traceability.
function mapMatrixError(err: unknown): SendResult {
  const e = err as MatrixRestError;
  const status = e.httpStatus ?? 0;
  if (status === 429 || e.errcode === "M_LIMIT_EXCEEDED") {
    return { ok: false, error: { code: "rate_limit", message: e.message ?? "Matrix rate limit" } };
  }
  if (status === 401 || status === 403 || e.errcode === "M_FORBIDDEN") {
    return {
      ok: false,
      error: { code: "permission_denied", message: e.message ?? "Matrix permission error" },
    };
  }
  if (status === 404 || e.errcode === "M_NOT_FOUND") {
    return {
      ok: false,
      error: { code: "not_found", message: e.message ?? "Matrix resource not found" },
    };
  }
  return {
    ok: false,
    error: {
      code: "send_failed",
      message: e.message ?? (err instanceof Error ? err.message : String(err)),
    },
  };
}
