import { defineType, defineField, defineArrayMember } from "sanity";
import { HomeIcon } from "@sanity/icons";

export const homepagePage = defineType({
    name: "homepagePage",
    title: "Homepage",
    type: "document",
    icon: HomeIcon,
    fields: [
        defineField({
            name: "hero",
            title: "Hero",
            type: "heroBlock",
        }),
        defineField({
            name: "startHereCards",
            title: "Start Here Cards",
            type: "array",
            of: [defineArrayMember({ type: "startHereCard" })],
            validation: (Rule) => Rule.max(6),
        }),
        defineField({
            name: "designFamilyCards",
            title: "Design Family Cards",
            type: "array",
            of: [defineArrayMember({ type: "designFamilyCard" })],
            validation: (Rule) => Rule.max(12),
        }),
        defineField({
            name: "educationPreview",
            title: "Education Preview",
            type: "educationPreview",
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
