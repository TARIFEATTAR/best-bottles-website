#!/usr/bin/env node
/**
 * Grace ElevenLabs agent config — version-controlled seed script.
 *
 * Canonical config lives at:
 *   scripts/grace_agent_config.json
 *
 * Controlled fields (everything that shapes Grace's behavior):
 *   agent_id
 *   conversation_config.agent.prompt.llm              — e.g. "gpt-5"
 *   conversation_config.agent.prompt.reasoning_effort — "minimal" | "low" | "medium" | "high" | null
 *   conversation_config.agent.prompt.temperature
 *   conversation_config.agent.prompt.enable_parallel_tool_calls
 *   conversation_config.agent.prompt.prompt           — the full system prompt text
 *   conversation_config.agent.prompt.tools            — all 12 client-tool definitions
 *
 * Everything else (voice, webhooks, auth, coaching settings) stays whatever
 * it is on ElevenLabs — we don't touch it.
 *
 * Modes:
 *   --pull                  Live → file (overwrites scripts/grace_agent_config.json)
 *   --diff                  Show fields where live != file, no changes
 *   --apply                 File → live (dry-run by default)
 *   --apply --write         Actually PATCH the live agent
 *
 * Typical workflow:
 *   1. Someone edits the agent in the ElevenLabs dashboard.
 *   2. Run `node scripts/apply_grace_agent_config.mjs --pull` to capture state.
 *   3. `git diff` reviews what changed.
 *   4. Commit the diff.
 *
 * Or the reverse:
 *   1. Edit scripts/grace_agent_config.json in the repo (e.g. tweak the prompt).
 *   2. `--diff` to preview.
 *   3. `--apply --write` to push live.
 *   4. Commit + push.
 *
 * Env required (loaded from .env.local):
 *   ELEVENLABS_API_KEY
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CONFIG_PATH = resolve(__dirname, "grace_agent_config.json");

// ── Env ─────────────────────────────────────────────────────────────────────
try {
    const content = readFileSync(resolve(ROOT, ".env.local"), "utf8");
    for (const line of content.split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) {
            const key = m[1].trim();
            if (process.env[key] == null) {
                process.env[key] = m[2].trim().replace(/^["']|["']$/g, "");
            }
        }
    }
} catch { /* .env.local may not exist in CI */ }

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
    console.error("ELEVENLABS_API_KEY is not set. Aborting.");
    process.exit(1);
}

// ── Args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const MODE = argv.includes("--pull")
    ? "pull"
    : argv.includes("--diff")
        ? "diff"
        : argv.includes("--apply")
            ? "apply"
            : null;
const WRITE = argv.includes("--write");

if (!MODE) {
    console.error("Usage:");
    console.error("  node scripts/apply_grace_agent_config.mjs --pull");
    console.error("  node scripts/apply_grace_agent_config.mjs --diff");
    console.error("  node scripts/apply_grace_agent_config.mjs --apply           (dry-run)");
    console.error("  node scripts/apply_grace_agent_config.mjs --apply --write   (PATCH live)");
    process.exit(1);
}

// ── Colors ──────────────────────────────────────────────────────────────────
const G = "\x1b[32m", R = "\x1b[31m", Y = "\x1b[33m", D = "\x1b[2m", B = "\x1b[1m", X = "\x1b[0m";
const ok = (s) => console.log(`${G}✓${X} ${s}`);
const warn = (s) => console.log(`${Y}⚠${X} ${s}`);
const info = (s) => console.log(`${D}  ${s}${X}`);
const section = (s) => console.log(`\n${B}${s}${X}`);

// ── Load canonical file (for diff/apply) ────────────────────────────────────
function loadCanonical() {
    try {
        return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    } catch (err) {
        console.error(`Canonical config not found at ${CONFIG_PATH}`);
        console.error("Run with --pull first to seed it from the live agent.");
        console.error(`(${err.message})`);
        process.exit(1);
    }
}

