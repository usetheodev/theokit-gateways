# Test Runbook — Telegram Pro

A full production pass. Run the phases in order; each one is independent.

**Bot under test**: `@theo_paulo_bot` (id `8982152421`) — ILLUSTRATIVE. This handle and id appear
nowhere in the example's code; they were one person's development bot. Substitute your own
throughout, and treat every `@handle` below the same way.
**Clean workspace**: `.theokit/` deleted, so the next `/start` creates a fresh agent

---

## How to use this runbook

For each step:
1. **Send** -> the exact text or command
2. **Expect** -> how the bot should reply
3. ✅ **Pass** -> what has to be true for the step to count as passing
4. 🔍 **Log** -> what to look for in the bot's terminal when something does not match

If a step fails, **move on to the next one** and note it at the end. Do not get stuck.

---

## Phase 0 — Boot + identity (1 minute)

### 0.1 — Connection

| Step | Detail |
|---|---|
| 🎯 | Open Telegram and start a chat with `@theo_paulo_bot` |
| 📤 Send | `/start` |
| 📥 Expect | Welcome message + your user id + agent id `tg-pro-dm-<your-id>` |
| ✅ Pass | You see the agent id in the form `tg-pro-dm-<num>` |
| 🔍 Log | `user=<your-id> chat=private text=/start` |

### 0.2 — Help

| Step | Detail |
|---|---|
| 📤 Send | `/help` |
| 📥 Expect | A list of 11 commands: `/start /help /me /recall /wiki /agents /skills /summary /cron /remind /reset` |
| ✅ Pass | All 11 are present, plus the section "Modes detected automatically" |

---

## Phase 1 — Memory + persistence (3 minutes)

### 1.1 — Auto-write via "Remember:"

| 📤 | `Remember: meu time é Corinthians` |
|---|---|
| 📥 | A confirmation ("Got it" or similar) |
| ✅ | The saved fact appears |
| 🔍 | On disk: `.theokit/memory/MEMORY.md` should contain `- meu time é Corinthians` |

### 1.2 — Mais um fato

| 📤 | `Remember: meu editor favorito é Helix` |
|---|---|
| ✅ | Same confirmation |

### 1.3 — List facts (no LLM)

| 📤 | `/me` |
|---|---|
| 📥 | `1. meu time é Corinthians\n2. meu editor favorito é Helix` (ou similar) |
| ✅ | Os 2 fatos aparecem numerados |

### 1.4 — Session recall via memory_search

| 📤 | `/recall corinthians` |
|---|---|
| 📥 | Finds the conversation where you mentioned Corinthians |
| ✅ | The LLM quotes the earlier turn and does NOT say "memory_search not available" |
| 🔍 | `[bot] result status=finished` no log |

### 1.5 — The LLM uses memory in ordinary conversation

| 📤 | `Sugere uma decoração de quarto baseada nas minhas preferências` |
|---|---|
| 📥 | LLM relaciona Helix ou Corinthians de alguma forma |
| ✅ | The reply is not generic — it incorporates the facts |

---

## Phase 2 — Filesystem + Shell + Policy (3 minutes)

### 2.1 — Shell tool: list directory

| 📤 | `Lista os arquivos do diretório atual` |
|---|---|
| 📥 | A listing including `package.json`, `src`, `README.md`, `.theokit`, etc. |
| ✅ | You see the workspace's real files; it does NOT invent them |

### 2.2 — Policy hook block (CRITICAL)

| 📤 | `roda rm -rf /` |
|---|---|
| 📥 | Bot recusa e cita a policy: "Policy denied" ou similar |
| ✅ | **Does NOT execute**. You see the word "blocked", "policy", ou "denied" in the reply |
| 🔍 | The log does NOT show files disappearing |

### 2.3 — MCP write_file (action bias)

| 📤 | `Cria notas.md com 5 itens da minha lista de compras` |
|---|---|
| 📥 | "Criei notas.md com [5 itens]" — escolhe sozinho (leite, pão, etc.) |
| ✅ | **Does NOT ask** "which content?". The file `notas.md` appears in the directory |
| 🔍 | `cat ../../../theokit-sdk/examples/telegram-pro/notas.md` shows 5 lines — **file missing hoje** (verificado 2026-08-06) |

### 2.4 — MCP read_text_file

| 📤 | `Lê o package.json e me diz qual a versão do TypeScript` |
|---|---|
| 📥 | A reply carrying the version (e.g. `^5.8.0`) |
| ✅ | Cita um número de versão real |

### 2.5 — Create and read another file

| 📤 | `Cria diario.md com 3 itens do dia de hoje em formato bullet` |
|---|---|
| 📥 | Confirms creation |
| 📤 | `Que arquivos .md tem no diretório?` |
| 📥 | A listing including notas.md + diario.md |
| ✅ | Both visíveis |

---

## Phase 3 — Vision multi-modal (2 minutes)

### 3.1 — Static sticker

| 📤 | (manda QUALQUER sticker estático — não animado) |
|---|---|
| 📥 | Descrição em 1-2 frases do que vê |
| ✅ | Descrição específica (cor, emoção, forma) — NOT genérica |
| 🔍 | `[sticker] described (cached=false) in XXXms: ...` |

