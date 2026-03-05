import { defineType, defineField } from "sanity";
import { BellIcon } from "@sanity/icons";

export const pdpPromoBanner = defineType({
    name: "pdpPromoBanner",
    title: "Promo Banner",
    type: "object",
    icon: BellIcon,
    description: "A high-visibility promotional strip. Add a headline, supporting copy, optional countdown timer, and a CTA button. Great for limited-time deals, new arrivals, or featured collections.",
    fields: [
        defineField({
            name: "style",
            title: "Banner Style",
            type: "string",
            options: {
                list: [
                    { title: "Subtle (light background, gold accent)", value: "subtle" },
                    { title: "Bold (dark background, white text)", value: "bold" },
                    { title: "Urgent (gold background, dark text)", value: "urgent" },
                ],
                layout: "radio",
            },
            initialValue: "subtle",
        }),
        defineField({
            name: "eyebrow",
            title: "Eyebrow",
            type: "string",
            description: "Small uppercase text above the headline. Example: Limited Time · New Arrival · Sale",
        }),
        defineField({
            name: "headline",
            title: "Headline",
            type: "string",
            validation: (Rule) => Rule.required().max(80),
            description: "Main banner message. Example: Order by Friday — Ships Before the Weekend.",
        }),
        defineField({
            name: "body",
            title: "Supporting Copy",
            type: "text",
            rows: 2,
            description: "Optional one or two sentences below the headline.",
        }),
        defineField({
            name: "ctaText",
            title: "Button Label",
            type: "string",
            description: "CTA button text. Leave empty to hide the button.",
        }),
        defineField({
            name: "ctaHref",
            title: "Button Link",
            type: "string",
            description: "Where the button goes. Can be an internal path or external URL.",
        }),
        defineField({
            name: "countdownEndDate",
            title: "Countdown End Date & Time",
            type: "datetime",
            description: "If set, a live countdown timer appears in the banner. Leave empty for no countdown. Use your local time — the site converts automatically.",
            options: { dateFormat: "MMMM D, YYYY", timeFormat: "h:mm A" },
        }),
        defineField({
            name: "countdownLabel",
            title: "Countdown Label",
            type: "string",
            description: "Text after the timer. Example: until sale ends · left to order at this price",
            initialValue: "remaining",
            hidden: ({ parent }) => !parent?.countdownEndDate,
        }),
    ],
    preview: {
        select: {
            headline: "headline",
            style: "style",
            countdown: "countdownEndDate",
        },
        prepare({ headline, style, countdown }) {
            const sub = [style, countdown ? "⏱ countdown" : null].filter(Boolean).join(" · ");
            return { title: headline ?? "Promo Banner", subtitle: sub };
        },
    },
});
