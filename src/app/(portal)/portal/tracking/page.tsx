export const dynamic = "force-dynamic";
import { GoldRule, PageHeader, PortalButton, PortalCard, PortalTag, SectionLabel } from "@/components/portal/ui";

const ACTIVE_STEP = 3; // 0-indexed: Shipped

const steps = [
    { label: "Order Received", timestamp: "Feb 24 · 9:14 am" },
    { label: "Processing", timestamp: "Feb 24 · 2:30 pm" },
    { label: "Picked & Packed", timestamp: "Feb 25 · 8:00 am" },
    { label: "Shipped", timestamp: "Feb 25 · In transit via FedEx" },
    { label: "Delivered", timestamp: "Estimated March 4, 2026" },
] as const;

const shipmentInfo = [
    ["Carrier", "FedEx Ground"],
    ["Tracking No.", "794 622 836 420"],
    ["Ship From", "Oakland, CA"],
    ["Ship To", "Chicago, IL"],
    ["Weight", "43.2 lbs"],
    ["Cartons", "4 boxes"],
] as const;

export default function PortalTracking() {
    return (
        <div className="px-12 py-10 max-w-[1400px]">
            <PageHeader eyebrow="Live Tracking" title="Order ORD-9841" />

            <div className="grid grid-cols-[1.5fr_1fr] gap-5">

                {/* Timeline card */}
                <PortalCard>
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <SectionLabel>18-415 Frosted Elegant, 30ml</SectionLabel>
                            <h2 className="font-serif text-lg text-obsidian font-normal">
                                Qty 500 · Est. arrival March 4, 2026
                            </h2>
                        </div>
                        <PortalTag variant="gold">In Transit</PortalTag>
                    </div>

                    <GoldRule className="mb-8" />

                    {/* Timeline */}
                    <div className="relative pl-8">
                        {/* Connector line */}
                        <div className="absolute left-[5px] top-2 bottom-2 w-px bg-champagne" />

                        {steps.map((step, i) => {
                            const done = i <= ACTIVE_STEP;
                            const current = i === ACTIVE_STEP;
                            return (
                                <div
                                    key={step.label}
                                    className={`relative flex flex-col gap-0.5 ${i < steps.length - 1 ? "mb-8" : ""}`}
                                >
                                    {/* Step dot */}
                                    <div
                                        className={`absolute -left-8 top-1 w-[11px] h-[11px] rounded-full border z-10 ${
                                            done
                                                ? "bg-muted-gold border-muted-gold"
                                                : "bg-bone border-champagne"
                                        } ${current ? "shadow-[0_0_0_4px_rgba(197,160,101,0.15)]" : ""}`}
                                    />
                                    <p
                                        className={`font-serif text-sm ${
                                            done ? "text-obsidian" : "text-ash"
                                        } ${current ? "font-medium" : "font-normal"}`}
                                    >
                                        {step.label}
                                    </p>
                                    <p className="font-sans text-xs text-ash">
                                        {step.timestamp}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    <GoldRule className="mt-8 mb-5" />

                    <div className="flex gap-3">
                        <PortalButton size="sm">FedEx Details</PortalButton>
                        <PortalButton variant="outline" size="sm">Download Invoice</PortalButton>
                    </div>
                </PortalCard>

                {/* Right column */}
                <div className="flex flex-col gap-4">

                    {/* Shipment info */}
                    <PortalCard>
                        <SectionLabel>Shipment Info</SectionLabel>
                        <GoldRule className="mb-3" />
                        {shipmentInfo.map(([key, value]) => (
                            <div
                                key={key}
                                className="flex items-center justify-between py-2.5 border-b border-travertine last:border-0"
                            >
                                <span className="font-sans text-xs text-ash">
                                    {key}
                                </span>
                                <span className="font-serif text-sm text-obsidian">
                                    {value}
                                </span>
                            </div>
                        ))}
                    </PortalCard>

                    {/* Grace suggestion */}
                    <PortalCard dark>
                        <SectionLabel>Grace says</SectionLabel>
                        <p className="font-serif text-sm text-bone italic leading-relaxed mb-5">
                            Your Frosted Elegant order typically arrives within 2 days of this milestone.
                            Based on your purchase cadence, you may want to place your Spring reorder
                            in about 45 days.
                        </p>
                        <GoldRule className="mb-5" />
                        <PortalButton size="sm">Plan Reorder with Grace</PortalButton>
                    </PortalCard>

                </div>
            </div>
        </div>
    );
}
