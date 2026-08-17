import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Real APIs are slow and rate-limited. The default 5s is a false negative
    // waiting to happen; individual round trips raise this further.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // One platform at a time. Parallel files would race for the same test chat
    // and interleave their messages, and a shared rate limit turns that into
    // flakiness that looks like a product bug.
    fileParallelism: false,
    sequence: { concurrent: false },
    // A live suite that retries hides an intermittent contract break, which is
    // exactly the thing these tests exist to catch.
    retry: 0,
  },
});
