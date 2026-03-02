import { defineType, defineField } from "sanity";

export const megaMenuPanels = defineType({
    name: "megaMenuPanels",
    title: "Mega Menu Panels",
    type: "object",
    description: "Optional featured images for the dropdown menus (Bottles, Closures, Specialty). Links appear when hovering nav items.",
    fields: [
        defineField({
            name: "bottles",
            title: "Bottles Panel",
            type: "megaMenuFeaturedCard",
            description: "Featured image for the Bottles dropdown. Leave empty for icon-only.",
        }),
        defineField({
            name: "closures",
            title: "Closures Panel",
            type: "megaMenuFeaturedCard",
            description: "Featured image for the Closures dropdown.",
        }),
        defineField({
            name: "specialty",
            title: "Specialty Panel",
            type: "megaMenuFeaturedCard",
            description: "Featured image for the Specialty dropdown.",
        }),
    ],
});
