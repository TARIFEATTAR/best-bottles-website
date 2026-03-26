import { NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

function getSanityReadClient() {
    if (!projectId) return null;
    return createClient({
        projectId,
        dataset,
        apiVersion: "2025-02-19",
        useCdn: true,
        token: process.env.SANITY_API_TOKEN,
    });
}

type LayerRow = {
    slot: string;
    variantKey: string;
    imageUrl?: string | null;
};

type Manifest = {
    familyKey: string;
    canvas?: { width: number; height: number };
    layerOrderRollon?: string[];
    layerOrderSpray?: string[];
    layerOrderLotion?: string[];
    layers: Array<{
        slot: string;
        variantKey: string;
        relativePath?: string;
        url?: string | null;
    }>;
};

async function loadManifest(familyKey: string): Promise<Manifest | null> {
    try {
        const p = join(process.cwd(), "data", "paper-doll", familyKey, "manifest.json");
        const raw = await readFile(p, "utf8");
        return JSON.parse(raw) as Manifest;
    } catch {
        return null;
    }
}

async function loadLayersFromSanity(familyKey: string): Promise<LayerRow[] | null> {
    const client = getSanityReadClient();
    if (!client) return null;
    const q = `*[_type == "paperDollFamily" && familyKey == $k][0]{
      "layers": layerAssets[]{
        slot,
        variantKey,
        "imageUrl": image.asset->url
      }
    }`;
    const row = await client.fetch<{ layers?: LayerRow[] }>(q, { k: familyKey });
    if (!row?.layers?.length) return null;
    return row.layers;
}

function resolveLayerOrder(
    mode: "rollon" | "spray" | "lotion",
    manifest: Manifest | null
): string[] {
    if (manifest) {
        if (mode === "rollon" && manifest.layerOrderRollon?.length)
            return manifest.layerOrderRollon;
        if (mode === "spray" && manifest.layerOrderSpray?.length) return manifest.layerOrderSpray;
        if (mode === "lotion" && manifest.layerOrderLotion?.length) return manifest.layerOrderLotion;
    }
    if (mode === "rollon") return ["body", "roller", "cap"];
    if (mode === "spray") return ["body", "sprayer"];
    return ["body", "pump"];
}

function pickUrl(
    layers: LayerRow[],
    slot: string,
    variantKey: string
): string | null {
    const hit = layers.find((l) => l.slot === slot && l.variantKey === variantKey);
    return hit?.imageUrl ?? null;
}

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as {
            family?: string;
            mode?: "rollon" | "spray" | "lotion";
            body?: string;
            cap?: string;
            roller?: string;
            sprayer?: string;
            pump?: string;
            preview?: boolean;
        };

        const familyKey = body.family ?? "CYL-9ML";
        const mode = body.mode ?? "rollon";

        const manifest = await loadManifest(familyKey);
        let layers = await loadLayersFromSanity(familyKey);

        if (!layers?.length && manifest?.layers?.length) {
            layers = manifest.layers.map((l) => ({
                slot: l.slot,
                variantKey: l.variantKey,
                imageUrl: l.url ?? null,
            }));
        }

        if (!layers?.length) {
            return NextResponse.json(
                {
                    error:
                        "No Paper Doll layers found. Upload assets to Sanity (upload-paper-doll-family.mjs) and/or commit data/paper-doll/<family>/manifest.json with URLs.",
                },
                { status: 404 }
            );
        }

        const order = resolveLayerOrder(mode, manifest);
        const picks: { slot: string; key: string }[] = [];
        for (const slot of order) {
            if (slot === "body" && body.body) picks.push({ slot, key: body.body });
            else if (slot === "cap" && body.cap) picks.push({ slot, key: body.cap });
            else if (slot === "roller" && body.roller) picks.push({ slot, key: body.roller });
            else if (slot === "sprayer" && body.sprayer) picks.push({ slot, key: body.sprayer });
            else if (slot === "pump" && body.pump) picks.push({ slot, key: body.pump });
        }

        if (picks.length === 0) {
            return NextResponse.json(
                { error: "Provide variant keys for each layer in order, e.g. body, roller, cap for rollon." },
                { status: 400 }
            );
        }

        const buffers: Buffer[] = [];
        for (const { slot, key } of picks) {
            const url = pickUrl(layers, slot, key);
            if (!url) {
                return NextResponse.json(
                    { error: `Missing image URL for ${slot} variant "${key}"` },
                    { status: 400 }
                );
            }
            const res = await fetch(url);
            if (!res.ok) {
                return NextResponse.json({ error: `Failed to fetch layer ${slot}: ${res.status}` }, { status: 502 });
            }
            const buf = Buffer.from(await res.arrayBuffer());
            buffers.push(buf);
        }

        // Composite layers sequentially (Sharp requires one overlay at a time for same-size PNGs)
        let current = await sharp(buffers[0]).ensureAlpha().png().toBuffer();
        for (let i = 1; i < buffers.length; i++) {
            const overlay = await sharp(buffers[i]).ensureAlpha().png().toBuffer();
            current = await sharp(current)
                .composite([{ input: overlay, blend: "over" as const }])
                .png()
                .toBuffer();
        }

        // Trim transparent pixels so the bottle fills the frame
        let pipeline = sharp(current).trim();
        const maxW = body.preview ? 800 : undefined;
        if (maxW) {
            pipeline = pipeline.resize({ width: maxW, withoutEnlargement: true });
        }

        const out = await pipeline.png().toBuffer();

        const cacheKey = `paper-doll-${familyKey}-${mode}-${JSON.stringify(picks)}-${body.preview ? "p" : "f"}`;
        return new NextResponse(new Uint8Array(out), {
            status: 200,
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=86400, s-maxage=86400",
                "X-Paper-Doll-Cache-Key": cacheKey,
            },
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
