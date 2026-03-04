export const dynamic = "force-dynamic";
import { PageHeader, PortalButton, PortalCard, PortalTag } from "@/components/portal/ui";

const drafts = [
    {
        name: "Spring Launch 2026",
        items: 4,
        total: "$2,840.00",
        updated: "Feb 26, 2026",
        status: "In Review",
        variant: "gold" as const,
    },
    {
        name: "Q2 Restock — Roll-Ons",
        items: 2,
        total: "$1,120.00",
        updated: "Feb 20, 2026",
        status: "Draft",
        variant: "muted" as const,
    },
    {
        name: "Holiday Gift Set Packaging",
        items: 7,
        total: "$5,460.00",
        updated: "Feb 8, 2026",
        status: "Draft",
        variant: "muted" as const,
    },
] as const;

export default function PortalDrafts() {
    return (
        <div className="px-12 py-10 max-w-[1400px]">
            <PageHeader
                eyebrow="Saved Orders"
                title="Draft Orders"
                subtitle="Return to any saved cart and finalize when you're ready."
            />

            <div className="flex flex-col gap-4">
                {drafts.map((draft) => (
                    <PortalCard key={draft.name} className="flex items-center justify-between gap-6">
                        <div>
                            <h2 className="font-serif text-xl text-obsidian font-normal mb-1.5">
                                {draft.name}
                            </h2>
                            <p className="font-sans text-xs text-ash">
                                {draft.items} products · Last edited {draft.updated}
                            </p>
                        </div>

                        <div className="flex items-center gap-8 shrink-0">
                            <div className="text-right">
                                <p className="font-serif text-2xl text-obsidian font-normal mb-1.5">
                                    {draft.total}
                                </p>
                                <PortalTag variant={draft.variant}>{draft.status}</PortalTag>
                            </div>
                            <div className="flex flex-col gap-2">
                                <PortalButton size="sm">Resume Draft</PortalButton>
                                <PortalButton variant="outline" size="sm">Share Draft</PortalButton>
                            </div>
                        </div>
                    </PortalCard>
                ))}

                {/* New draft CTA */}
                <div className="border border-dashed border-champagne rounded-lg px-7 py-6 flex items-center justify-between">
                    <p className="font-serif text-lg text-ash italic">
                        Start a new draft order
                    </p>
                    <PortalButton size="sm">New Draft</PortalButton>
                </div>
            </div>
        </div>
    );
}
