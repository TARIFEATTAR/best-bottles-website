import { defineType, defineField, defineArrayMember } from "sanity";
import { HelpCircleIcon } from "@sanity/icons";

export const pdpFaqAccordion = defineType({
    name: "pdpFaqAccordion",
    title: "FAQ Accordion",
    type: "object",
    icon: HelpCircleIcon,
    description: "Collapsible Q&A section. Use for product-specific questions about compatibility, care, materials, or ordering.",
    fields: [
        defineField({
            name: "eyebrow",
            title: "Section Label",
            type: "string",
            initialValue: "Frequently Asked",
            description: "Small label above the accordion.",
        }),
        defineField({
            name: "heading",
            title: "Section Heading",
            type: "string",
            initialValue: "Questions & Answers",
        }),
        defineField({
            name: "items",
            title: "Questions",
            type: "array",
            of: [
                defineArrayMember({
                    type: "object",
                    fields: [
                        defineField({
                            name: "question",
                            title: "Question",
                            type: "string",
                            validation: (Rule) => Rule.required(),
                        }),
                        defineField({
                            name: "answer",
                            title: "Answer",
                            type: "array",
                            of: [{ type: "block" }],
                            description: "Supports bold, italics, and links.",
                            validation: (Rule) => Rule.required(),
                        }),
                    ],
                    preview: {
                        select: { title: "question" },
                        prepare({ title }) {
                            return { title: title ?? "Question" };
                        },
                    },
                }),
            ],
            validation: (Rule) => Rule.min(1).max(20),
            description: "Add questions. Drag to reorder.",
        }),
    ],
    preview: {
        select: { items: "items", heading: "heading" },
        prepare({ items, heading }) {
            const count = Array.isArray(items) ? items.length : 0;
            return { title: heading ?? "FAQ Accordion", subtitle: `${count} question${count !== 1 ? "s" : ""}` };
        },
    },
});
