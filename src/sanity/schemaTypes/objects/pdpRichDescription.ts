import { defineType, defineField } from "sanity";
import { DocumentTextIcon } from "@sanity/icons";

export const pdpRichDescription = defineType({
    name: "pdpRichDescription",
    title: "Rich Description",
    type: "object",
    icon: DocumentTextIcon,
    description: "Full editorial copy for this product. Supports bold, italics, links, and callout quotes. Overrides the plain-text description from the catalog.",
    fields: [
        defineField({
            name: "eyebrow",
            title: "Eyebrow Label",
            type: "string",
            description: "Small uppercase label above the heading. Example: About This Product",
            initialValue: "About This Product",
        }),
        defineField({
            name: "heading",
            title: "Section Heading",
            type: "string",
            description: "Optional heading above the body text.",
        }),
        defineField({
            name: "body",
            title: "Body",
            type: "array",
            of: [
                {
                    type: "block",
                    marks: {
                        annotations: [
                            {
                                name: "link",
                                type: "object",
                                title: "Link",
                                fields: [
                                    {
                                        name: "href",
                                        type: "url",
                                        title: "URL",
                                        validation: (Rule) =>
                                            Rule.uri({
                                                scheme: ["http", "https", "mailto", "tel"],
                                                allowRelative: true,
                                            }),
                                    },
                                ],
                            },
                        ],
                        decorators: [
                            { title: "Bold", value: "strong" },
                            { title: "Italic", value: "em" },
                            { title: "Underline", value: "underline" },
                        ],
                    },
                    styles: [
                        { title: "Normal", value: "normal" },
                        { title: "Heading", value: "h3" },
                        { title: "Quote", value: "blockquote" },
                    ],
                    lists: [
                        { title: "Bullet", value: "bullet" },
                        { title: "Numbered", value: "number" },
                    ],
                },
            ],
            description: "Use bold for key terms, blockquotes for standout statements.",
            validation: (Rule) => Rule.required(),
        }),
    ],
    preview: {
        select: { eyebrow: "eyebrow", heading: "heading" },
        prepare({ eyebrow, heading }) {
            return { title: heading ?? "Rich Description", subtitle: eyebrow };
        },
    },
});
