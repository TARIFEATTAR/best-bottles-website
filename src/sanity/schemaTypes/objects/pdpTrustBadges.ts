import { defineType, defineField, defineArrayMember } from "sanity";
import { TagIcon } from "@sanity/icons";

const PRESET_BADGES = [
    { title: "UV Protected", value: "UV Protected" },
    { title: "Type III Glass", value: "Type III Glass" },
    { title: "Sample Ready", value: "Sample Ready" },
    { title: "Low MOQ", value: "Low MOQ" },
    { title: "Ships in 3–5 Days", value: "Ships in 3–5 Days" },
    { title: "Made in USA", value: "Made in USA" },
    { title: "Leak-Proof", value: "Leak-Proof" },
    { title: "Recyclable", value: "Recyclable" },
    { title: "Refillable", value: "Refillable" },
    { title: "Fragrance Safe", value: "Fragrance Safe" },
    { title: "Essential Oil Safe", value: "Essential Oil Safe" },
    { title: "Cosmetic Grade", value: "Cosmetic Grade" },
    { title: "In Stock", value: "In Stock" },
    { title: "New Arrival", value: "New Arrival" },
    { title: "Best Seller", value: "Best Seller" },
    { title: "Volume Pricing Available", value: "Volume Pricing Available" },
];

export const pdpTrustBadges = defineType({
    name: "pdpTrustBadges",
    title: "Trust Badges",
    type: "object",
    icon: TagIcon,
    description: "Small pill badges that appear as a row below the product name or Add to Cart. Use presets or add custom text.",
    fields: [
        defineField({
            name: "badges",
            title: "Badge Labels",
            type: "array",
            of: [
                defineArrayMember({
                    type: "object",
                    fields: [
                        defineField({
                            name: "label",
                            title: "Badge Text",
                            type: "string",
                            description: "Choose a preset or type your own (max 30 characters).",
                            options: { list: PRESET_BADGES },
                            validation: (Rule) => Rule.required().max(30),
                        }),
                        defineField({
                            name: "style",
                            title: "Style",
                            type: "string",
                            options: {
                                list: [
                                    { title: "Default (light outline)", value: "default" },
                                    { title: "Gold (highlight)", value: "gold" },
                                    { title: "Dark (emphasis)", value: "dark" },
                                    { title: "Green (in stock / eco)", value: "green" },
                                ],
                                layout: "radio",
                            },
                            initialValue: "default",
                        }),
                    ],
                    preview: {
                        select: { title: "label", subtitle: "style" },
                        prepare({ title, subtitle }) {
                            return { title: title ?? "Badge", subtitle: subtitle };
                        },
                    },
                }),
            ],
            validation: (Rule) => Rule.min(1).max(10),
            description: "Add up to 10 badges. Drag to reorder.",
        }),
    ],
    preview: {
        select: { badges: "badges" },
        prepare({ badges }) {
            const labels = Array.isArray(badges) ? badges.map((b: { label?: string }) => b.label).filter(Boolean).join(" · ") : "";
            return { title: "Trust Badges", subtitle: labels || "No badges" };
        },
    },
});
