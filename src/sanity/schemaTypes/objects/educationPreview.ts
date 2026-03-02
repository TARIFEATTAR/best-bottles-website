import { defineType, defineField, defineArrayMember } from "sanity";

export const educationPreview = defineType({
    name: "educationPreview",
    title: "Education Preview",
    type: "object",
    description: "Featured blog articles section. Links to Journal posts.",
    fields: [
        defineField({
            name: "sectionTitle",
            title: "Section Title",
            type: "string",
            description: "Main heading (e.g. Packaging Insights)",
            initialValue: "Packaging Insights",
        }),
        defineField({
            name: "sectionEyebrow",
            title: "Section Eyebrow",
            type: "string",
            description: "Small label above the title (e.g. From the Lab)",
            initialValue: "From the Lab",
        }),
        defineField({
            name: "featuredArticles",
            title: "Featured Articles",
            type: "array",
            of: [defineArrayMember({ type: "reference", to: [{ type: "journal" }] })],
            validation: (Rule) => Rule.max(5),
            description: "Select up to 5 Journal articles to feature. Create articles in the Journal section first.",
        }),
        defineField({
            name: "viewAllHref",
            title: "View All Link",
            type: "string",
            description: "URL for the View All button. Usually /blog or /resources.",
            initialValue: "/blog",
        }),
    ],
});
