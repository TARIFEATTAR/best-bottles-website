import { defineType, defineField, defineArrayMember } from "sanity";
import { ComponentIcon } from "@sanity/icons";

/**
 * Paper Doll family: one document per configurable bottle family (e.g. CYL-9ML).
 * References all normalized layer PNGs and stores canvas + layer order metadata.
 */
export const paperDollFamily = defineType({
    name: "paperDollFamily",
    title: "Paper Doll Family",
    type: "document",
    icon: ComponentIcon,
    fields: [
        defineField({
            name: "familyKey",
            title: "Family key",
            type: "string",
            description: "Stable key, e.g. CYL-9ML — used by API and Convex sync",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "displayName",
            title: "Display name",
            type: "string",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "canvasWidth",
            title: "Canvas width (px)",
            type: "number",
            initialValue: 2000,
            validation: (Rule) => Rule.required().min(1),
        }),
        defineField({
            name: "canvasHeight",
            title: "Canvas height (px)",
            type: "number",
            initialValue: 2200,
            validation: (Rule) => Rule.required().min(1),
        }),
        defineField({
            name: "layerOrderRollon",
            title: "Layer order — Roll-on",
            type: "array",
            of: [{ type: "string" }],
            description: "Bottom to top, e.g. body → roller → cap",
        }),
        defineField({
            name: "layerOrderSpray",
            title: "Layer order — Spray",
            type: "array",
            of: [{ type: "string" }],
        }),
        defineField({
            name: "layerOrderLotion",
            title: "Layer order — Lotion",
            type: "array",
            of: [{ type: "string" }],
        }),
        defineField({
            name: "anchorsJson",
            title: "Anchors (JSON)",
            type: "text",
            rows: 8,
            description: "Paste family-model.json anchors / contentBounds as JSON for renderer alignment",
        }),
        defineField({
            name: "layerAssets",
            title: "Layer assets",
            type: "array",
            of: [defineArrayMember({ type: "paperDollLayerAsset" })],
        }),
    ],
    preview: {
        select: { title: "displayName", subtitle: "familyKey" },
    },
});
