import { defineType, defineField } from "sanity";

export const megaMenuFeaturedCard = defineType({
    name: "megaMenuFeaturedCard",
    title: "Mega Menu Featured Card",
    type: "object",
    fields: [
        defineField({
            name: "featuredImage",
            title: "Featured Image",
            type: "image",
            options: { hotspot: true },
        }),
        defineField({
            name: "title",
            title: "Title",
            type: "string",
        }),
        defineField({
            name: "subtitle",
            title: "Subtitle",
            type: "text",
        }),
        defineField({
            name: "href",
            title: "Link URL",
            type: "string",
        }),
    ],
});
