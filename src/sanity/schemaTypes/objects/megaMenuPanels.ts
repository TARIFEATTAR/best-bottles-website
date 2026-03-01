import { defineType, defineField } from "sanity";

export const megaMenuPanels = defineType({
    name: "megaMenuPanels",
    title: "Mega Menu Panels",
    type: "object",
    description: "Optional featured images for mega menu panels. Link structure stays in code.",
    fields: [
        defineField({
            name: "bottles",
            title: "Bottles Panel",
            type: "megaMenuFeaturedCard",
        }),
        defineField({
            name: "closures",
            title: "Closures Panel",
            type: "megaMenuFeaturedCard",
        }),
        defineField({
            name: "specialty",
            title: "Specialty Panel",
            type: "megaMenuFeaturedCard",
        }),
    ],
});
