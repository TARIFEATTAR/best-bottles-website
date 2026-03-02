import { defineType, defineField } from "sanity";

export const heroBlock = defineType({
    name: "heroBlock",
    title: "Hero Block",
    type: "object",
    description: "The large banner at the top of the homepage. Choose image or video, then add text overlays.",
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
            description: "Image = static photo. Video = auto-playing MP4/WebM (add a poster image for loading).",
        }),
        defineField({
            name: "image",
            title: "Hero Image",
            type: "image",
            options: { hotspot: true },
            description: "Main hero image. Use hotspot to crop the focal point. Recommended: 1920×1080 or larger.",
        }),
        defineField({
            name: "video",
            title: "Hero Video",
            type: "file",
            options: {
                accept: "video/mp4,video/webm",
            },
            hidden: ({ parent }) => parent?.mediaType !== "video",
            description: "MP4 or WebM. Keep under 10MB for fast loading.",
        }),
        defineField({
            name: "videoPoster",
            title: "Video Poster",
            type: "image",
            options: { hotspot: true },
            description: "Frame shown while video loads. Use a key frame from the video.",
            hidden: ({ parent }) => parent?.mediaType !== "video",
        }),
        defineField({
            name: "headline",
            title: "Headline",
            type: "string",
            description: "Main heading (e.g. Beautifully Contained). Leave empty for default.",
        }),
        defineField({
            name: "subheadline",
            title: "Subheadline",
            type: "text",
            description: "Supporting tagline below the headline. Leave empty for default.",
        }),
        defineField({
            name: "eyebrow",
            title: "Eyebrow",
            type: "string",
            description: "Small label above the headline (e.g. A Division of Nemat International).",
        }),
        defineField({
            name: "ctaText",
            title: "Button Text",
            type: "string",
            description: "Primary CTA button label (e.g. Explore Collections, Shop Black Friday). Leave empty for default.",
            initialValue: "Explore Collections",
        }),
        defineField({
            name: "ctaHref",
            title: "Button Link",
            type: "string",
            description: "Where the button goes. Examples: /catalog, /catalog?search=sale, /catalog?families=Boston+Round",
            initialValue: "/catalog",
        }),
    ],
});
