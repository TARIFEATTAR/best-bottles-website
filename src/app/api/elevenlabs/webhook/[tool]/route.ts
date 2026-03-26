import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";

let _convex: ConvexHttpClient | null = null;

function getConvex(): ConvexHttpClient {
  if (!_convex) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    _convex = new ConvexHttpClient(url);
  }
  return _convex;
}

const WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET;

function verifyRequest(req: NextRequest): boolean {
  if (!WEBHOOK_SECRET) return true;
  const provided = req.headers.get("x-webhook-secret");
  return provided === WEBHOOK_SECRET;
}

type ToolHandler = (params: Record<string, unknown>) => Promise<unknown>;

function buildToolHandlers(convex: ConvexHttpClient): Record<string, ToolHandler> {
  return {
    searchCatalog: (p) =>
      convex.query(api.grace.searchCatalog, {
        searchTerm: (p.searchTerm as string) ?? "",
        applicatorFilter: p.applicatorFilter as string | undefined,
        categoryLimit: p.categoryLimit as string | undefined,
        familyLimit: p.familyLimit as string | undefined,
      }),

    getFamilyOverview: (p) =>
      convex.query(api.grace.getFamilyOverview, {
        family: (p.family as string) ?? "",
      }),

    getBottleComponents: (p) =>
      convex.query(api.grace.getBottleComponents, {
        bottleSku: (p.bottleSku as string) ?? "",
      }),

    checkCompatibility: (p) =>
      convex.query(api.grace.checkCompatibility, {
        threadSize: (p.threadSize as string) ?? "",
      }),

    getCatalogStats: () => convex.query(api.grace.getCatalogStats, {}),

    getProductGroup: (p) =>
      convex.query(api.products.getProductGroup, {
        slug: (p.slug as string) ?? "",
      }),
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tool: string }> }
) {
  if (!verifyRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tool } = await params;

  const convex = getConvex();
  const handlers = buildToolHandlers(convex);
  const handler = handlers[tool];

  if (!handler) {
    return NextResponse.json(
      { error: `Unknown tool: ${tool}` },
      { status: 404 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const t0 = Date.now();
    const result = await handler(body as Record<string, unknown>);

    console.log(`[EL webhook] ${tool}: ${Date.now() - t0}ms`);

    return NextResponse.json(result);
  } catch (err) {
    console.error(`[EL webhook] ${tool} error:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tool: string }> }
) {
  if (!verifyRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tool } = await params;
  const convex = getConvex();
  const handlers = buildToolHandlers(convex);
  const handler = handlers[tool];

  if (!handler) {
    return NextResponse.json(
      { error: `Unknown tool: ${tool}` },
      { status: 404 }
    );
  }

  try {
    const url = new URL(req.url);
    const queryParams: Record<string, unknown> = {};
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    const t0 = Date.now();
    const result = await handler(queryParams);

    console.log(`[EL webhook] ${tool} (GET): ${Date.now() - t0}ms`);

    return NextResponse.json(result);
  } catch (err) {
    console.error(`[EL webhook] ${tool} error:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
