import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./src/sanity/schemaTypes";

export default defineConfig({
    name: "best-bottles",
    title: "Best Bottles",
    projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.SANITY_STUDIO_DATASET ?? process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    plugins: [
        structureTool({
            structure: (S) =>
                S.list()
                    .title("Content")
                    .items([
                        // ── Site Content ─────────────────────────────────────
                        S.listItem()
                            .title("Homepage")
                            .child(
                                S.documentList()
                                    .title("Homepage")
                                    .filter('_type == "homepagePage"')
                                    .defaultOrdering([{ field: "_updatedAt", direction: "desc" }])
                            ),
                        S.listItem()
                            .title("Journal Articles")
                            .child(
                                S.documentList()
                                    .title("Journal Articles")
                                    .filter('_type == "journal"')
                                    .defaultOrdering([{ field: "publishedAt", direction: "desc" }])
                            ),
                        S.divider(),
                        // ── Product Pages ─────────────────────────────────────
                        S.listItem()
                            .title("Product Family Templates")
                            .child(
                                S.documentList()
                                    .title("Family Templates")
                                    .filter('_type == "productFamilyContent"')
                                    .defaultOrdering([{ field: "family", direction: "asc" }])
                            ),
                        S.listItem()
                            .title("Product Page Overrides")
                            .child(
                                S.documentList()
                                    .title("Product Overrides")
                                    .filter('_type == "productGroupContent"')
                                    .defaultOrdering([{ field: "_updatedAt", direction: "desc" }])
                            ),
                        S.divider(),
                        // ── Everything else ────────────────────────────────────
                        ...S.documentTypeListItems().filter(
                            (item) =>
                                !["homepagePage", "journal", "productFamilyContent", "productGroupContent"].includes(
                                    item.getId() ?? ""
                                )
                        ),
                    ]),
        }),
        visionTool(),
    ],
    schema: {
        types: schemaTypes,
    },
});
