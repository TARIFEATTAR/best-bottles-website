import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { resolveSearchCatalogParameters } from "@/lib/graceToolParamUtils";
import {
    buildSearchCatalogToolResult,
    emptySearchCatalogHint,
} from "../../../../../convex/graceSearchUtils";

/**
 * Server tools proxy for ElevenLabs Conversational AI.
 *
 * ElevenLabs server tools send a POST with { tool_name, parameters }.
 * This route executes the corresponding Convex query and returns the result.
 */

let _convex: ConvexHttpClient | null = null;

function getConvex(): ConvexHttpClient {
    if (!_convex) {
        const url = process.env.NEXT_PUBLIC_CONVEX_URL;
        if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
        _convex = new ConvexHttpClient(url);
    }
    return _convex;
}

export async function POST(req: NextRequest) {
    try {
        // All 12 agent tools are registered on ElevenLabs as type:"client",
        // which means the browser (our own page) fetches this endpoint — not
        // ElevenLabs' servers. Legit callers are always same-origin. External
        // callers still need the secret if set.
        const expectedSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
        if (expectedSecret) {
            const originHeader = req.headers.get("origin");
            const hostHeader = req.headers.get("host");
            let isSameOrigin = false;
            if (originHeader && hostHeader) {
                try {
                    isSameOrigin = new URL(originHeader).host === hostHeader;
                } catch { /* malformed origin */ }
            }
            if (!isSameOrigin) {
                const provided = req.headers.get("x-webhook-secret");
                if (provided !== expectedSecret) {
                    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
                }
            }
        }

        const body = (await req.json()) as {
            tool_name?: string;
            parameters?: Record<string, unknown>;
        };

        const { tool_name, parameters = {} } = body;

        if (!tool_name) {
            return NextResponse.json(
                { error: "Missing tool_name" },
                { status: 400 }
            );
        }

        const convex = getConvex();
        const t0 = Date.now();
        let result: unknown;

        switch (tool_name) {
            case "searchCatalog": {
                const searchParams = resolveSearchCatalogParameters(parameters);
                const data = await convex.query(
                    api.grace.searchCatalog,
                    searchParams
                );
                if (!Array.isArray(data)) {
                    result = data;
                } else if (data.length === 0) {
                    result = `No products found for that search. Try a broader term.${emptySearchCatalogHint(searchParams.searchTerm)}`;
                } else {
                    const slim = data.map((p) => ({
                        graceSku: p.graceSku,
                        itemName: p.itemName,
                        family: p.family,
                        capacity: p.capacity,
                        capacityMl: p.capacityMl,
                        color: p.color,
                        applicator: p.applicator,
                        capColor: p.capColor,
                        neckThreadSize: p.neckThreadSize,
                        slug: p.slug,
                        webPrice1pc: p.webPrice1pc,
                        stockStatus: p.stockStatus,
                    }));
                    result = buildSearchCatalogToolResult(searchParams, slim);
                }
                break;
            }

            case "getFamilyOverview": {
                result = await convex.query(api.grace.getFamilyOverview, {
                    family: (parameters.family as string) ?? "",
                });
                break;
            }

            case "getBottleComponents": {
                const data = await convex.query(api.grace.getBottleComponents, {
                    bottleSku: (parameters.bottleSku as string) ?? "",
                });
                if (data && typeof data === "object" && "bottle" in data) {
                    const d = data as {
                        bottle: Record<string, unknown>;
                        componentTypes: string[];
                        totalComponents: number;
                        components: Record<string, unknown>;
                    };
                    result = {
                        bottle: {
                            graceSku: d.bottle.graceSku,
                            itemName: d.bottle.itemName,
                            family: d.bottle.family,
                            capacity: d.bottle.capacity,
                            color: d.bottle.color,
                            neckThreadSize: d.bottle.neckThreadSize,
                            capStyle: d.bottle.capStyle,
                            webPrice1pc: d.bottle.webPrice1pc,
                        },
                        componentTypes: d.componentTypes,
                        totalComponents: d.totalComponents,
                        components: d.components,
                    };
                } else {
                    result = data;
                }
                break;
            }

            case "checkCompatibility": {
                result = await convex.query(api.grace.checkCompatibility, {
                    threadSize: (parameters.threadSize as string) ?? "",
                });
                break;
            }

            case "getCatalogStats": {
                result = await convex.query(api.grace.getCatalogStats, {});
                break;
            }

            case "getProductGroup": {
                result = await convex.query(api.products.getProductGroup, {
                    slug: (parameters.slug as string) ?? "",
                });
                break;
            }

            default:
                return NextResponse.json(
                    { error: `Unknown tool: ${tool_name}` },
                    { status: 400 }
                );
        }

        return NextResponse.json({ result });
    } catch (err) {
        console.error("[EL server-tool] Error:", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
