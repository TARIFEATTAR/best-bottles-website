"use client";

import { useCallback, useState } from "react";
import { useGrace } from "@/components/useGrace";
import { getAnonOwnerKey } from "@/lib/graceAnonOwnerKey";
import type { ProductCard, ReferenceMatchPayload } from "@/components/GraceContext";

/**
 * End-to-end image-upload + vision flow for Grace's reference-match
 * pattern (PRD Pattern H). Bypasses ElevenLabs — runs purely client-side
 * with two server endpoints (/api/grace/upload + /api/grace/vision) and
 * the existing searchCatalog tool.
 *
 * Flow:
 *   1. uploadAndAnalyze(file) — uploads file → vision → searchCatalog
 *   2. Appends a user message with the image attachment (so it shows in chat)
 *   3. Appends a Grace message with Pattern H action (image + matches)
 *
 * Returns `{ uploadAndAnalyze, status }` for the composer to wire.
 */
export type UploadStatus = "idle" | "uploading" | "analyzing" | "searching" | "done" | "error";

export function useGraceImageUpload() {
    const { appendInlineMessage } = useGrace();
    const [status, setStatus] = useState<UploadStatus>("idle");
    const [error, setError] = useState<string | null>(null);

    const uploadAndAnalyze = useCallback(
        async (file: File, opts?: { userText?: string }) => {
            setStatus("uploading");
            setError(null);
            try {
                // 1. Upload to Convex storage via /api/grace/upload
                const ownerKey = getAnonOwnerKey();
                const form = new FormData();
                form.append("file", file);
                form.append("ownerKey", ownerKey);
                form.append("kind", "reference");
                const upRes = await fetch("/api/grace/upload", { method: "POST", body: form });
                const upData = (await upRes.json()) as { url?: string; error?: string };
                if (!upRes.ok || !upData.url) {
                    throw new Error(upData.error ?? "Upload failed");
                }
                const imageUrl = upData.url;

                // 2. Append user message immediately so the upload feels responsive
                const userText = (opts?.userText ?? "Find bottles similar to this reference.").trim();
                appendInlineMessage({
                    role: "user",
                    content: userText,
                    attachments: [
                        {
                            id: `upload-${Date.now()}`,
                            name: file.name,
                            mime: file.type,
                            size: file.size,
                            url: imageUrl,
                            kind: "reference",
                        },
                    ],
                });

                // 3. Vision analysis — describe the image in catalog-relevant terms
                setStatus("analyzing");
                const visionRes = await fetch("/api/grace/vision", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ imageUrl }),
                });
                const visionData = (await visionRes.json()) as {
                    description?: string;
                    searchTerms?: string;
                    error?: string;
                };
                if (!visionRes.ok || !visionData.description) {
                    throw new Error(visionData.error ?? "Vision analysis failed");
                }
                const description = visionData.description.trim();
                const searchTerms = (visionData.searchTerms ?? description).trim();

                // 4. Use the search terms to find matches in the catalog
                setStatus("searching");
                const searchRes = await fetch("/api/elevenlabs/server-tools", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tool_name: "searchCatalog",
                        parameters: { searchTerm: searchTerms, familyLimit: null, categoryLimit: null, applicatorFilter: null, returnRaw: true },
                    }),
                });
                const searchData = (await searchRes.json()) as { result?: ProductCard[] | string };
                const matches: ProductCard[] = Array.isArray(searchData.result)
                    ? searchData.result.slice(0, 3)
                    : [];

                // 5. Build Pattern H payload, append as Grace message with action
                const payload: ReferenceMatchPayload = {
                    referenceUrl: imageUrl,
                    description,
                    matches: matches.map((m) => ({
                        ...m,
                        heroImageUrl: null,
                        reasoning: "Matched on shape, capacity, and applicator.",
                    })),
                };
                appendInlineMessage({
                    role: "grace",
                    content:
                        matches.length > 0
                            ? `Closest matches based on what I see — ${description}`
                            : `Looked at your reference — ${description}. Nothing in the catalog is a confident match. Try a clearer photo or a closer crop.`,
                    action: { type: "displayReferenceMatch", payload },
                });

                setStatus("done");
            } catch (e) {
                console.error("[Grace upload] Error:", e);
                setStatus("error");
                setError(e instanceof Error ? e.message : "Upload failed");
                appendInlineMessage({
                    role: "grace",
                    content: `I couldn't analyze that image. ${e instanceof Error ? e.message : ""}`.trim(),
                });
            }
        },
        [appendInlineMessage],
    );

    return { uploadAndAnalyze, status, error };
}
