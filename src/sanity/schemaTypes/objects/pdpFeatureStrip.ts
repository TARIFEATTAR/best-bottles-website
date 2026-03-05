import { defineType, defineField, defineArrayMember } from "sanity";
import { StarIcon } from "@sanity/icons";

// Valid Lucide icon names editors can pick from.
// These are mapped to actual React components in the frontend.
const ICON_OPTIONS = [
    { title: "Shield — Quality / Durability", value: "Shield" },
    { title: "Droplets — Liquid-Safe / Leak-Proof", value: "Droplets" },
    { title: "Sun — UV Protection", value: "Sun" },
    { title: "Leaf — Eco / Natural / Sustainable", value: "Leaf" },
    { title: "Zap — Fast Shipping", value: "Zap" },
    { title: "Award — Certified / Premium Grade", value: "Award" },
    { title: "FlaskConical — Lab-Tested / Type III Glass", value: "FlaskConical" },
    { title: "Package — Ready to Ship", value: "Package" },
    { title: "Recycle — Recyclable / Refillable", value: "Recycle" },
    { title: "Layers — Multiple Variants Available", value: "Layers" },
    { title: "Check — In Stock / Verified", value: "Check" },
    { title: "Star — Best Seller", value: "Star" },
    { title: "Clock — Limited Time", value: "Clock" },
    { title: "Sparkles — New Arrival", value: "Sparkles" },
    { title: "Tag — On Sale", value: "Tag" },
    { title: "Globe — Made in USA", value: "Globe" },
];

export const pdpFeatureStrip = defineType({
    name: "pdpFeatureStrip",
    title: "Feature Strip",
    type: "object",
    icon: StarIcon,
    description: "A horizontal row of icon + label cards. Great for callouts like 'UV Protected', 'Type III Glass', 'Ships in 3 Days'.",
    fields: [
        defineField({
            name: "items",
            title: "Feature Items",
            type: "array",
            of: [
                defineArrayMember({
                    type: "object",
                    fields: [
                        defineField({
                            name: "icon",
                            title: "Icon",
                            type: "string",
                            options: { list: ICON_OPTIONS },
                            validation: (Rule) => Rule.required(),
                            description: "Icon shown above the label.",
                        }),
                        defineField({
                            name: "label",
                            title: "Label",
                            type: "string",
                            validation: (Rule) => Rule.required().max(40),
                            description: "Short callout text, e.g. 'UV Protected' or 'Type III Glass'.",
                        }),
                        defineField({
                            name: "body",
                            title: "Tooltip / Sub-text",
                            type: "string",
                            description: "Optional one-liner shown on hover or below the label.",
                        }),
                    ],
                    preview: {
                        select: { title: "label", subtitle: "icon" },
                        prepare({ title, subtitle }) {
                            return { title: title ?? "Feature", subtitle: subtitle };
                        },
                    },
                }),
            ],
            validation: (Rule) => Rule.min(1).max(8),
            description: "Add 1–8 features. Drag to reorder.",
        }),
    ],
    preview: {
        select: { items: "items" },
        prepare({ items }) {
            const count = Array.isArray(items) ? items.length : 0;
            return { title: "Feature Strip", subtitle: `${count} item${count !== 1 ? "s" : ""}` };
        },
    },
});
