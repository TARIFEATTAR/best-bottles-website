export const dynamic = "force-dynamic";
import { GoldRule, PageHeader, PortalButton, PortalCard, SectionLabel } from "@/components/portal/ui";

const categories = [
    {
        label: "Invoices",
        docs: [
            { name: "INV-2026-0047", desc: "18-415 Frosted Elegant, 30ml × 500", date: "Feb 24, 2026", size: "184 KB" },
            { name: "INV-2026-0038", desc: "Cobalt Roll-On 10ml × 1,000", date: "Feb 11, 2026", size: "201 KB" },
            { name: "INV-2026-0029", desc: "20-400 Boston Round, Amber × 250", date: "Jan 28, 2026", size: "168 KB" },
        ],
    },
    {
        label: "Spec Sheets",
        docs: [
            { name: "18-415 Frosted Elegant Series", desc: "Dimensions, weights, fill line specs", date: "Jan 2026", size: "412 KB" },
            { name: "Cobalt Roll-On 10ml", desc: "Bottle and roller ball specifications", date: "Jan 2026", size: "298 KB" },
        ],
    },
    {
        label: "SDS Documents",
        docs: [
            { name: "Glass Packaging Safety Data Sheet", desc: "Safety data for all glass SKUs", date: "2025", size: "540 KB" },
        ],
    },
    {
        label: "Agreements",
        docs: [
            { name: "Account Agreement — Lumière Atelier", desc: "Terms, net terms, tax exemption certificate", date: "Mar 2021", size: "612 KB" },
        ],
    },
] as const;

export default function PortalDocuments() {
    return (
        <div className="px-12 py-10 max-w-[1400px]">
            <PageHeader
                eyebrow="Document Vault"
                title="Your Documents"
                subtitle="Invoices, spec sheets, SDS documents, and custom agreements — all in one place."
            />

            <div className="flex flex-col gap-5">
                {categories.map((category) => (
                    <PortalCard key={category.label}>
                        <SectionLabel>{category.label}</SectionLabel>
                        <GoldRule className="mb-4" />
                        {category.docs.map((doc, i) => (
                            <div key={doc.name}>
                                <div className="flex items-center justify-between py-4">
                                    <div>
                                        <p className="font-serif text-sm text-obsidian mb-1">
                                            {doc.name}
                                        </p>
                                        <p className="font-sans text-xs text-ash">
                                            {doc.desc} · {doc.date}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-5 shrink-0 pl-6">
                                        <span className="font-sans text-xs text-ash">
                                            {doc.size}
                                        </span>
                                        <PortalButton variant="outline" size="sm">Download</PortalButton>
                                    </div>
                                </div>
                                {i < category.docs.length - 1 && <GoldRule />}
                            </div>
                        ))}
                    </PortalCard>
                ))}
            </div>
        </div>
    );
}
