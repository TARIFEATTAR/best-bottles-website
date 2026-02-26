/**
 * Grace Realtime — OpenAI Realtime API integration.
 *
 * Tools execute client-side during the WebRTC session and query
 * the Convex backend via ConvexHttpClient for product data.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

// ─── Convex HTTP client (used by tools inside the Realtime session) ──────────

let _convex: ConvexHttpClient | null = null;

function getConvex(): ConvexHttpClient {
    if (!_convex) {
        const url = process.env.NEXT_PUBLIC_CONVEX_URL;
        if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
        _convex = new ConvexHttpClient(url);
    }
    return _convex;
}

// ─── Tool executors (called when the Realtime model invokes a function) ──────

export async function executeRealtimeTool(
    name: string,
    args: Record<string, unknown>
): Promise<string> {
    const convex = getConvex();
    const t0 = performance.now();

    try {
        let result: unknown;

        switch (name) {
            case "searchCatalog": {
                const data = await convex.query(api.grace.searchCatalog, {
                    searchTerm: (args.searchTerm as string) ?? "",
                    categoryLimit: args.categoryLimit as string | undefined,
                    familyLimit: args.familyLimit as string | undefined,
                });
                result =
                    data.length > 0
                        ? data
                        : "No products found for that search. Try a broader term.";
                break;
            }

            case "getFamilyOverview": {
                const data = await convex.query(api.grace.getFamilyOverview, {
                    family: (args.family as string) ?? "",
                });
                result =
                    data ?? `No products found for the "${args.family}" family.`;
                break;
            }

            case "checkCompatibility": {
                const data = await convex.query(api.grace.checkCompatibility, {
                    threadSize: (args.threadSize as string) ?? "",
                });
                result =
                    data.length > 0
                        ? data
                        : `No fitment data for thread size ${args.threadSize}.`;
                break;
            }

            case "getCatalogStats": {
                result = await convex.query(api.grace.getCatalogStats, {});
                break;
            }

            default:
                result = `Unknown tool: ${name}`;
        }

        const json = typeof result === "string" ? result : JSON.stringify(result);
        console.log(
            `[Grace RT] tool ${name}: ${Math.round(performance.now() - t0)}ms (${json.length} chars)`
        );
        return json;
    } catch (e) {
        console.error(`[Grace RT] tool ${name} error:`, e);
        return `Tool error: ${e instanceof Error ? e.message : String(e)}`;
    }
}

// ─── Fetch system prompt from Convex ─────────────────────────────────────────

export async function fetchGraceInstructions(): Promise<string> {
    const convex = getConvex();
    return convex.query(api.grace.getGraceInstructions, { voiceMode: true });
}

// ─── Fetch ephemeral token from our API route ────────────────────────────────

export async function fetchEphemeralToken(
    instructions: string
): Promise<{ token: string; expiresAt: number }> {
    const res = await fetch("/api/realtime/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? `Token request failed: ${res.status}`);
    }
    return res.json();
}
