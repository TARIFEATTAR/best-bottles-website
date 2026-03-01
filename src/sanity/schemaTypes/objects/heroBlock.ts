import { defineType, defineField } from "sanity";

export const heroBlock = defineType({
    name: "heroBlock",
    title: "Hero Block",
    type: "object",
    fields: [
        defineField({
            name: "mediaType",
            title: "Media Type",
            type: "string",
            options: {
                list: [
                    { title: "Image", value: "image" },
                    { title: "Video", value: "video" },
                ],
                layout: "radio",
            },
            initialValue: "image",
        }),
        defineField({
            name: "image",
            title: "Hero Image",
            type: "image",
            options: { hotspot: true },
            description: "Primary when media type is image; fallback when video",
        }),
        defineField({
            name: "video",
            title: "Hero Video",
            type: "file",
            options: {
                accept: "video/mp4,video/webm",
            },
            hidden: ({ parent }) => parent?.mediaType !== "video",
        }),
        defineField({
            name: "videoPoster",
            title: "Video Poster",
            type: "image",
            options: { hotspot: true },
            description: "Poster frame shown while video loads",
            hidden: ({ parent }) => parent?.mediaType !== "video",
        }),
        defineField({
            name: "headline",
            title: "Headline",
            type: "string",
            description: "Override default 'Beautifully Contained'",
        }),
        defineField({
            name: "subheadline",
            title: "Subheadline",
            type: "text",
            description: "Override default tagline",
        }),
        defineField({
            name: "eyebrow",
            title: "Eyebrow",
            type: "string",
            description: "Override default 'A Division of Nemat International'",
        }),
    ],
});
