import { defineType, defineField, defineArrayMember } from "sanity";

export const educationPreview = defineType({
    name: "educationPreview",
    title: "Education Preview",
    type: "object",
    fields: [
        defineField({
            name: "sectionTitle",
            title: "Section Title",
            type: "string",
            description: "e.g. Packaging Insights",
            initialValue: "Packaging Insights",
        }),
        defineField({
            name: "sectionEyebrow",
            title: "Section Eyebrow",
            type: "string",
            description: "e.g. From the Lab",
            initialValue: "From the Lab",
        }),
        defineField({
            name: "featuredArticles",
            title: "Featured Articles",
            type: "array",
            of: [defineArrayMember({ type: "reference", to: [{ type: "journal" }] })],
            validation: (Rule) => Rule.max(5),
        }),
        defineField({
            name: "viewAllHref",
            title: "View All Link",
            type: "string",
            description: "URL to blog index",
            initialValue: "/blog",
        }),
    ],
});
