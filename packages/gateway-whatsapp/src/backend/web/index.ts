/**
 * `WhatsAppWebBackend` — `whatsapp-web.js` subprocess bridge backend (ADR D305).
 *
 * Lifecycle (T3.1) + IPC (T3.2) wired behind the `WhatsAppBackend` interface.
 * EC-6 absorbed: `connect()` races against a 120s timeout so unattended QR
 * pairings fail fast instead of hanging the app.
 *
 * @public
 */

import * as path from "node:path";
import type {
  WhatsAppBackend,
  WhatsAppInboundEvent,
  WhatsAppOutboundMessage,
  WhatsAppSendResult,
  WhatsAppStatusReceipt,
} from "../../backend-types.js";
import { mapWhatsAppWebError, WhatsAppConnectTimeoutError } from "../../errors.js";
import { formatCommand, type IpcEvent, LineBuffer, parseEvent } from "./ipc.js";
import { type BridgeHandle, spawnBridge, terminateBridge } from "./lifecycle.js";

export interface WhatsAppWebBackendOptions {
  readonly sessionId: string;
  /** Override the default bridge script path. Defaults to bundled script. */
  readonly bridgeScriptPath?: string;
  /** EC-6 connect timeout in ms. Default 120000. */
  readonly connectTimeoutMs?: number;
  /** Per-send timeout in ms. Default 30000. */
  readonly sendTimeoutMs?: number;
  /** Test seam: override the spawned child via a factory. */
  readonly spawnFactory?: () => BridgeHandle;
  /** Test seam: theokit home for PID locks. */
  readonly theokitHome?: string;
}

interface PendingSend {
  readonly resolve: (r: WhatsAppSendResult) => void;
  readonly timer: NodeJS.Timeout;
}

const DEFAULT_CONNECT_TIMEOUT_MS = 120_000;
const DEFAULT_SEND_TIMEOUT_MS = 30_000;

/**
 * WhatsApp backend driving `whatsapp-web.js` in a child process.
 *
 * Unofficial: it automates a WhatsApp Web session, which Meta's terms do not sanction and which can
 * get a number banned. It exists for a personal number that has no Cloud API access. The browser
 * runs out-of-process behind a PID lock so a crashed or orphaned bridge cannot be left holding the
 * session.
 */
export class WhatsAppWebBackend implements WhatsAppBackend {
  readonly kind = "web" as const;
  private handle?: BridgeHandle;
  private readonly buffer = new LineBuffer();
  private inboundHandler?: (event: WhatsAppInboundEvent) => Promise<void>;
  private statusHandler?: (receipt: WhatsAppStatusReceipt) => Promise<void>;
  private readonly pending = new Map<string, PendingSend>();
  private msgIdCounter = 0;
  private botPhone?: string;
  private connected = false;
  // EC-6: emitter resolvers for `event: "ready"`.
  private readyResolvers: Array<(phone: string) => void> = [];

  constructor(private readonly opts: WhatsAppWebBackendOptions) {}

  private spawnBridgeHandle(): NonNullable<typeof this.handle> {
    return this.opts.spawnFactory
      ? this.opts.spawnFactory()
      : spawnBridge({
          sessionId: this.opts.sessionId,
          bridgeScriptPath: this.opts.bridgeScriptPath ?? defaultBridgeScriptPath(),
          ...(this.opts.theokitHome !== undefined ? { theokitHome: this.opts.theokitHome } : {}),
        });
  }

  private wireStdout(): void {
    if (this.handle?.child.stdout === null || this.handle === undefined) return;
    this.handle.child.stdout.setEncoding("utf8");
    this.handle.child.stdout.on("data", (chunk: string) => {
      for (const line of this.buffer.push(chunk)) {
        const event = parseEvent(line);
        if (event !== null) this.dispatch(event);
      }
    });
  }

  private async cleanupHandle(): Promise<void> {
    if (this.handle === undefined) return;
    await terminateBridge(this.handle).catch(() => {});
    this.handle = undefined;
  }

