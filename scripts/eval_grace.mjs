#!/usr/bin/env node
/**
 * Grace AI Retrieval Accuracy Eval v2
 *
 * Runs test cases against the live askGrace action and scores
 * product retrieval accuracy, pivot behavior, and hallucination detection.
 *
 * Usage:
 *   npm run eval:grace                        # run all cases once
 *   npm run eval:grace:verbose                # show full responses
 *   npm run eval:grace -- --filter pivot      # run only cases matching "pivot"
 *   npm run eval:grace -- --runs 3            # run full suite 3 times, track consistency
 *   npm run eval:grace -- --runs 3 --verbose  # loop with verbose
 *
 * Requires:
 *   - NEXT_PUBLIC_CONVEX_URL in .env.local (or CONVEX_URL env var)
 *   - ANTHROPIC_API_KEY set in Convex dashboard
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Load .env.local ──────────────────────────────────────────────────────────
try {
    const envPath = resolve(ROOT, ".env.local");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
} catch { /* .env.local not required if vars are already set */ }

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
if (!CONVEX_URL) {
    console.error("ERROR: NEXT_PUBLIC_CONVEX_URL not set. Add it to .env.local or set CONVEX_URL.");
    process.exit(1);
}

// ── Parse CLI args ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const filterIdx = args.indexOf("--filter");
const filterTerm = filterIdx !== -1 ? args[filterIdx + 1]?.toLowerCase() : null;
const runsIdx = args.indexOf("--runs");
const totalRuns = runsIdx !== -1 ? parseInt(args[runsIdx + 1]) || 1 : 1;

// ── Load test cases ──────────────────────────────────────────────────────────
const testCasesPath = resolve(ROOT, "data/grace-evals/test-cases.json");
const { cases } = JSON.parse(readFileSync(testCasesPath, "utf8"));

const filteredCases = filterTerm
    ? cases.filter((c) => c.id.includes(filterTerm) || c.category.includes(filterTerm))
    : cases;

if (filteredCases.length === 0) {
    console.error(`No test cases match filter: "${filterTerm}"`);
    process.exit(1);
}

