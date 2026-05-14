import { NextResponse } from "next/server";
import { fetchCatalogPdfData } from "@/lib/pdf/catalog/data";
import { parseCatalogPdfOptions } from "@/lib/pdf/catalog/query";
import { renderCatalogPdf } from "@/lib/pdf/catalog/puppeteer";
import { renderCatalogHtml } from "@/lib/pdf/catalog/template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
    const url = new URL(req.url);
    const options = parseCatalogPdfOptions(url.searchParams);

    try {
        const data = await fetchCatalogPdfData(options);

        if (data.groups.length === 0 && data.products.length === 0) {
            return NextResponse.json(
                {
                    error: "No catalog products matched the supplied filters.",
                    filters: {
                        category: options.category,
                        collection: options.collection,
                        family: options.family,
                        brand: options.brand,
                        applicators: options.applicators,
                        search: options.search,
                    },
                },
                { status: 404 },
            );
        }

        const html = await renderCatalogHtml(data);

        if (options.debugHtml) {
            return new Response(html, {
                headers: {
                    "Cache-Control": "no-store",
                    "Content-Type": "text/html; charset=utf-8",
                },
            });
        }

        const pdf = await renderCatalogPdf(html);
        const disposition = options.inline ? "inline" : "attachment";

        return new Response(new Uint8Array(pdf), {
            headers: {
                "Cache-Control": "no-store",
                "Content-Disposition": `${disposition}; filename="${options.filename}.pdf"`,
                "Content-Length": String(pdf.byteLength),
                "Content-Type": "application/pdf",
                "X-Catalog-Groups": String(data.groups.length),
                "X-Catalog-Products": String(data.facets.totalProducts),
                "X-Catalog-Renderer": "puppeteer-chrome-print-css",
            },
        });
    } catch (error) {
        console.error("[pdf/catalog] Failed to generate catalog PDF", error);
        const message = error instanceof Error ? error.message : "Unknown PDF generation error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
