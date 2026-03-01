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
                        S.listItem()
                            .title("Homepage")
                            .child(
                                S.documentList()
                                    .title("Homepage")
                                    .filter('_type == "homepagePage"')
                                    .defaultOrdering([{ field: "_updatedAt", direction: "desc" }])
                            ),
                        S.divider(),
                        ...S.documentTypeListItems().filter((item) => item.getId() !== "homepagePage"),
                    ]),
        }),
        visionTool(),
    ],
    schema: {
        types: schemaTypes,
    },
});
