/**
 * Lazy `@line/bot-sdk` loader + thin Client wrapper for sending.
 */

import { SDKNotInstalledError } from "./errors.js";

export interface LineSdkClient {
  replyMessage(
    replyToken: string,
    messages: Array<{ type: "text"; text: string }>,
  ): Promise<unknown>;
  pushMessage(to: string, messages: Array<{ type: "text"; text: string }>): Promise<unknown>;
}

/**
 * The v9 `MessagingApiClient` surface, as declared by the installed
 * `@line/bot-sdk` v9 `messagingApiClient.d.ts`. Both methods take ONE request
 * object — this is not the same shape as {@link LineSdkClient}, and conflating
 * the two is what broke every outbound message before 2026-08-17.
 */
interface LineV9Client {
  replyMessage(request: {
    replyToken: string;
    messages: Array<{ type: "text"; text: string }>;
  }): Promise<unknown>;
  pushMessage(
    request: { to: string; messages: Array<{ type: "text"; text: string }> },
    xLineRetryKey?: string,
  ): Promise<unknown>;
}

interface LineSdkModule {
  Client: new (cfg: { channelAccessToken: string; channelSecret?: string }) => LineSdkClient;
  messagingApi?: {
    MessagingApiClient: new (cfg: { channelAccessToken: string }) => LineV9Client;
  };
}

export async function loadLineSdk(): Promise<LineSdkModule> {
  try {
    const mod = await import("@line/bot-sdk");
    return mod as unknown as LineSdkModule;
  } catch {
    throw new SDKNotInstalledError("@line/bot-sdk");
  }
}

/**
 * Build a client exposing the positional {@link LineSdkClient} shape the adapter
 * calls, from either the legacy (`Client`) or the v9
 * (`messagingApi.MessagingApiClient`) SDK.
 *
 * The v9 client is WRAPPED, not returned directly. An earlier version returned
 * it as-is on the claim that "v9 SDK exposes both styles" — it does not. v9
 * declares `replyMessage(request)` and `pushMessage(request, retryKey?)`, each
 * taking a single object, so the adapter's positional call arrived as
 * `{replyToken: undefined, messages: undefined}` and LINE rejected every send
 * with a 400. Since `@line/bot-sdk` is pinned at `^9.0.0`, this branch is the
 * one that always runs: the bug was total, not conditional.
 */
export function makeClient(
  mod: LineSdkModule,
  cfg: { channelAccessToken: string; channelSecret: string },
): LineSdkClient {
  const v9 = mod.messagingApi?.MessagingApiClient;
  if (v9 !== undefined) {
    const client = new v9({ channelAccessToken: cfg.channelAccessToken });
    return {
      async replyMessage(replyToken, messages) {
        return client.replyMessage({ replyToken, messages });
      },
      async pushMessage(to, messages) {
        return client.pushMessage({ to, messages });
      },
    };
  }
  return new mod.Client(cfg);
}
