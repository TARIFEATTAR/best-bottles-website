import { defineType, defineField, defineArrayMember } from "sanity";
import { BookIcon } from "@sanity/icons";

export const journal = defineType({
    name: "journal",
    title: "Journal Article",
    type: "document",
    icon: BookIcon,
    fields: [
        defineField({
            name: "title",
            title: "Title",
            type: "string",
            validation: (Rule) => Rule.required().max(100),
        }),
        defineField({
            name: "slug",
            title: "Slug",
            type: "slug",
            options: { source: "title", maxLength: 96 },
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "category",
            title: "Category",
            type: "string",
            options: {
                list: [
                    { title: "Packaging 101", value: "packaging-101" },
                    { title: "Fragrance Guides", value: "fragrance-guides" },
                    { title: "Brand Stories", value: "brand-stories" },
                    { title: "Ingredient Science", value: "ingredient-science" },
                    { title: "How-To", value: "how-to" },
                    { title: "Industry News", value: "industry-news" },
                ],
            },
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "publishedAt",
            title: "Published At",
            type: "datetime",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "estimatedReadTime",
            title: "Estimated Read Time (minutes)",
            type: "number",
            validation: (Rule) => Rule.required().min(0),
        }),
        defineField({
            name: "excerpt",
            title: "Excerpt",
            type: "text",
            validation: (Rule) => Rule.max(300),
        }),
        defineField({
            name: "image",
            title: "Hero Image",
            type: "image",
            options: { hotspot: true },
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "content",
            title: "Content",
            type: "array",
            of: [
                defineArrayMember({ type: "block" }),
                defineArrayMember({
                    type: "image",
                    fields: [
                        defineField({ name: "alt", title: "Alt Text", type: "string" }),
                        defineField({ name: "caption", title: "Caption", type: "string" }),
                    ],
                }),
            ],
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "relatedProducts",
            title: "Related Products",
            type: "array",
            of: [defineArrayMember({ type: "reference", to: [{ type: "product" }] })],
        }),
        // Madison Studio workflow fields
        defineField({
            name: "madisonId",
            title: "Madison ID",
            type: "string",
            description: "UUID from Madison Studio — set automatically on sync",
            readOnly: true,
        }),
        defineField({
            name: "readyForReview",
            title: "Ready for Review",
            type: "boolean",
            description: "Set by Madison Studio when content is ready for editorial review",
            initialValue: false,
        }),
        defineField({
            name: "generationSource",
            title: "Generation Source",
            type: "string",
            options: {
                list: [
                    { title: "Madison Studio (AI)", value: "madison-studio" },
                    { title: "Manual", value: "manual" },
                ],
                layout: "radio",
            },
            initialValue: "manual",
        }),
    ],
    preview: {
        select: {
            title: "title",
            subtitle: "category",
            media: "image",
        },
    },
});
