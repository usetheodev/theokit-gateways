/**
 * Public option types + minimal Matrix shape narrowing (kept local so
 * we don't force `matrix-js-sdk` types on consumers).
 *
 * @public
 */

export interface MatrixAdapterOptions {
  /** Homeserver URL (e.g. `https://matrix.org`). No trailing slash. (D414) */
  readonly homeserverUrl: string;
  /** Long-lived access token (`syt_xxx`). Generate via Element → Settings → Help & About → Advanced. */
  readonly accessToken: string;
  /** Bot's full Matrix user id (`@bot:matrix.org`). */
  readonly userId: string;
  /**
   * EC-3 freshness window in milliseconds — events older than this on
   * initial sync are dropped. Default 60000 (60s).
   */
  readonly freshnessWindowMs?: number;
  /**
   * Test seam — inject a client instead of building one from the SDK.
   *
   * Mirrors `__imapFactory` in gateway-email and `__appFactory` in
   * gateway-teams. It exists so `connect()` itself can be unit-tested, including
   * the credential check: `_installClient` bypasses connect() entirely, so
   * without this the only coverage of that path was the live suite.
   *
   * @internal
   */
  readonly __clientFactory?: (opts: {
    baseUrl: string;
    accessToken: string;
    userId: string;
  }) => unknown;
}

/**
 * Minimal subset of `MatrixEvent` we read. Real events from
 * `matrix-js-sdk` carry many more methods — preserved via
 * `event.matrix.raw`.
 *
 * @public
 */
export interface MatrixEventLike {
  getId(): string | undefined;
  getSender(): string | undefined;
  getRoomId(): string | undefined;
  getType(): string;
  getContent(): { body?: string; msgtype?: string };
  getTs(): number;
}

/**
 * Minimal subset of `Room` (sync timeline target).
 *
 * @public
 */
export interface MatrixRoomLike {
  readonly roomId: string;
  getJoinedMemberCount(): number;
  name?: string;
}