### 3.2 — Same sticker (cache hit)

| 📤 | (send the SAME sticker again) |
|---|---|
| 📥 | Mesma descrição (ou continuação) |
| ✅ | The reply arrives in under 1s |
| 🔍 | `[sticker] described (cached=true) in 0ms: ...` ← **cache hit** |

### 3.3 — Foto com caption

| 📤 | (foto qualquer com legenda) `"isso parece um cachorro?"` |
|---|---|
| 📥 | A reply based on what it SEES plus the question |
| ✅ | It combines both — does not ignore the photo or the caption |

---

## Phase 4 — Inline Buttons (2 minutes)

### 4.1 — Forçar buttons em conversa

| 📤 | `Sugere 3 restaurantes em São Paulo` |
|---|---|
| 📥 | Lista 3 opções **com botões clicáveis abaixo** |
| ✅ | Aparecem 3 botões tipo `[Restaurante A]` `[Restaurante B]` `[Restaurante C]` |

### 4.2 — Tap continua a conversa

| 📤 | (toca um dos botões) |
|---|---|
| 📥 | Bot continua naturalmente como se você tivesse digitado |
| ✅ | NOT pede pra você "escolher de novo" |
| 🔍 | Log: `text=[user tapped button: ...]` |

### 4.3 — Caso destrutivo (yes/no)

| 📤 | `Quero apagar todas minhas notas` |
|---|---|
| 📥 | Bot oferece `[Sim] [Não]` ou similar |
| ✅ | Aparecem botões de confirmação |
| 📤 | (toca "Não") |
| 📥 | Bot confirma que not apagou |

---

## Phase 5 — Skills + Subagents + Wiki (3 minutes)

### 5.1 — Listar skills

| 📤 | `/skills` |
|---|---|
| 📥 | 2 skills: `recipe-suggest` + `morning-routine` com descrições |
| ✅ | Both appear, with a full description |

### 5.2 — Skill em ação

| 📤 | `me sugere uma receita rápida pro jantar` |
|---|---|
| 📥 | LLM dá uma receita estruturada (ingredients + steps) |
| ✅ | The format broadly follows the skill (not just free text) |

### 5.3 — Subagents (honest about being cloud-only)

| 📤 | `/agents` |
|---|---|
| 📥 | Lista `code_writer` + `researcher` + **disclaimer "cloud-only no v1.0"** |
| ✅ | The message is honest about the limitation |

### 5.4 — Wiki search (server-side)

| 📤 | `/wiki tools` |
|---|---|
| 📥 | Excerpt do `tools.md` com lista de tools disponíveis |
| ✅ | You see o content formatado em code block |

### 5.5 — Wiki second file

| 📤 | `/wiki deployment` |
|---|---|
| 📥 | Excerpt do `deployment.md` com notas de deploy |
| ✅ | Content appears (not "no entries") |

### 5.6 — Wiki miss

| 📤 | `/wiki blockchain` |
|---|---|
| 📥 | `Does not há entrada na wiki sobre "blockchain".` |
| ✅ | A clear miss reply, does not invent content |

---

## Phase 6 — Cron + Dreaming (3 minutes)

### 6.1 — Lista cron jobs

| 📤 | `/cron` |
|---|---|
| 📥 | At least 1 job: `tg-pro:nightly-dream` scheduled for `0 3 * * *` |
| ✅ | Próxima execução visível |

### 6.2 — Create reminder

| 📤 | `/remind */2 * * * * \| beba água` |
|---|---|
| 📥 | "Reminder scheduled: cron-..." + próximo fire |
| ✅ | ID retornado começa com `tg-pro:remind:` |

### 6.3 — Reminder fires (wait 2 min)

| ⏰ | (Wait 2 minutes doing nothing) |
|---|---|
| 📥 | The log shows the cron firing — it does not have to be a Telegram delivery (the reminder triggers an internal `agent.send`) |
| 🔍 | Log: `[bot] result status=finished` em horário par |

### 6.4 — Dreaming sweep on-demand

| 📤 | `/summary` |
|---|---|
| 📥 | Status: `Sweep status: ok` + estatísticas (facts before/after, duplicates removed, clusters) |
| ✅ | At least `Facts: 2 -> 2` (it must not regress) |
| 🔍 | `.theokit/memory/notes/` should contain um file `cluster-XXX.md` |

### 6.5 — Remove reminder

| 📤 | `/cron` (anota o ID do reminder) |
|---|---|
| 📤 | (to stop before continuing): in another terminal, `rm -rf .theokit/cron/jobs.json` and restart the bot. Skip this passo se não tiver acesso. |

---

## Phase 7 — Reset + Restart-proof (4 minutes)

### 7.1 — Reset thread

| 📤 | `/reset` |
|---|---|
| 📥 | "Thread cleared. Memory facts preserved" |
| ✅ | Confirma reset SEM apagar /me facts |

### 7.2 — Verifica /me preservado

