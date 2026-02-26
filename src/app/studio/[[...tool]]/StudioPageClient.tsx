"use client";

import dynamic from "next/dynamic";
import config from "../../../../sanity.config";

const NextStudio = dynamic(
    () => import("next-sanity/studio").then((mod) => mod.NextStudio),
    { ssr: false }
);

export default function StudioPageClient() {
    return <NextStudio config={config} />;
}
