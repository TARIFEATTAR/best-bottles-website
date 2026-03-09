import { defineType, defineField } from "sanity";

export const mobileCategoryCard = defineType({
    name: "mobileCategoryCard",
    title: "Mobile Category Card",
    type: "object",
    description: "A compact category card shown on mobile in place of the hero. 2-column grid layout.",
    fields: [
        defineField({
            name: "label",
            title: "Label",
            type: "string",
            validation: (Rule) => Rule.required(),
            description: "Short category name (e.g. Roll-On Bottles, Spray Bottles). Keep it under 20 characters.",
        }),
        defineField({
            name: "href",
            title: "Link URL",
            type: "string",
            validation: (Rule) => Rule.required(),
            description: "Where the card links. Examples: /catalog?applicators=rollon, /catalog?families=Cylinder",
        }),
        defineField({
            name: "image",
            title: "Card Image",
            type: "image",
            options: { hotspot: true },
            description: "Product lifestyle image. Recommended: 400×500px (portrait). Leave empty to use a placeholder.",
        }),
    ],
    preview: {
        select: { title: "label" },
        prepare({ title }) {
            return { title: title || "Mobile Category Card" };
        },
    },
});