| 📤 | `/me` |
|---|---|
| 📥 | Still shows Corinthians + Helix |
| ✅ | Fatos sobreviveram ao reset |

### 7.3 — `/start` fresh thread

| 📤 | `/start` |
|---|---|
| 📥 | Boas-vindas (thread nova, mas user-id same) |
| ✅ | Funciona — `/me` continua mostrando os fatos |

### 7.4 — Restart-proof (CRITICAL — needs a terminal)

| 🛠️ | No terminal do bot: `Ctrl+C` |
|---|---|
| 📥 | Bot mostra "Shutting down — your data is safe on disk" |
| 🛠️ | `pnpm dev` (reinicia) |
| 📥 | Bot reconecta — log "Connected as @theo_paulo_bot" |
| 📤 | (in Telegram, without running /start) `me lembra do meu time?` |
| 📥 | LLM responde "Corinthians" — **prova que o restart preservou estado** |
| ✅ | **Memória sobreviveu kill-9 + restart** |

---

## Phase 8 — Error display (1 minute)

### 8.1 — Forçar rate-limit (opcional)

| 📤 | Manda 10-15 mensagens rápidas em <30s |
|---|---|
| 📥 | Eventualmente: `⚠️ Run falhou sem evento (provavelmente rate-limit do OpenRouter...)` |
| ✅ | A **clear message** about the rate limit (not a bare "(run error)" with no detail) |

### 8.2 — Verifica log estruturado

| 🔍 | No log do bot, runs que falharam têm: `[bot] run failed (error/<code>): <mensagem>` |
|---|---|
| ✅ | Códigos visíveis: `agent_loop_failed`, `mcp_init_failed`, etc. |

---

## Phase 9 — Grupo + Forum (OPCIONAL, 5 min)

> Skip this if you do not want to set up a group now.

### 9.1 — Create grupo + adiciona bot

1. No Telegram: `+ New Group` → nome qualquer
2. Add member: `@theo_paulo_bot`
3. (Still in Telegram) `@BotFather` → `/mybots` → `@theo_paulo_bot` → `Bot Settings` → `Group Privacy` → **Disable**

### 9.2 — Bot fica calado sem mention

| 📤 | (no grupo) `oi pessoal` |
|---|---|
| 📥 | Bot **not responde** |
| ✅ | Group policy ativa |

### 9.3 — Bot responde com mention

| 📤 | (no grupo) `@theo_paulo_bot oi` |
|---|---|
| 📥 | Bot responde |
| ✅ | Mention gating funciona |

### 9.4 — Forum topics (CONFIG do grupo)

1. Long-press no nome do grupo → `Edit` → liga `Topics`
2. Create topic `#trabalho` e `#casa`

### 9.5 — Topics isolados

| 📤 | (no #trabalho) `@theo_paulo_bot meu projeto se chama Apollo` |
|---|---|
| 📥 | Bot confirma |
| 📤 | (no #casa) `@theo_paulo_bot qual nome do projeto?` |
| 📥 | Bot **not sabe** (session diferente) |
| ✅ | Topics são threads isoladas |
| 📤 | (volta ao #trabalho) `@theo_paulo_bot qual nome do projeto?` |
| 📥 | Bot responde "Apollo" |

---

## Critério de aceitação final

Pra considerar **production-ready**:

- ✅ Fases 0-7 todas passam (8 e 9 são opcionais)
- ✅ Bot sobrevive `kill -9` com memory + sessions preservadas
- ✅ Policy hook bloqueia `rm -rf /`
- ✅ Action bias works (`Cria X com Y` does not ask back)
- ✅ `/wiki` funciona deterministicamente (server-side)
- ✅ Vision cache visível (segundo sticker em <1s)
- ✅ Error messages are informative (`/recall`, run errors)

**Se TODOS os critérios acima passarem, o bot está production-ready.**

---

## Como reportar bugs

For each failure, open an issue or send me:

```
### Phase X.Y — <título do passo>
**Esperava**: <reply esperada>
**Aconteceu**: <reply real>
**Log**: <the log line carrying [bot] ... ou [voice]/[sticker]/etc>
**Reprodução**: <texto exato mandado>
```

---

## File state during the run

```
examples/telegram-pro/
├── notas.md                            ← criado em 2.3
├── diario.md                           ← criado em 2.5
└── .theokit/
    ├── agents/
    │   ├── registry.json               <- now stale-free
    │   └── tg-pro-dm-<userId>/messages.jsonl
    ├── memory/
    │   ├── MEMORY.md                   ← Corinthians + Helix
    │   ├── sessions/<runId>.md         ← 1 por run finished
    │   ├── notes/cluster-XXX.md        ← criado por /summary
    │   └── wiki/
    │       ├── tools.md
    │       └── deployment.md
    ├── cache/vision/<sha>.txt          ← descriptions cache
    ├── hooks.json                      ← policy hook
    ├── policy.js
    ├── skills/recipe-suggest/SKILL.md
    ├── skills/morning-routine/SKILL.md
    ├── plugins.json
    └── context.json
```

Inspect any file during the run with `cat` ou `tree .theokit`.
