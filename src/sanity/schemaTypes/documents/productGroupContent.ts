import { defineType, defineField, defineArrayMember } from "sanity";
import { EditIcon } from "@sanity/icons";

export const productGroupContent = defineType({
    name: "productGroupContent",
    title: "Product Page Override",
    type: "document",
    icon: EditIcon,
    description: "Editorial content for a specific product page. Identified by its catalog slug (e.g. diva-10ml-clear-rollon-bottle). Blocks here are merged with the family template — product-level blocks appear first.",
    fields: [
        defineField({
            name: "slug",
            title: "Product Slug",
            type: "slug",
            description: "Must match the product's URL slug exactly (e.g. diva-10ml-clear-rollon-bottle). Copy it from the browser bar when viewing the product page.",
            validation: (Rule) => Rule.required(),
            options: { source: "title" },
        }),
        defineField({
            name: "title",
            title: "Internal Label",
            type: "string",
            description: "For your reference only — not shown on the site. Use the product display name.",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "overrideTemplate",
            title: "Override Family Template?",
            type: "boolean",
            initialValue: false,
            description: "OFF = this product's blocks are prepended to the family template blocks. ON = only this product's blocks are shown (family template is ignored entirely).",
        }),
        defineField({
            name: "pageBlocks",
            title: "Page Blocks",
            type: "array",
            of: [
                defineArrayMember({ type: "pdpFeatureStrip" }),
                defineArrayMember({ type: "pdpRichDescription" }),
                defineArrayMember({ type: "pdpGalleryRow" }),
                defineArrayMember({ type: "pdpPromoBanner" }),
                defineArrayMember({ type: "pdpFaqAccordion" }),
                defineArrayMember({ type: "pdpTrustBadges" }),
            ],
            description: "Add and reorder blocks for this product specifically. If Override Family Template is OFF, these appear before the family blocks.",
        }),
    ],
    preview: {
        select: { title: "title", slug: "slug.current", override: "overrideTemplate" },
        prepare({ title, slug, override }) {
            return {
                title: title ?? slug ?? "Product Override",
                subtitle: `/${slug ?? "?"}${override ? " · full override" : ""}`,
            };
        },
    },
});
