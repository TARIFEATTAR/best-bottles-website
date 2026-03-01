import imageUrlBuilder from "@sanity/image-url";
import { client, isSanityConfigured } from "./client";

const builder = isSanityConfigured ? imageUrlBuilder(client) : null;

export function urlFor(source: { asset?: { _ref: string }; _type?: string } | null | undefined): string {
    if (!source?.asset?._ref || !builder) return "";
    return builder.image(source).url();
}
