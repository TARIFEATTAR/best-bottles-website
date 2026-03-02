import { defineType, defineField, defineArrayMember } from "sanity";
import { HomeIcon } from "@sanity/icons";

export const homepagePage = defineType({
    name: "homepagePage",
    title: "Homepage",
    type: "document",
    icon: HomeIcon,
    fields: [
        defineField({
            name: "heroSlides",
            title: "Hero Slider",
            type: "array",
            of: [defineArrayMember({ type: "heroBlock" })],
            validation: (Rule) => Rule.min(1).max(6),
            description: "Add 1 slide for a static hero, or 2+ for a rotating carousel (e.g. Black Friday, seasonal promos). Each slide has its own image, text, and button link.",
        }),
        defineField({
            name: "startHereEyebrow",
            title: "Start Here — Eyebrow",
            type: "string",
            description: "Small uppercase label above the section title. Example: Guided Browsing",
            initialValue: "Guided Browsing",
        }),
        defineField({
            name: "startHereTitle",
            title: "Start Here — Section Title",
            type: "string",
            description: "Main heading for the section. Example: Start Here",
            initialValue: "Start Here",
        }),
        defineField({
            name: "startHereSubheading",
            title: "Start Here — Subheading",
            type: "text",
            description: "Supporting sentence below the title. Explains what the cards do.",
            initialValue: "Choose your use case to narrow the catalog faster.",
        }),
        defineField({
            name: "startHereCards",
            title: "Start Here Cards",
            type: "array",
            of: [defineArrayMember({ type: "startHereCard" })],
            validation: (Rule) => Rule.max(6),
            description: "Up to 6 cards. Each links to a filtered catalog view. Drag to reorder.",
        }),
        defineField({
            name: "designFamilyCards",
            title: "Design Family Cards",
            type: "array",
            of: [defineArrayMember({ type: "designFamilyCard" })],
            validation: (Rule) => Rule.max(12),
            description: "Bottle families shown in the carousel. Family Slug must match catalog exactly (e.g. Boston Round, Cylinder). Use Order to sort.",
        }),
        defineField({
            name: "educationPreview",
            title: "Education Preview",
            type: "educationPreview",
            description: "Featured blog articles and section heading. Links to Journal posts.",
        }),
        defineField({
            name: "megaMenuPanels",
            title: "Mega Menu Panels",
            type: "megaMenuPanels",
            description: "Optional featured images for mega menu. Link structure stays in code.",
        }),
    ],
    preview: {
        prepare() {
            return { title: "Homepage" };
        },
    },
});
