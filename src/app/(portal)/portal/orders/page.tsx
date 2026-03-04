export const dynamic = "force-dynamic";
import { GoldRule, PageHeader, PortalButton, PortalCard, PortalTag } from "@/components/portal/ui";

const orders = [
    {
        id: "ORD-9841",
        product: "18-415 Frosted Elegant, 30ml",
        detail: "Qty 500",
        date: "Feb 24, 2026",
        total: "$320.00",
        status: "In Transit",
        variant: "gold" as const,
    },
    {
        id: "ORD-9798",
        product: "Cobalt Roll-On 10ml",
        detail: "Qty 1,000",
        date: "Feb 11, 2026",
        total: "$640.00",
        status: "Delivered",
        variant: "green" as const,
    },
    {
        id: "ORD-9762",
        product: "20-400 Boston Round, Amber",
        detail: "Qty 250",
        date: "Jan 28, 2026",
        total: "$197.50",
        status: "Delivered",
        variant: "green" as const,
    },
    {
        id: "ORD-9711",
        product: "18-415 Fine Mist Sprayer, Gold",
        detail: "Qty 500",
        date: "Jan 6, 2026",
        total: "$445.00",
        status: "Delivered",
        variant: "green" as const,
    },
    {
        id: "ORD-9680",
        product: "Frosted Diva, 50ml",
        detail: "Qty 250",
        date: "Dec 14, 2025",
        total: "$287.50",
        status: "Delivered",
        variant: "green" as const,
    },
] as const;

export default function PortalOrders() {
    return (
        <div className="px-12 py-10 max-w-[1400px]">
            <PageHeader
                eyebrow="History"
                title="Order History"
                subtitle="47 lifetime orders · Smart reorder available on any past purchase."
            />

            <PortalCard>
                {/* Table header */}
                <div className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr_auto] gap-4 mb-3">
                    {["Order", "Product", "Qty / Date", "Total", "Status", ""].map((h) => (
                        <p key={h} className="font-sans text-xs tracking-[0.14em] uppercase text-ash">
                            {h}
                        </p>
                    ))}
                </div>

                <GoldRule className="mb-2" />

                {orders.map((order, i) => (
                    <div key={order.id}>
                        <div className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr_auto] gap-4 items-center py-4">
                            <p className="font-sans text-xs tracking-[0.12em] uppercase text-gold-dim">
                                {order.id}
                            </p>
                            <p className="font-serif text-sm text-obsidian">
                                {order.product}
                            </p>
                            <div>
                                <p className="font-sans text-xs text-obsidian">
                                    {order.detail}
                                </p>
                                <p className="font-sans text-xs text-ash mt-0.5">
                                    {order.date}
                                </p>
                            </div>
                            <p className="font-serif text-sm text-obsidian">
                                {order.total}
                            </p>
                            <PortalTag variant={order.variant}>{order.status}</PortalTag>
                            <div className="flex gap-2">
                                <PortalButton variant="outline" size="sm">Reorder</PortalButton>
                                <PortalButton variant="outline" size="sm">Invoice</PortalButton>
                            </div>
                        </div>
                        {i < orders.length - 1 && <GoldRule />}
                    </div>
                ))}
            </PortalCard>
        </div>
    );
}
