#!/usr/bin/env node
/**
 * Grace AI Diagnostic — dependencies, API routes, and catalog tool chain.
 *
 * Run:
 *   pnpm diag:grace
 *   node scripts/diagnose_grace.mjs
 *
 * Optional:
 *   BASE_URL=https://bestbottles.company pnpm diag:grace   # production Next app (bestbottles.com is legacy PHP)
 *
 * Requires for section 2: dev server (or deployed site) for API checks.
 * Requires for section 3: NEXT_PUBLIC_CONVEX_URL — hits Convex directly (same path as Grace tools).
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

// Load .env.local if present (Node doesn't load it by default)
try {
    const envPath = resolve(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
} catch {
    /* ignore */
}

const BASE = process.env.BASE_URL || "http://localhost:3000";
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
const BASE_ORIGIN = new URL(BASE).origin;
const SERVER_TOOL_HEADERS = {
    "Content-Type": "application/json",
    Origin: BASE_ORIGIN,
};

async function check(name, fn) {
    try {
        const result = await fn();
        return { name, ok: true, detail: result };
    } catch (e) {
        return { name, ok: false, detail: String(e?.message ?? e) };
    }
}

/**
 * Validates Convex grace.* queries used by ElevenLabs server-tools and text-mode tools.
 */
async function runCatalogToolDiagnostics() {
    console.log("\n3. Grace catalog tools (Convex — grace.searchCatalog, etc.):");
    if (!CONVEX_URL) {
        console.log("   Skipped: NEXT_PUBLIC_CONVEX_URL / CONVEX_URL not set.");
        return { ok: true, skipped: true };
    }

    const client = new ConvexHttpClient(CONVEX_URL);
    let failed = false;

    const run = async (label, fn) => {
        try {
            const msg = await fn();
            console.log(`   [OK] ${label}: ${msg}`);
        } catch (e) {
            failed = true;
            console.log(`   [FAIL] ${label}: ${e?.message ?? e}`);
        }
    };

    await run("getCatalogStats", async () => {
        const s = await client.query(api.grace.getCatalogStats, {});
        const v = s?.totalVariants ?? 0;
        const g = s?.totalGroups ?? 0;
        if (typeof v !== "number" || v < 100) throw new Error(`unexpected totalVariants: ${v}`);
        if (typeof g !== "number" || g < 50) throw new Error(`unexpected totalGroups: ${g}`);
        return `${v} variants, ${g} groups`;
    });

    await run('searchCatalog("9ml cylinder", family Cylinder)', async () => {
        const rows = await client.query(api.grace.searchCatalog, {
            searchTerm: "9ml cylinder",
            familyLimit: "Cylinder",
        });
        if (!Array.isArray(rows) || rows.length === 0) {
            throw new Error("expected at least one product");
        }
        const first = rows[0];
        const sku = first.graceSku ?? "";
        const name = (first.itemName ?? "").slice(0, 50);
        return `${rows.length} rows; first SKU ${sku || "?"} — ${name}`;
    });

    await run("getFamilyOverview(Cylinder)", async () => {
        const o = await client.query(api.grace.getFamilyOverview, { family: "Cylinder" });
        if (!o || typeof o !== "object") throw new Error("missing overview object");
        const sizes = o.sizes;
        if (!Array.isArray(sizes) || sizes.length === 0) {
            throw new Error("expected sizes[] on overview");
        }
        return `${sizes.length} size entries`;
    });

    await run("getBottleComponents (from first 9ml hit)", async () => {
        const rows = await client.query(api.grace.searchCatalog, {
            searchTerm: "9ml cylinder glass",
            familyLimit: "Cylinder",
        });
        const sku = rows?.[0]?.graceSku;
        if (!sku) throw new Error("no SKU to test getBottleComponents");
        const comp = await client.query(api.grace.getBottleComponents, { bottleSku: sku });
        if (!comp?.bottle) throw new Error("getBottleComponents returned no bottle");
        return `SKU ${sku} → bottle + ${comp.components ? Object.keys(comp.components).length : 0} component groups`;
    });

    await run('checkCompatibility("17-415")', async () => {
        const fit = await client.query(api.grace.checkCompatibility, { threadSize: "17-415" });
        if (!Array.isArray(fit) || fit.length === 0) {
            throw new Error("expected fitment rows for 17-415");
        }
        return `${fit.length} compatible bottle references`;
    });

    return { ok: !failed, skipped: false };
}

