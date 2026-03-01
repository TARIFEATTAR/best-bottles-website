import { defineType, defineField } from "sanity";

export const designFamilyCard = defineType({
    name: "designFamilyCard",
    title: "Design Family Card",
    type: "object",
    fields: [
        defineField({
            name: "family",
            title: "Family Slug",
            type: "string",
            description: "Convex family slug (e.g. Cylinder, Boston Round)",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "title",
            title: "Display Title",
            type: "string",
            description: "Label shown on the card",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "image",
            title: "Card Image",
            type: "image",
            options: { hotspot: true },
            description: "Drop your image here. Frontend falls back to default if empty.",
        }),
        defineField({
            name: "order",
            title: "Sort Order",
            type: "number",
            initialValue: 0,
        }),
    ],
    preview: {
        select: { title: "title", family: "family" },
        prepare({ title, family }) {
            return { title: title || family || "Design Family Card" };
        },
    },
});
