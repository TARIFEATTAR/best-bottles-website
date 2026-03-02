import { defineType, defineField } from "sanity";

export const startHereCard = defineType({
    name: "startHereCard",
    title: "Start Here Card",
    type: "object",
    description: "One card in the Guided Browsing section. Links to a filtered catalog view.",
    fields: [
        defineField({
            name: "title",
            title: "Title",
            type: "string",
            validation: (Rule) => Rule.required(),
            description: "Card title (e.g. essential oils & roll-ons). Use lowercase for consistency.",
        }),
        defineField({
            name: "subtitle",
            title: "Subtitle",
            type: "string",
            description: "Short description shown on the card. Uppercase for emphasis.",
        }),
        defineField({
            name: "href",
            title: "Link URL",
            type: "string",
            description: "Where the card links. Examples: /catalog?applicators=rollon, /catalog?families=Vial, /catalog?category=Packaging",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "image",
            title: "Card Image",
            type: "image",
            options: { hotspot: true },
            description: "Product or lifestyle image. Recommended: 600×400px. Leave empty to use default.",
        }),
        defineField({
            name: "backgroundColor",
            title: "Background Color",
            type: "string",
            description: "Hex color (e.g. #DFD6C9) for the card background. Use a color picker or leave empty.",
        }),
    ],
    preview: {
        select: { title: "title" },
        prepare({ title }) {
            return { title: title || "Start Here Card" };
        },
    },
});
