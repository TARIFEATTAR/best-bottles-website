import { defineType, defineField, defineArrayMember } from "sanity";
import { ImagesIcon } from "@sanity/icons";

export const pdpGalleryRow = defineType({
    name: "pdpGalleryRow",
    title: "Gallery Row",
    type: "object",
    icon: ImagesIcon,
    description: "A scrollable row of additional product images — lifestyle shots, in-use photos, detail close-ups. These appear alongside or below the main product image.",
    fields: [
        defineField({
            name: "eyebrow",
            title: "Section Label",
            type: "string",
            description: "Optional label above the gallery.",
            initialValue: "Gallery",
        }),
        defineField({
            name: "images",
            title: "Images",
            type: "array",
            of: [
                defineArrayMember({
                    type: "object",
                    fields: [
                        defineField({
                            name: "image",
                            title: "Image",
                            type: "image",
                            options: { hotspot: true },
                            validation: (Rule) => Rule.required(),
                        }),
                        defineField({
                            name: "alt",
                            title: "Alt Text",
                            type: "string",
                            description: "Describe the image for screen readers and SEO.",
                            validation: (Rule) => Rule.required().max(120),
                        }),
                        defineField({
                            name: "caption",
                            title: "Caption",
                            type: "string",
                            description: "Optional caption shown below the image.",
                        }),
                    ],
                    preview: {
                        select: { title: "alt", media: "image" },
                        prepare({ title, media }) {
                            return { title: title ?? "Image", media };
                        },
                    },
                }),
            ],
            validation: (Rule) => Rule.min(1).max(12),
            description: "Upload 1–12 images. Recommended: 800×800px square or 4:3 landscape.",
        }),
        defineField({
            name: "layout",
            title: "Layout",
            type: "string",
            options: {
                list: [
                    { title: "Scroll row (horizontal)", value: "scroll" },
                    { title: "Grid (2 or 3 columns)", value: "grid" },
                ],
                layout: "radio",
            },
            initialValue: "scroll",
        }),
    ],
    preview: {
        select: { images: "images", eyebrow: "eyebrow" },
        prepare({ images, eyebrow }) {
            const count = Array.isArray(images) ? images.length : 0;
            return { title: eyebrow ?? "Gallery Row", subtitle: `${count} image${count !== 1 ? "s" : ""}` };
        },
    },
});
