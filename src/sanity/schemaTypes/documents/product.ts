import { defineType, defineField } from "sanity";

/** Stub for journal relatedProducts. Full product schema TBD. */
export const product = defineType({
    name: "product",
    title: "Product (Stub)",
    type: "document",
    fields: [
        defineField({
            name: "title",
            title: "Title",
            type: "string",
        }),
        defineField({
            name: "shopifyHandle",
            title: "Shopify Handle",
            type: "slug",
        }),
    ],
});