// ── Fetch live agent ────────────────────────────────────────────────────────
async function fetchLive(agentId) {
    const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
        headers: { "xi-api-key": API_KEY },
    });
    if (!res.ok) {
        throw new Error(`ElevenLabs GET failed: HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
    }
    return await res.json();
}

// ── Extract controlled fields from a full agent dump ────────────────────────
function extract(full, agentId) {
    const p = full?.conversation_config?.agent?.prompt ?? {};
    return {
        agent_id: agentId,
        conversation_config: {
            agent: {
                prompt: {
                    llm: p.llm ?? null,
                    reasoning_effort: p.reasoning_effort ?? null,
                    temperature: p.temperature ?? null,
                    enable_parallel_tool_calls: p.enable_parallel_tool_calls ?? null,
                    prompt: p.prompt ?? "",
                    tools: p.tools ?? [],
                },
            },
        },
    };
}

// ── Deep diff — returns list of changed leaf paths ──────────────────────────
function deepDiff(a, b, path = "") {
    const diffs = [];
    if (typeof a !== typeof b) {
        diffs.push({ path, from: a, to: b });
        return diffs;
    }
    if (a === null || b === null || typeof a !== "object") {
        if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push({ path, from: a, to: b });
        return diffs;
    }
    if (Array.isArray(a)) {
        if (JSON.stringify(a) !== JSON.stringify(b)) {
            diffs.push({ path, from: `Array(${a.length})`, to: `Array(b.length=${b.length})` });
        }
        return diffs;
    }
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
        diffs.push(...deepDiff(a[k], b[k], path ? `${path}.${k}` : k));
    }
    return diffs;
}

function summarizeDiff(diffs) {
    if (diffs.length === 0) {
        ok("No differences — canonical matches live.");
        return;
    }
    warn(`${diffs.length} field(s) differ:`);
    for (const d of diffs) {
        const from = typeof d.from === "string" && d.from.length > 60 ? `"${d.from.slice(0, 57)}…"` : JSON.stringify(d.from);
        const to = typeof d.to === "string" && d.to.length > 60 ? `"${d.to.slice(0, 57)}…"` : JSON.stringify(d.to);
        console.log(`  ${d.path}`);
        console.log(`    canonical: ${from}`);
        console.log(`    live:      ${to}`);
    }
}

// ── PULL ────────────────────────────────────────────────────────────────────
async function runPull() {
    const existing = (() => { try { return JSON.parse(readFileSync(CONFIG_PATH, "utf8")); } catch { return null; } })();
    const agentId = existing?.agent_id ?? process.env.ELEVENLABS_AGENT_ID;
    if (!agentId) {
        console.error("No agent id known. Either create scripts/grace_agent_config.json with an `agent_id` field, or set ELEVENLABS_AGENT_ID.");
        process.exit(1);
    }
    section(`Pulling live agent ${agentId}`);
    const live = await fetchLive(agentId);
    const canonical = extract(live, agentId);
    writeFileSync(CONFIG_PATH, JSON.stringify(canonical, null, 2) + "\n");
    ok(`Wrote ${CONFIG_PATH}`);
    info(`Model:            ${canonical.conversation_config.agent.prompt.llm}`);
    info(`Reasoning:        ${canonical.conversation_config.agent.prompt.reasoning_effort}`);
    info(`Temperature:      ${canonical.conversation_config.agent.prompt.temperature}`);
    info(`Parallel tools:   ${canonical.conversation_config.agent.prompt.enable_parallel_tool_calls}`);
    info(`Prompt length:    ${canonical.conversation_config.agent.prompt.prompt.length} chars`);
    info(`Tool count:       ${canonical.conversation_config.agent.prompt.tools.length}`);
    console.log();
    info("Review the diff with `git diff`. Commit if intended.");
}

// ── DIFF ────────────────────────────────────────────────────────────────────
async function runDiff() {
    const canonical = loadCanonical();
    section(`Diffing canonical ⟷ live for ${canonical.agent_id}`);
    const live = extract(await fetchLive(canonical.agent_id), canonical.agent_id);
    const diffs = deepDiff(canonical.conversation_config, live.conversation_config, "conversation_config");
    summarizeDiff(diffs);
}

// ── APPLY ───────────────────────────────────────────────────────────────────
async function runApply() {
    const canonical = loadCanonical();
    section(`${WRITE ? "APPLY" : "DRY-RUN"} canonical → live for ${canonical.agent_id}`);
    const live = extract(await fetchLive(canonical.agent_id), canonical.agent_id);
    const diffs = deepDiff(canonical.conversation_config, live.conversation_config, "conversation_config");
    if (diffs.length === 0) {
        ok("Live already matches canonical — nothing to do.");
        return;
    }
    summarizeDiff(diffs);
    if (!WRITE) {
        console.log();
        warn("Dry-run only. Re-run with --apply --write to PATCH live.");
        return;
    }
    console.log();
    info("PATCHing live agent...");
    const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${canonical.agent_id}`, {
        method: "PATCH",
        headers: { "xi-api-key": API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_config: canonical.conversation_config }),
    });
    if (!res.ok) {
        console.error(`${R}✗${X} PATCH failed: HTTP ${res.status} — ${(await res.text()).slice(0, 500)}`);
        process.exit(2);
    }
    const updated = await res.json();
    const postCheck = extract(updated, canonical.agent_id);
    const residual = deepDiff(canonical.conversation_config, postCheck.conversation_config, "conversation_config");
    if (residual.length === 0) {
        ok("Live agent now matches canonical.");
    } else {
        warn(`${residual.length} field(s) still differ after PATCH (ElevenLabs may have rejected some values):`);
        summarizeDiff(residual);
    }
}

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
    try {
        if (MODE === "pull") await runPull();
        else if (MODE === "diff") await runDiff();
        else if (MODE === "apply") await runApply();
    } catch (err) {
        console.error(`${R}✗${X} ${err.message}`);
        process.exit(1);
    }
})();