  async connect(): Promise<boolean> {
    if (this.connected) return true;
    this.handle = this.spawnBridgeHandle();
    this.wireStdout();

    const timeoutMs = this.opts.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
    const ready = new Promise<string>((resolve) => this.readyResolvers.push(resolve));
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new WhatsAppConnectTimeoutError(timeoutMs)), timeoutMs);
    });

    try {
      const phone = await Promise.race([ready, timeout]);
      if (timer !== undefined) clearTimeout(timer);
      this.botPhone = phone;
      this.connected = true;
      return true;
    } catch (err) {
      if (timer !== undefined) clearTimeout(timer);
      await this.cleanupHandle();
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected || this.handle === undefined) return;
    try {
      if (this.handle.child.stdin !== null && !this.handle.child.stdin.destroyed) {
        this.handle.child.stdin.write(formatCommand({ cmd: "shutdown" }));
      }
    } catch {
      /* ignore */
    }
    await terminateBridge(this.handle);
    this.handle = undefined;
    this.connected = false;
    // Reject any pending sends.
    for (const [_, p] of this.pending) {
      clearTimeout(p.timer);
      p.resolve({ ok: false, error: { code: "server_error", message: "Bridge disconnected." } });
    }
    this.pending.clear();
    this.readyResolvers = [];
  }

  async send(message: WhatsAppOutboundMessage): Promise<WhatsAppSendResult> {
    if (!this.connected || this.handle === undefined || this.handle.child.stdin === null) {
      return { ok: false, error: { code: "server_error", message: "Bridge not connected." } };
    }
    const msgId = `out-${++this.msgIdCounter}`;
    const timeoutMs = this.opts.sendTimeoutMs ?? DEFAULT_SEND_TIMEOUT_MS;
    return new Promise<WhatsAppSendResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(msgId);
        resolve({
          ok: false,
          error: { code: "timeout", message: `Bridge send timed out after ${timeoutMs}ms.` },
        });
      }, timeoutMs);
      this.pending.set(msgId, { resolve, timer });
      try {
        this.handle!.child.stdin!.write(
          formatCommand({ cmd: "send", msgId, to: message.to, text: message.text }),
        );
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(msgId);
        resolve({
          ok: false,
          error: mapWhatsAppWebError(err instanceof Error ? err.message : String(err)),
        });
      }
    });
  }

  onInbound(handler: (event: WhatsAppInboundEvent) => Promise<void>): () => void {
    this.inboundHandler = handler;
    return () => {
      this.inboundHandler = undefined;
    };
  }

  onStatusReceipt(handler: (receipt: WhatsAppStatusReceipt) => Promise<void>): () => void {
    this.statusHandler = handler;
    return () => {
      this.statusHandler = undefined;
    };
  }

  private handleReady(event: Extract<IpcEvent, { event: "ready" }>): void {
    for (const r of this.readyResolvers) r(event.botPhone);
    this.readyResolvers = [];
  }

  private handleMessage(event: Extract<IpcEvent, { event: "message" }>): void {
    if (this.inboundHandler === undefined) return;
    const normalized: WhatsAppInboundEvent = {
      wamid: event.msgId,
      fromPhone: event.from,
      contactName: event.contactName,
      conversationType: event.isGroup ? "group" : "dm",
      channelId: event.chatId,
      text: event.body,
      receivedAt: event.timestamp || Date.now(),
      backend: "web",
      raw: event,
    };
    // The bridge's stdout listener is synchronous and does not await this, so the promise has to be
    // terminated here. `void` alone left the rejection unhandled, and under Node 22's default that
    // ends the process — one message with a throwing handler killed the bot (#41). A handler is
    // user code; its failure is contained and named, and the bridge keeps delivering.
    void this.inboundHandler(normalized).catch((err: unknown) => {
      const m = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[whatsapp-web] handler threw: ${m}\n`);
    });
  }

  private handleSendAck(event: Extract<IpcEvent, { event: "send_ack" }>): void {
    const pending = this.pending.get(event.msgId);
    if (pending === undefined) return;
    this.pending.delete(event.msgId);
    clearTimeout(pending.timer);
    if (event.success) {
      pending.resolve(event.wamid !== undefined ? { ok: true, wamid: event.wamid } : { ok: true });
    } else {
      pending.resolve({ ok: false, error: mapWhatsAppWebError(event.error) });
    }
  }

  private handleStatus(event: Extract<IpcEvent, { event: "status" }>): void {
    if (this.statusHandler === undefined) return;
    // Same boundary as handleMessage: nothing awaits this, so an unhandled rejection here is fatal.
    void this.statusHandler({
      wamid: event.msgId,
      status: event.status,
      recipient: event.recipient,
      timestamp: event.timestamp || Date.now(),
    }).catch((err: unknown) => {
      const m = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[whatsapp-web] status handler threw: ${m}\n`);
    });
  }

  private dispatch(event: IpcEvent): void {
    switch (event.event) {
      case "ready":
        this.handleReady(event);
        return;
      case "message":
        this.handleMessage(event);
        return;
      case "send_ack":
        this.handleSendAck(event);
        return;
      case "status":
        this.handleStatus(event);
        return;
      case "error":
        process.stderr.write(`[whatsapp-web bridge] ${event.message}\n`);
        return;
    }
  }
}

function defaultBridgeScriptPath(): string {
  // Points to the bundled script at `dist/bridge/whatsapp-web-bridge.mjs` once
  // the build copies it. Until then, callers can pass `bridgeScriptPath` directly.
  return path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    "../../bridge/whatsapp-web-bridge.mjs",
  );
}
