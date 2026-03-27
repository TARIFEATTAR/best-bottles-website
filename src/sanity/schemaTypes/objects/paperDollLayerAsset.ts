import { defineType, defineField } from "sanity";
import { ImageIcon } from "@sanity/icons";

/**
 * One layer PNG for the Paper Doll compositor (body, cap, roller, sprayer, or pump).
 */
export const paperDollLayerAsset = defineType({
    name: "paperDollLayerAsset",
    title: "Paper Doll Layer Asset",
    type: "object",
    icon: ImageIcon,
    fields: [
        defineField({
            name: "slot",
            title: "Slot",
            type: "string",
            options: {
                list: [
                    { title: "Body (glass)", value: "body" },
                    { title: "Cap", value: "cap" },
                    { title: "Roller fitment", value: "roller" },
                    { title: "Sprayer", value: "sprayer" },
                    { title: "Lotion pump", value: "pump" },
                ],
                layout: "dropdown",
            },
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "variantKey",
            title: "Variant key",
            type: "string",
            description: "Short code matching filenames, e.g. CLR, BLK-DOT, MTL-ROLL",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "sourceFilename",
            title: "Source filename",
            type: "string",
            description: "Original PNG basename for traceability",
        }),
        defineField({
            name: "image",
            title: "Layer PNG",
            type: "image",
            options: { hotspot: false },
            validation: (Rule) => Rule.required(),
        }),
    ],
    preview: {
        select: { slot: "slot", variantKey: "variantKey", media: "image" },
        prepare({ slot, variantKey, media }) {
            return {
                title: `${slot ?? "?"} — ${variantKey ?? ""}`,
                media,
            };
        },
    },
});