// ── Call askGrace via Convex HTTP API ─────────────────────────────────────────
async function callAskGrace(question) {
    const url = `${CONVEX_URL.replace(/\/$/, "")}/api/action`;
    const body = {
        path: "grace:askGrace",
        args: {
            messages: [{ role: "user", content: question }],
        },
    };

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Convex API error (${response.status}): ${text}`);
    }

    const result = await response.json();
    return typeof result === "string" ? result : (result.value ?? result);
}

// ── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Check if `text` contains `term` using fuzzy prefix matching.
 * "sourc" matches "source", "sourcing", "sourced", etc.
 */
function fuzzyContains(text, term) {
    return text.includes(term.toLowerCase());
}

function scoreResponse(testCase, responseText) {
    const expect = testCase.expect;
    const text = responseText.toLowerCase();
    const checks = [];
    let totalChecks = 0;
    let passedChecks = 0;

    // mustMention — response must contain ALL of these strings
    if (expect.mustMention) {
        for (const term of expect.mustMention) {
            totalChecks++;
            const found = fuzzyContains(text, term);
            checks.push({ check: `mustMention: "${term}"`, passed: found });
            if (found) passedChecks++;
        }
    }

    // mustMentionAny — response must contain AT LEAST ONE of these
    for (const key of ["mustMentionAny", "mustMentionAny2"]) {
        if (expect[key]) {
            totalChecks++;
            const found = expect[key].some((term) => fuzzyContains(text, term));
            const label = key === "mustMentionAny2" ? "mustMentionAny(2)" : "mustMentionAny";
            checks.push({
                check: `${label}: [${expect[key].map((t) => `"${t}"`).join(", ")}]`,
                passed: found,
                detail: found ? "matched" : "NONE matched",
            });
            if (found) passedChecks++;
        }
    }

    // mustNotMention — response must NOT contain these strings
    if (expect.mustNotMention) {
        for (const term of expect.mustNotMention) {
            totalChecks++;
            const found = fuzzyContains(text, term);
            checks.push({ check: `mustNotMention: "${term}"`, passed: !found });
            if (!found) passedChecks++;
        }
    }

    // shouldPivot — response should redirect/suggest alternatives
    if (expect.shouldPivot) {
        totalChecks++;
        const pivotSignals = [
            "start at", "starts at", "begin at", "begins at",
            "instead", "alternative", "suggest", "recommend",
            "don't stock", "don't carry", "not available in",
            "doesn't include", "doesn't come in", "no ", "not a",
            "smallest", "minimum size", "closest",
            "tola", "dropper", "spray", "atomizer", "pump",
            "won't spin", "leak", "too freely",
        ];
        const hasPivot = pivotSignals.some((s) => text.includes(s));
        checks.push({
            check: "shouldPivot",
            passed: hasPivot,
            detail: hasPivot ? "pivot detected" : "NO pivot language found",
        });
        if (hasPivot) passedChecks++;
    }

    // shouldAdmitNoMatch — Grace should not pretend a fake product exists
    if (expect.shouldAdmitNoMatch) {
        totalChecks++;
        const admitSignals = [
            "don't carry", "don't stock", "not a family",
            "don't have", "not available", "couldn't find",
            "no results", "not in our catalog", "don't offer",
            "not something we", "i'm not finding", "doesn't appear",
            "don't recognize", "not familiar with",
            "isn't a color we carry", "isn't a colour we carry",
            "not a color we carry", "not a colour we carry",
        ];
        const admits = admitSignals.some((s) => text.includes(s));
        checks.push({
            check: "shouldAdmitNoMatch",
            passed: admits,
            detail: admits ? "correctly admits no match" : "may have hallucinated",
        });
        if (admits) passedChecks++;
    }

    // Confidence score: ratio of passed checks
    const confidence = totalChecks > 0 ? passedChecks / totalChecks : 1;
    const passed = passedChecks === totalChecks;

    return { passed, checks, confidence, passedChecks, totalChecks };
}

// ── Detect infrastructure errors ─────────────────────────────────────────────
function isInfraError(responseText) {
    return responseText.includes("I ran into an unexpected issue") ||
           responseText.includes("not yet configured");
}

// ── Single run ───────────────────────────────────────────────────────────────
async function runOnce(runNumber) {
    if (totalRuns > 1) {
        console.log(`\n${"━".repeat(60)}`);
        console.log(`RUN ${runNumber}/${totalRuns}`);
        console.log(`${"━".repeat(60)}`);
    }

    const results = [];
    let passCount = 0;
    let failCount = 0;
    let errorCount = 0;
    let infraErrorCount = 0;
    let totalConfidence = 0;

    for (let i = 0; i < filteredCases.length; i++) {
        const tc = filteredCases[i];
        const label = `[${i + 1}/${filteredCases.length}] ${tc.id}`;
        process.stdout.write(`${label} ... `);

        const startMs = Date.now();
        let responseText = "";
        let error = null;

        try {
            responseText = await callAskGrace(tc.question);
        } catch (e) {
            error = e.message;
        }

        const elapsedMs = Date.now() - startMs;

        if (error) {
            console.log(`ERROR (${elapsedMs}ms)`);
            if (verbose) console.log(`   ${error}\n`);
            results.push({ id: tc.id, category: tc.category, status: "error", error, elapsedMs });
            errorCount++;
            continue;
        }

        // Detect infrastructure errors (API key, credits, etc.)
        if (isInfraError(responseText)) {
            console.log(`INFRA_ERROR (${elapsedMs}ms)`);
            if (verbose) console.log(`   Response: "${responseText.slice(0, 150)}..."\n`);
            results.push({ id: tc.id, category: tc.category, status: "infra_error", response: responseText, elapsedMs });
            infraErrorCount++;
            continue;
        }

        const { passed, checks, confidence, passedChecks, totalChecks } = scoreResponse(tc, responseText);
        totalConfidence += confidence;

        if (passed) {
            console.log(`PASS (${elapsedMs}ms) [${(confidence * 100).toFixed(0)}%]`);
            passCount++;
        } else {
            console.log(`FAIL (${elapsedMs}ms) [${passedChecks}/${totalChecks} checks, ${(confidence * 100).toFixed(0)}%]`);
            failCount++;
        }

        // Show details on failure or verbose mode
        if (!passed || verbose) {
            console.log(`   Q: "${tc.question}"`);
            if (verbose) {
                const trimmed = responseText.slice(0, 400);
                console.log(`   A: "${trimmed}${responseText.length > 400 ? "..." : ""}"`);
            }
            for (const c of checks) {
                const icon = c.passed ? "  ✓" : "  ✗";
                console.log(`   ${icon} ${c.check}${c.detail ? ` — ${c.detail}` : ""}`);
            }
            console.log();
        }

        results.push({
            id: tc.id,
            category: tc.category,
            question: tc.question,
            status: passed ? "pass" : "fail",
            response: responseText,
            checks,
            confidence,
            elapsedMs,
        });
    }

    // ── Run summary ──────────────────────────────────────────────────────────
    const scoreable = passCount + failCount;
    const total = scoreable + errorCount + infraErrorCount;
    const accuracy = scoreable > 0 ? ((passCount / scoreable) * 100).toFixed(1) : "N/A";
    const avgConfidence = scoreable > 0 ? ((totalConfidence / scoreable) * 100).toFixed(1) : "N/A";

    console.log("\n" + "═".repeat(60));
    console.log(totalRuns > 1 ? `RUN ${runNumber} SUMMARY` : "SUMMARY");
    console.log("═".repeat(60));
    console.log(`  Pass:           ${passCount}`);
    console.log(`  Fail:           ${failCount}`);
    console.log(`  Error:          ${errorCount}`);
    if (infraErrorCount > 0) {
        console.log(`  Infra Error:    ${infraErrorCount} (API key/credits issue — these are not scored)`);
    }
    console.log(`  Total:          ${total}`);
    console.log(`  Accuracy:       ${accuracy}%`);
    console.log(`  Avg Confidence: ${avgConfidence}%`);

    // Category breakdown
    const categories = [...new Set(results.map((r) => r.category))];
    if (categories.length > 1) {
        console.log("\nBy category:");
        for (const cat of categories.sort()) {
            const catResults = results.filter((r) => r.category === cat && r.status !== "infra_error" && r.status !== "error");
            const catPass = catResults.filter((r) => r.status === "pass").length;
            const catTotal = catResults.length;
            if (catTotal > 0) {
                console.log(`  ${cat}: ${catPass}/${catTotal} (${((catPass / catTotal) * 100).toFixed(0)}%)`);
            }
        }
    }

    // Timing
    const times = results.filter((r) => r.elapsedMs && r.status !== "infra_error").map((r) => r.elapsedMs);
    if (times.length > 0) {
        const avg = (times.reduce((a, b) => a + b, 0) / times.length / 1000).toFixed(1);
        const max = (Math.max(...times) / 1000).toFixed(1);
        const min = (Math.min(...times) / 1000).toFixed(1);
        console.log(`\nTiming: avg ${avg}s, min ${min}s, max ${max}s`);
    }

    console.log("═".repeat(60));

    return { results, passCount, failCount, errorCount, infraErrorCount, accuracy, avgConfidence };
}

// ── Main: single run or multi-run loop ───────────────────────────────────────
async function main() {
    console.log("Grace AI Retrieval Eval v2");
    console.log("═".repeat(60));
    console.log(`Cases: ${filteredCases.length}  |  Runs: ${totalRuns}  |  Convex: ${CONVEX_URL}`);
    console.log("═".repeat(60));

    const allRuns = [];

    for (let run = 1; run <= totalRuns; run++) {
        const result = await runOnce(run);
        allRuns.push(result);

        // Abort early if infrastructure error on every case (no point continuing)
        if (result.infraErrorCount === filteredCases.length) {
            console.error("\nAll cases hit infrastructure errors. Check your ANTHROPIC_API_KEY credits.");
            process.exit(1);
        }
    }

    // ── Consistency report (multi-run only) ──────────────────────────────────
    if (totalRuns > 1) {
        console.log("\n" + "▓".repeat(60));
        console.log("CONSISTENCY REPORT");
        console.log("▓".repeat(60));

        // Per-case consistency: how often did each case pass across runs?
        const caseConsistency = {};
        for (const tc of filteredCases) {
            caseConsistency[tc.id] = { passes: 0, fails: 0, errors: 0, total: totalRuns };
        }
        for (const run of allRuns) {
            for (const r of run.results) {
                if (r.status === "pass") caseConsistency[r.id].passes++;
                else if (r.status === "fail") caseConsistency[r.id].fails++;
                else caseConsistency[r.id].errors++;
            }
        }

        // Classify stability
        const stable = [];      // always pass or always fail
        const flaky = [];       // mixed results
        const broken = [];      // always fail

        for (const [id, stats] of Object.entries(caseConsistency)) {
            const passRate = stats.passes / (stats.passes + stats.fails || 1);
            if (stats.passes === totalRuns) {
                stable.push({ id, passRate: 1.0 });
            } else if (stats.fails === totalRuns) {
                broken.push({ id, passRate: 0.0 });
            } else {
                flaky.push({ id, passRate, ...stats });
            }
        }

        console.log(`\n  Stable (always pass):  ${stable.length}`);
        console.log(`  Broken (always fail):  ${broken.length}`);
        console.log(`  Flaky  (inconsistent): ${flaky.length}`);

        if (flaky.length > 0) {
            console.log("\n  Flaky cases (investigate these):");
            for (const f of flaky.sort((a, b) => a.passRate - b.passRate)) {
                console.log(`    ${f.id}: ${f.passes}/${totalRuns} passes (${(f.passRate * 100).toFixed(0)}%)`);
            }
        }

        if (broken.length > 0) {
            console.log("\n  Broken cases (always failing):");
            for (const b of broken) {
                console.log(`    ${b.id}`);
            }
        }

        // Overall consistency
        const accuracies = allRuns.map((r) => parseFloat(r.accuracy) || 0);
        const avgAccuracy = (accuracies.reduce((a, b) => a + b, 0) / accuracies.length).toFixed(1);
        const minAccuracy = Math.min(...accuracies).toFixed(1);
        const maxAccuracy = Math.max(...accuracies).toFixed(1);
        const spread = (maxAccuracy - minAccuracy).toFixed(1);

        console.log(`\n  Accuracy across runs: avg ${avgAccuracy}%, min ${minAccuracy}%, max ${maxAccuracy}% (spread: ${spread}%)`);
        console.log("▓".repeat(60));
    }

    // ── Save results ─────────────────────────────────────────────────────────
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const outputDir = resolve(ROOT, "data/grace-evals/results");
    mkdirSync(outputDir, { recursive: true });

    const lastRun = allRuns[allRuns.length - 1];
    const outputPath = resolve(outputDir, `eval-${timestamp}.json`);
    const output = {
        timestamp: new Date().toISOString(),
        totalRuns,
        summary: {
            total: filteredCases.length,
            pass: lastRun.passCount,
            fail: lastRun.failCount,
            error: lastRun.errorCount,
            accuracy: `${lastRun.accuracy}%`,
            avgConfidence: `${lastRun.avgConfidence}%`,
        },
        results: lastRun.results,
        ...(totalRuns > 1 ? {
            allRunAccuracies: allRuns.map((r) => `${r.accuracy}%`),
        } : {}),
    };
    writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\nResults saved: ${outputPath}`);

    // Exit with error code if any failures in last run
    if (lastRun.failCount > 0 || lastRun.errorCount > 0) {
        process.exit(1);
    }
}

main().catch((e) => {
    console.error("Eval runner crashed:", e);
    process.exit(1);
});
