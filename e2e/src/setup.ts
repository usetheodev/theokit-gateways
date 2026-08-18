/**
 * Vitest setup for the live suites.
 *
 * It exists for exactly one thing: matrix-js-sdk emits an unhandled AbortError
 * when `stopClient()` tears down a sync request that is still in flight. Every
 * assertion passes and the run still fails, because Vitest counts unhandled
 * errors — which is correct of Vitest, and the reason this filter is narrow.
 *
 * What is filtered: a rejection whose name or code identifies an abort, and
 * nothing else. Any other unhandled rejection still fails the run, because an
 * unhandled rejection is normally a bug and swallowing the category wholesale
 * would hide the next one.
 *
 * The underlying concern is recorded in `packages/gateway-matrix/src/adapter.ts`
 * rather than only here: Node terminates on unhandled rejections by default
 * since v15, so an application calling `disconnect()` in a reconnect loop is
 * exposed to the same thing. That is a product question, not a test one, and it
 * is not answered by this file.
 */

function isAbort(reason: unknown): boolean {
  if (typeof reason !== "object" || reason === null) return false;
  const e = reason as { name?: unknown; code?: unknown; message?: unknown };
  if (e.name === "AbortError") return true;
  // DOMException.ABORT_ERR — what the SDK surfaces through fetch.
  if (e.code === 20) return true;
  return typeof e.message === "string" && /aborted/i.test(e.message);
}

process.on("unhandledRejection", (reason) => {
  if (isAbort(reason)) {
    process.stderr.write(
      "[e2e] ignored an abort rejection during shutdown — see e2e/src/setup.ts\n",
    );
    return;
  }
  throw reason;
});
