import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

/**
 * Grace AI file upload endpoint.
 *
 * Used by Pattern H (reference image match) and Pattern I (brand mockup
 * logo). Accepts multipart/form-data with `file`, `ownerKey`, and `kind`
 * (either "reference" or "logo"). Validates MIME and size, then writes to
 * Convex storage via the two-step generateUploadUrl + recordUpload flow.
 *
 * Returns: { id, blobId, url, mime, size }
 */

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPTED = new Set([
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "application/pdf",
    "application/postscript",
    "application/illustrator",
    "image/svg+xml",
]);

let _convex: ConvexHttpClient | null = null;
function getConvex() {
    if (!_convex) {
        const url = process.env.NEXT_PUBLIC_CONVEX_URL;
        if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
        _convex = new ConvexHttpClient(url);
    }
    return _convex;
}

export async function POST(req: NextRequest) {
    try {
        const form = await req.formData();
        const file = form.get("file");
        const ownerKey = (form.get("ownerKey") as string) ?? "";
        const kindRaw = (form.get("kind") as string) ?? "reference";
        const kind = (kindRaw === "logo" ? "logo" : "reference") as "logo" | "reference";

        if (!(file instanceof File)) {
            return NextResponse.json({ error: "Missing file" }, { status: 400 });
        }
        if (!ownerKey) {
            return NextResponse.json({ error: "Missing ownerKey" }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
            return NextResponse.json({ error: "File exceeds 25MB limit." }, { status: 413 });
        }
        if (!ACCEPTED.has(file.type.toLowerCase())) {
            return NextResponse.json({ error: `Unsupported MIME type: ${file.type}` }, { status: 415 });
        }

        const convex = getConvex();

        // Step 1 — get one-shot upload URL from Convex storage
        const uploadUrl = await convex.mutation(api.graceUploads.generateUploadUrl, {});

        // Step 2 — POST the file blob to that URL
        const upload = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
        });
        if (!upload.ok) {
            return NextResponse.json({ error: "Storage upload failed." }, { status: 502 });
        }
        const { storageId } = await upload.json() as { storageId: string };

        // Step 3 — register the upload + get serving URL
        const record = await convex.mutation(api.graceUploads.recordUpload, {
            blobId: storageId,
            mime: file.type,
            size: file.size,
            ownerKey,
            kind,
        });

        return NextResponse.json({
            id: record.id,
            blobId: storageId,
            url: record.url,
            mime: file.type,
            size: file.size,
        });
    } catch (err) {
        console.error("[Grace upload] Error:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Upload failed" },
            { status: 500 },
        );
    }
}
