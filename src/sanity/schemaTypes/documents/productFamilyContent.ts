import { defineType, defineField, defineArrayMember } from "sanity";
import { ComponentIcon } from "@sanity/icons";

// The list of product families — matches the values used in the Convex catalog.
const FAMILY_OPTIONS = [
    "Aluminum Bottle", "Apothecary", "Atomizer", "Bell", "Boston Round",
    "Circle", "Cream Jar", "Cylinder", "Decorative", "Diamond", "Diva",
    "Elegant", "Empire", "Flair", "Grace", "Lotion Bottle", "Pillar",
    "Plastic Bottle", "Footed Rectangle", "Tall Rectangle", "Roll-On Cap", "Round", "Royal",
    "Sleek", "Slim", "Square", "Teardrop", "Tulip", "Vial",
].map((f) => ({ title: f, value: f }));

const TEMPLATE_OPTIONS = [
    { title: "Standard — Description · Features · Badges", value: "standard" },
    { title: "Premium — Gallery · Description · Feature Strip · FAQ", value: "premium" },
    { title: "Collection — Promo Banner · Features · Gallery · Description", value: "collection" },
];

export const productFamilyContent = defineType({
    name: "productFamilyContent",
    title: "Product Family Content",
    type: "document",
    icon: ComponentIcon,
    description: "Editorial content that applies to ALL products in a design family. Individual product overrides take priority over this.",
    fields: [
        defineField({
            name: "family",
            title: "Design Family",
            type: "string",
            options: { list: FAMILY_OPTIONS },
            validation: (Rule) => Rule.required(),
            description: "Must match the family name exactly as it appears in the catalog (e.g. Diva, Cylinder, Boston Round).",
        }),
        defineField({
            name: "templateType",
            title: "Default Template",
            type: "string",
            options: { list: TEMPLATE_OPTIONS, layout: "radio" },
            initialValue: "standard",
            description: "Sets the default block order for all products in this family. Individual product overrides can change the order.",
        }),
        defineField({
            name: "familyHeroImage",
            title: "Family Hero Image",
            type: "image",
            options: { hotspot: true },
            description: "Lifestyle or editorial image representing the whole family. Shown as the banner on the catalog page when this family is filtered. Recommended: 1400×600px wide.",
        }),
        defineField({
            name: "familyStory",
            title: "Family Story",
            type: "text",
            rows: 3,
            description: "2–3 sentence brand narrative about this bottle family. Shown below the family name on catalog and product pages.",
        }),
        defineField({
            name: "pageBlocks",
            title: "Page Blocks",
            type: "array",
            of: [
                defineArrayMember({ type: "pdpFeatureStrip" }),
                defineArrayMember({ type: "pdpRichDescription" }),
                defineArrayMember({ type: "pdpGalleryRow" }),
                defineArrayMember({ type: "pdpPromoBanner" }),
                defineArrayMember({ type: "pdpFaqAccordion" }),
                defineArrayMember({ type: "pdpTrustBadges" }),
            ],
            description: "Drag blocks into the order you want them to appear on every product page in this family. Individual products can add their own blocks or override the order.",
        }),
    ],
    preview: {
        select: { family: "family", template: "templateType" },
        prepare({ family, template }) {
            return {
                title: family ? `${family} Family` : "Product Family Content",
                subtitle: template ?? "standard",
            };
        },
    },
});
