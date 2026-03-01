import { defineType, defineField } from "sanity";

export const startHereCard = defineType({
    name: "startHereCard",
    title: "Start Here Card",
    type: "object",
    fields: [
        defineField({
            name: "title",
            title: "Title",
            type: "string",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "subtitle",
            title: "Subtitle",
            type: "string",
        }),
        defineField({
            name: "href",
            title: "Link URL",
            type: "string",
            description: "Catalog URL with query params (e.g. /catalog?applicators=rollon)",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "image",
            title: "Card Image",
            type: "image",
            options: { hotspot: true },
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "backgroundColor",
            title: "Background Color",
            type: "string",
            description: "Hex (e.g. #DFD6C9) or leave empty for default",
        }),
    ],
    preview: {
        select: { title: "title" },
        prepare({ title }) {
            return { title: title || "Start Here Card" };
        },
    },
});