async function main() {
    console.log("Grace AI Diagnostic\n");
    console.log("─".repeat(50));

    // 1. Env vars (from process — only what's available in Node)
    const hasConvex = !!process.env.NEXT_PUBLIC_CONVEX_URL;
    const hasElevenLabsKey = !!process.env.ELEVENLABS_API_KEY;
    const hasElevenLabsAgent = !!process.env.ELEVENLABS_AGENT_ID;
    console.log("\n1. Environment (this process):");
    console.log(`   NEXT_PUBLIC_CONVEX_URL: ${hasConvex ? "set" : "MISSING"}`);
    console.log(`   ELEVENLABS_API_KEY:     ${hasElevenLabsKey ? "set" : "MISSING"}`);
    console.log(`   ELEVENLABS_AGENT_ID:    ${hasElevenLabsAgent ? "set" : "MISSING"}`);
    console.log("   OPENAI_API_KEY:         (Convex env — set via `npx convex env set OPENAI_API_KEY xxx`)");

    let exitCode = 0;

    // 2. API routes (requires dev server)
    console.log("\n2. API routes (requires app reachable at " + BASE + "):");
    const signedUrl = await check("signed-url", async () => {
        const r = await fetch(BASE + "/api/elevenlabs/signed-url");
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${body.error ?? "Unknown"}`);
        if (!body.signedUrl) throw new Error("No signedUrl in response");
        return `OK (${body.signedUrl?.slice?.(0, 50) ?? "unknown"}...)`;
    });
    console.log(`   /api/elevenlabs/signed-url: ${signedUrl.ok ? signedUrl.detail : "FAIL — " + signedUrl.detail}`);
    if (!signedUrl.ok) exitCode = 1;

    const serverTools = await check("server-tools getCatalogStats", async () => {
        const r = await fetch(BASE + "/api/elevenlabs/server-tools", {
            method: "POST",
            headers: SERVER_TOOL_HEADERS,
            body: JSON.stringify({ tool_name: "getCatalogStats", parameters: {} }),
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${body.error ?? "Unknown"}`);
        if (body.error) throw new Error(String(body.error));
        const v = body.result?.totalVariants;
        if (typeof v !== "number") throw new Error("result.totalVariants missing");
        return `OK (${v} variants)`;
    });
    console.log(`   /api/elevenlabs/server-tools (getCatalogStats): ${serverTools.ok ? serverTools.detail : "FAIL — " + serverTools.detail}`);
    if (!serverTools.ok) exitCode = 1;

    const serverSearch = await check("server-tools searchCatalog", async () => {
        const r = await fetch(BASE + "/api/elevenlabs/server-tools", {
            method: "POST",
            headers: SERVER_TOOL_HEADERS,
            body: JSON.stringify({
                tool_name: "searchCatalog",
                parameters: { searchTerm: "boston round 15ml", familyLimit: "Boston Round" },
            }),
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${body.error ?? "Unknown"}`);
        if (body.error) throw new Error(String(body.error));
        const res = body.result;
        if (Array.isArray(res) && res.length > 0) return `OK (${res.length} products)`;
        if (typeof res === "string" && res.length > 20) return `OK (text result, ${res.length} chars)`;
        throw new Error(`unexpected result shape: ${typeof res}`);
    });
    console.log(`   /api/elevenlabs/server-tools (searchCatalog): ${serverSearch.ok ? serverSearch.detail : "FAIL — " + serverSearch.detail}`);
    if (!serverSearch.ok) exitCode = 1;

    const conversationToken = await check("conversation-token", async () => {
        const r = await fetch(BASE + "/api/elevenlabs/conversation-token");
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${body.error ?? "Unknown"}`);
        if (!body.token) throw new Error("No token in response");
        return "OK";
    });
    console.log(`   /api/elevenlabs/conversation-token: ${conversationToken.ok ? conversationToken.detail : "FAIL — " + conversationToken.detail}`);
    if (!conversationToken.ok) exitCode = 1;

    const catalogDiag = await runCatalogToolDiagnostics();
    if (!catalogDiag.skipped && !catalogDiag.ok) exitCode = 1;

    console.log("\n4. Common fixes:");
    if (!signedUrl.ok) {
        console.log("   • Voice: Ensure ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID in .env.local.");
        console.log("   • Restart dev server after changing env vars.");
        console.log("   • If you see HTTP 404: start the app (`pnpm dev`) or set BASE_URL to a deployed origin.");
    }
    if (!serverTools.ok || !serverSearch.ok) {
        console.log("   • Server tools: Ensure NEXT_PUBLIC_CONVEX_URL is set and Convex deployment is reachable.");
    }
    if (catalogDiag.skipped) {
        console.log("   • Catalog section: Set NEXT_PUBLIC_CONVEX_URL in .env.local to validate grace.* queries.");
    }
    console.log("   • Text mode / portal Grace: Ensure OPENAI_API_KEY is set in Convex:");
    console.log("     npx convex env set OPENAI_API_KEY sk-...");
    console.log("   • If voice drops immediately: Known issue — text mode works as fallback.");
    console.log("\n   More catalog coverage: pnpm test:grace:matrix");
    console.log("\n" + "─".repeat(50));
    console.log(exitCode === 0 ? "Done — all checks passed." : "Done — some checks failed (see above).");
    process.exit(exitCode);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
