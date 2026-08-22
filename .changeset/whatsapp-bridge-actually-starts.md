---
"@theokit/gateway-whatsapp": patch
---

**The `web` backend never started.** Its bridge died 1011 ms into startup with `TypeError: LocalAuth is not a constructor`, on every version of `whatsapp-web.js` this package's peer range accepts.

The bridge read `Client` and `LocalAuth` off the module namespace. `whatsapp-web.js/index.js` ends its `module.exports` object with a spread, and `cjs-module-lexer` — which Node uses to synthesise named exports for a CommonJS module — cannot statically analyse an object built that way. It proved `Client` and gave up: measured on 1.34.7, `mod.LocalAuth` is `undefined` while `mod.default.LocalAuth` is a function. The API is now read off the default export, which is the whole `module.exports` value at runtime whatever the lexer could prove, with a namespace fallback for a true-ESM module.

**A present-but-incompatible package now says so.** The `try/catch` around the dynamic import guards against the package being *absent*; a resolved module missing a member sailed straight past it. The bridge now checks that both names are constructors and emits its structured error naming the one that is not — because telling a consumer to run `pnpm add` for a package they already have sends them the wrong way.

**What this does not fix.** The backend still cannot reach WhatsApp here: `puppeteer` is absent from `pnpm.onlyBuiltDependencies`, so no browser is ever downloaded. That failure is now *reported* rather than crashed on — `{"event":"error","message":"initialize failed: Could not find Chrome ..."}` on stdout, with the command to fix it — which is what lets the parent map it instead of waiting out a 120-second connect timeout. Provisioning a browser is tracked separately.

Nothing had ever executed this script: every test injects a fake child process, and the live suite excludes the web backend by declaration, so 132 green tests sat over a backend that could not start. Four tests now spawn the real thing, from a temporary directory so `LocalAuth` cannot leave a session folder behind.
