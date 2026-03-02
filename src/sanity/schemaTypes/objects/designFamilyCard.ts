import { defineType, defineField } from "sanity";

export const designFamilyCard = defineType({
    name: "designFamilyCard",
    title: "Design Family Card",
    type: "object",
    description: "One bottle family in the Design Families carousel. Family Slug must match catalog exactly.",
    fields: [
        defineField({
            name: "family",
            title: "Family Slug",
            type: "string",
            description: "Must match catalog exactly. Examples: Cylinder, Boston Round, Diva, Elegant, Sleek, Atomizer, Flair. Do not change unless adding a new family.",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "title",
            title: "Display Title",
            type: "string",
            description: "Label shown on the card. Can differ from Family Slug (e.g. Atomizers for Atomizer).",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "image",
            title: "Card Image",
            type: "image",
            options: { hotspot: true },
            description: "Bottle or product image. Recommended: 600×800px portrait. Leave empty to use default.",
        }),
        defineField({
            name: "order",
            title: "Sort Order",
            type: "number",
            initialValue: 0,
            description: "Lower numbers appear first. 0, 1, 2, 3...",
        }),
    ],
    preview: {
        select: { title: "title", family: "family" },
        prepare({ title, family }) {
            return { title: title || family || "Design Family Card" };
        },
    },
});
