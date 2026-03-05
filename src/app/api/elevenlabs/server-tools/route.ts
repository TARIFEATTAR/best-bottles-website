import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

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
                result = await convex.query(api.grace.searchCatalog, {
                    searchTerm: (parameters.searchTerm as string) ?? "",
                    applicatorFilter: parameters.applicatorFilter as string | undefined,
                    categoryLimit: parameters.categoryLimit as string | undefined,
                    familyLimit: parameters.familyLimit as string | undefined,
                });
                break;
            }

            case "getFamilyOverview": {
                result = await convex.query(api.grace.getFamilyOverview, {
                    family: (parameters.family as string) ?? "",
                });
                break;
            }

            case "getBottleComponents": {
                result = await convex.query(api.grace.getBottleComponents, {
                    bottleSku: (parameters.bottleSku as string) ?? "",
                });
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

        console.log(
            `[EL server-tool] ${tool_name}: ${Date.now() - t0}ms`
        );

        return NextResponse.json({ result });
    } catch (err) {
        console.error("[EL server-tool] Error:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Internal error" },
            { status: 500 }
        );
    }
}
