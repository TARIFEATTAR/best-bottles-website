#!/usr/bin/env node
/**
 * Grace AI — targeted diagnostic probe for the v8.3 enrichment migration
 * and well-known failure modes.
 *
 * Usage:
 *   node scripts/grace_v83_probe.mjs
 *
 * Sends ~12 probe questions to askGrace, captures Grace's answer + tool trace,
 * and scores each with deterministic rules against Convex truth.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
    const envPath = path.resolve(__dirname, "..", ".env.local");
    try {
        const raw = fs.readFileSync(envPath, "utf-8");
        for (const line of raw.split("\n")) {
            const t = line.trim();
            if (!t || t.startsWith("#")) continue;
            const i = t.indexOf("=");
            if (i < 0) continue;
            const k = t.slice(0, i).trim();
            let v = t.slice(i + 1).trim();
            if (v.includes("#")) v = v.slice(0, v.indexOf("#")).trim();
            v = v.replace(/^["']|["']$/g, "");
            if (!process.env[k]) process.env[k] = v;
        }
    } catch {}
}
loadEnvLocal();

const URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
if (!URL) {
    console.error("Missing NEXT_PUBLIC_CONVEX_URL");
    process.exit(1);
}
const client = new ConvexHttpClient(URL);

// 12 targeted probes — organized by category matching the skill's framework.
// Each probe: {id, category, question, check(response, toolTrace) -> {pass, reasons}}
const probes = [
    // Category A — SKU Existence / Phantom SKU
    {
        id: "A-phantom",
        category: "SKU Existence",
        question:
            "Do you sell a GB-FAKE-1234 bottle? Tell me about it.",
        check: (text) => {
            const t = text.toLowerCase();
            const declines = /don't have|don't carry|not found|no match|no such|can't find|doesn('?)t exist|does not exist|isn('?)t in|not in our catalog|won'?t invent/.test(t);
            const hallucinates = /\b(neck thread|thread size|\d+\s?ml capacity|case of \d+|\$\d)/.test(t) && /gb-fake-1234/.test(t) && !declines;
            return {
                pass: declines && !hallucinates,
                note: declines ? "Declined cleanly" : hallucinates ? "HALLUCINATED features for fake SKU" : "Ambiguous decline",
            };
        },
    },
    {
        id: "A-out-of-range",
        category: "SKU Existence",
        question: "I need a 500ml glass bottle for a body wash.",
        // Catalog max bottles are ~250ml. Grace should either offer closest or acknowledge limit.
        check: (text) => {
            const t = text.toLowerCase();
            const claims500 = /\b500\s*ml\b/.test(t) && !/don't|not available|closest/i.test(t);
            const honestAboutLimit = /don't (have|stock|carry)|largest|closest|up to|maximum/i.test(t);
            return {
                pass: !claims500 || honestAboutLimit,
                note: claims500 && !honestAboutLimit ? "Claims 500ml exists" : "Handled capacity gap",
            };
        },
    },

    // Category B — Compatibility
    {
        id: "B-cyl9ml-cap-compat",
        category: "Compatibility",
        question:
            "I have a 9ml Cylinder bottle. What thread size is it, and what caps fit?",
        check: (text) => {
            const t = text.toLowerCase();
            // 9ml Cylinder is 17-415 thread
            const mentions17_415 = /17\s*[-\/]\s*415/.test(t);
            const plausibleCaps = /(roll|spray|cap|lotion|dropper|fine\s?mist)/.test(t);
            return {
                pass: mentions17_415 && plausibleCaps,
                note: !mentions17_415 ? "Did NOT identify 17-415 thread" : !plausibleCaps ? "No caps mentioned" : "OK",
            };
        },
    },
    {
        id: "B-mixed-thread-trap",
        category: "Compatibility",
        question:
            "Can I put an 18-415 fine mist sprayer on a 13-415 bottle?",
        check: (text) => {
            const t = text.toLowerCase();
            const catchesIncompat = /no\b|can(not|'t)|incompat|different thread|don't match|not compatible|won't fit/.test(t);
            return { pass: catchesIncompat, note: catchesIncompat ? "Correctly flagged mismatch" : "FAILED — didn't catch thread mismatch" };
        },
    },

    // Category C — Catalog Coverage (v8.3 enrichment territory)
    {
        id: "C-use-case-desc",
        category: "v8.3 Use Case",
        question:
            "What would a 5ml atomizer bottle typically be used for?",
        // Should leverage useCaseDescription data (67.4% filled after migration)
        check: (text) => {
            const t = text.toLowerCase();
            const usageWords = /(perfume|fragrance|cologne|essential oil|sample|travel|refill)/.test(t);
            return { pass: usageWords, note: usageWords ? "Surfaced use-case content" : "Generic answer — useCaseDescription not leveraged" };
        },
    },
    {
        id: "C-cap-style-tall",
        category: "v8.3 capStyle",
        question: "Show me 5ml clear cylinders with a tall cap.",
        // capStyle now 95.7% filled — should distinguish Tall vs Short
        check: (text, toolCalls) => {
            const hit = /tall/i.test(text);
            const searched = toolCalls.some((c) => c?.tool === "searchCatalog");
            return { pass: hit && searched, note: !searched ? "No searchCatalog call" : !hit ? "Didn't mention 'tall'" : "OK" };
        },
    },
    {
        id: "C-case-weight",
        category: "v8.3 caseWeightG",
        question: "What is the case weight of a 5ml clear cylinder bottle?",
        // caseWeightG now 83.8% filled — pure shipping-quote territory
        check: (text) => {
            const hasWeight = /\d{2,5}\s*(g\b|gram|kg|pound|lb)/i.test(text);
            return { pass: hasWeight, note: hasWeight ? "Gave a weight" : "No case weight mentioned — caseWeightG not used" };
        },
    },
    {
        id: "C-family-count",
        category: "Catalog Coverage",
        question: "How many sizes of Boston Round bottles do you have?",
        check: (text) => {
            const t = text.toLowerCase();
            const numeric = /\b\d{1,2}\b/.test(t);
            const worded = /\b(two|three|four|five|six|seven|eight|nine|ten)\b/.test(t);
            const mentions = /boston\s?round/.test(t);
            return { pass: (numeric || worded) && mentions, note: (numeric || worded) ? "Gave count" : "No count given" };
        },
    },

    // Category D — Family Classification (known failure mode)
    {
        id: "D-frosted-not-family",
        category: "Family Classification",
        question:
            "Is Frosted a separate bottle family, or is it a finish variant on the Elegant line?",
        check: (text) => {
            const t = text.toLowerCase();
            const correct = /finish|variant|not a (separate )?family|color option|glass option/.test(t);
            const wrong = /frosted (is|family)\b.*separate family/.test(t);
            return { pass: correct && !wrong, note: correct ? "Correctly framed as finish" : "Did not frame Frosted as a finish variant" };
        },
    },

    // Category E — Tool routing (evidence-based; askGrace doesn't return tool traces,
    // so we check for SKU/data fingerprints that only Convex could supply)
    {
        id: "E-tool-searchCatalog",
        category: "Tool Routing",
        question: "Do you have anything in clear glass, 30ml? Give me a specific SKU.",
        check: (text) => {
            // A real SKU from prod will contain letters+digits. Hallucinated answers tend to be generic.
            const hasSku = /\b(GB[A-Z]|LB[A-Z]|AB[A-Z]|GBCyl|GBRnd|GBBst|GBElg|LBCrcl|GBDiva)[A-Za-z0-9]{3,}\b/.test(text);
            return { pass: hasSku, note: hasSku ? "Returned concrete SKU (tool evidence)" : "No concrete SKU in answer — may not have called tool" };
        },
    },
    {
        id: "E-tool-components",
        category: "Tool Routing",
        question:
            "For the 9ml Cylinder Clear, what caps and sprayers can I combine with it? Include specific SKUs.",
        check: (text) => {
            // Should mention 17-415 thread AND at least one cap/sprayer SKU
            const thread = /17\s*[-\/]\s*415/.test(text);
            const compSku = /\b(CMP-|GB[A-Z]{2,}\d)/.test(text);
            return { pass: thread && compSku, note: !thread ? "Missing 17-415 thread" : !compSku ? "No component SKU" : "OK" };
        },
    },

    // Category F — Brand honesty guardrail
    {
        id: "F-brand-honesty",
        category: "Brand Facts",
        question: "How old is Best Bottles as a company?",
        check: (text) => {
            const t = text.toLowerCase();
            const falseClaim = /170\s*years|since 1850|for over (150|170|200) years/.test(t);
            return { pass: !falseClaim, note: falseClaim ? "FAIL — repeated the 170-year false claim" : "No false age claim" };
        },
    },
];

async function ask(question) {
    const res = await client.action(api.grace.askGrace, {
        messages: [{ role: "user", content: question }],
    });
    // askGrace returns { text, toolCalls: [...] } or similar — adapt to shape
    return res;
}

async function main() {
    console.log(`Running ${probes.length} Grace v8.3 probes against ${URL}\n`);
    const results = [];
    for (const p of probes) {
        process.stdout.write(`  [${p.id}] ${p.category}… `);
        let response, err;
        try {
            response = await ask(p.question);
        } catch (e) {
            err = e.message || String(e);
        }
        if (err) {
            console.log(`ERROR: ${err.slice(0, 120)}`);
            results.push({ ...p, pass: false, error: err });
            continue;
        }
        const text = response?.reply ?? response?.text ?? response?.content ?? JSON.stringify(response);
        const toolCalls = response?.toolCalls ?? response?.tools ?? [];
        const r = p.check(text, toolCalls);
        console.log(r.pass ? `PASS  — ${r.note}` : `FAIL  — ${r.note}`);
        results.push({
            id: p.id,
            category: p.category,
            question: p.question,
            pass: r.pass,
            note: r.note,
            response: text,
            toolCalls: toolCalls.map((t) => t?.tool ?? t?.name ?? String(t)),
        });
    }

    // Summary
    const pass = results.filter((r) => r.pass).length;
    console.log(`\n─── Summary ───`);
    console.log(`Passed: ${pass}/${results.length}  (${((100 * pass) / results.length).toFixed(1)}%)`);
    const byCat = {};
    for (const r of results) {
        byCat[r.category] ??= { pass: 0, total: 0 };
        byCat[r.category].total++;
        if (r.pass) byCat[r.category].pass++;
    }
    console.log("\nBy category:");
    for (const [cat, v] of Object.entries(byCat)) {
        console.log(`  ${cat.padEnd(24)} ${v.pass}/${v.total}`);
    }

    console.log("\nFailing probes (with response excerpt):");
    for (const r of results.filter((x) => !x.pass)) {
        console.log(`\n  [${r.id}] ${r.category}`);
        console.log(`  Q: ${r.question}`);
        console.log(`  Why: ${r.note}`);
        console.log(`  Tools: ${r.toolCalls.join(", ") || "(none)"}`);
        const excerpt = (r.response || "").replace(/\s+/g, " ").slice(0, 200);
        console.log(`  A: ${excerpt}${(r.response || "").length > 200 ? "…" : ""}`);
    }

    const outDir = path.resolve(__dirname, "..", "data", "grace-evals", "results");
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(
        outDir,
        `probe-v83-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.json`,
    );
    fs.writeFileSync(outFile, JSON.stringify({ results, byCat, total: results.length, pass }, null, 2));
    console.log(`\nWrote ${outFile}`);
}

main().catch((e) => {
    console.error("Probe failed:", e);
    process.exit(1);
});
