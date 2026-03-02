import { defineType, defineField } from "sanity";

export const megaMenuFeaturedCard = defineType({
    name: "megaMenuFeaturedCard",
    title: "Mega Menu Featured Card",
    type: "object",
    description: "Optional featured image and link for a mega menu dropdown.",
    fields: [
        defineField({
            name: "featuredImage",
            title: "Featured Image",
            type: "image",
            options: { hotspot: true },
            description: "Image shown in the dropdown. Recommended: 400×300px.",
        }),
        defineField({
            name: "title",
            title: "Title",
            type: "string",
            description: "Link text (e.g. Shop Boston Rounds)",
        }),
        defineField({
            name: "subtitle",
            title: "Subtitle",
            type: "text",
            description: "Optional supporting text",
        }),
        defineField({
            name: "href",
            title: "Link URL",
            type: "string",
            description: "Where the card links (e.g. /catalog?families=Boston+Round)",
        }),
    ],
});
