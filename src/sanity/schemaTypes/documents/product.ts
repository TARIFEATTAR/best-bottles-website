import { defineType, defineField } from "sanity";

export const product = defineType({
    name: "product",
    title: "Product",
    type: "document",
    fields: [
        defineField({
            name: "title",
            title: "Title",
            type: "string",
        }),
        defineField({
            name: "websiteSku",
            title: "Website SKU",
            type: "string",
            description:
                "The websiteSku from Convex — links this Sanity record to a specific product variant. Used to look up editorial content on the product page.",
        }),
        defineField({
            name: "description",
            title: "Product Description",
            type: "text",
            rows: 5,
            description:
                "Editorial description shown below the Add to Cart button on the product detail page. Overrides the catalog description when present.",
        }),
        defineField({
            name: "shopifyHandle",
            title: "Shopify Handle",
            type: "slug",
        }),
    ],
});
