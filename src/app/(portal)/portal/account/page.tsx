export const dynamic = "force-dynamic";
import { GoldRule, PageHeader, PortalButton, PortalCard, SectionLabel } from "@/components/portal/ui";

// ─── Static data ────────────────────────────────────────────────────────────

const accountDetails = [
    { label: "Account Number", value: "BB-004821" },
    { label: "Customer Tier", value: "The Scaler" },
    { label: "Tax-Exempt Status", value: "Active · Certificate on file" },
    { label: "Account Manager", value: "Sarah Taghavi" },
    { label: "Member Since", value: "March 2021" },
    { label: "Net Terms", value: "Net 30" },
] as const;

const tierBenefits = [
    "Volume pricing automatically applied",
    "Dedicated account manager assigned",
    "Priority processing on all orders",
    "Access to pre-release SKUs",
    "Custom sample kits available",
] as const;

// Tier ladder — used for the progress indicator
const tiers = [
    { name: "The Builder", range: "$0–$50K" },
    { name: "The Curator", range: "$50K–$200K" },
    { name: "The Scaler", range: "$200K–$1M" },
    { name: "The Partner", range: "$1M+" },
] as const;

const CURRENT_TIER = "The Scaler"; // would be dynamic in production

// ─── Sub-components ─────────────────────────────────────────────────────────

function CheckIcon() {
    return (
        <svg
            viewBox="0 0 16 16"
            fill="none"
            className="w-3.5 h-3.5 shrink-0 mt-0.5"
            aria-hidden="true"
        >
            <circle cx="8" cy="8" r="7.5" stroke="currentColor" strokeOpacity="0.35" />
            <path
                d="M5 8l2 2 4-4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function MailIcon() {
    return (
        <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4" aria-hidden="true">
            <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
            <path d="M2 7l8 5 8-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
    );
}

function CalendarIcon() {
    return (
        <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4" aria-hidden="true">
            <rect x="2" y="4" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" />
            <path d="M6 2v4M14 2v4M2 9h16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PortalAccount() {
    const currentTierIndex = tiers.findIndex((t) => t.name === CURRENT_TIER);
    // Progress within tier displayed as a simple fill (mock: 68% through The Scaler range)
    const TIER_PROGRESS = 68;

    return (
        <div className="px-10 py-10 max-w-[1400px]">
            <PageHeader eyebrow="Account Management" title="Account & Pricing" />

            {/* ── Main grid: 5-col, account details takes 2, right column takes 3 ── */}
            <div className="grid grid-cols-5 gap-5 mb-5 items-stretch">

                {/* ── Account Details card (2 cols) ──────────────────────────── */}
                <PortalCard className="col-span-2 flex flex-col">
                    <SectionLabel>Account Details</SectionLabel>
                    <h2 className="font-serif text-[22px] text-obsidian font-normal mb-1 leading-snug">
                        Lumière Atelier, LLC
                    </h2>
                    <p className="font-sans text-xs text-slate mb-6 leading-relaxed">
                        Wholesale fragrance & packaging partner since 2021
                    </p>
                    <GoldRule className="mb-5" />

                    <div className="flex flex-col flex-1 divide-y divide-travertine">
                        {accountDetails.map(({ label, value }) => (
                            <div
                                key={label}
                                className="flex items-center justify-between py-3 group"
                            >
                                <span className="font-sans text-[11px] tracking-wide uppercase text-slate">
                                    {label}
                                </span>
                                <span className="font-serif text-sm text-obsidian text-right max-w-[55%]">
                                    {value}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* ── Card footer — standing summary ─────────────────── */}
                    <div className="mt-auto pt-5">
                        <GoldRule className="mb-4" />
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#5a9e5d]" />
                                <span className="font-sans text-[11px] text-slate">
                                    Account in good standing
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-sans text-[10px] tracking-[0.12em] uppercase border border-muted-gold/40 text-muted-gold px-2 py-0.5 rounded-sm">
                                    Tax Exempt
                                </span>
                                <span className="font-sans text-[10px] tracking-[0.12em] uppercase border border-slate/25 text-slate px-2 py-0.5 rounded-sm">
                                    Net 30
                                </span>
                            </div>
                        </div>
                    </div>
                </PortalCard>

                {/* ── Right column: Tier Status + Manager (3 cols) ────────────── */}
                <div className="col-span-3 flex flex-col gap-5">

                    {/* ── Tier Status card (dark, premium) ────────────────────── */}
                    <PortalCard dark className="relative overflow-hidden flex-1">
                        {/* Ambient gold glow accent — top-right corner */}
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 rounded-full"
                            style={{
                                background: "radial-gradient(circle, rgba(197,160,101,0.18) 0%, transparent 70%)",
                            }}
                        />

                        {/* Header row */}
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <SectionLabel>Tier Status</SectionLabel>
                                <h2 className="font-serif text-3xl text-bone font-normal leading-tight">
                                    The Scaler
                                </h2>
                                <p className="font-sans text-xs text-champagne mt-1">
                                    $200K – $1M annual volume · Dedicated support
                                </p>
                            </div>

                            {/* Tier badge */}
                            <div className="shrink-0 border border-muted-gold/30 rounded-sm px-3 py-1.5 bg-muted-gold/[0.08]">
                                <span className="font-sans text-[10px] tracking-[0.14em] uppercase text-muted-gold">
                                    Active
                                </span>
                            </div>
                        </div>

                        {/* Tier ladder */}
                        <div className="mb-5">
                            <div className="flex items-center justify-between mb-2">
                                {tiers.map((tier, i) => (
                                    <div key={tier.name} className="flex flex-col items-center flex-1">
                                        <div
                                            className={[
                                                "w-2 h-2 rounded-full mb-1 transition-all",
                                                i <= currentTierIndex
                                                    ? "bg-muted-gold"
                                                    : "bg-muted-gold/20",
                                            ].join(" ")}
                                        />
                                        <span
                                            className={[
                                                "font-sans text-[10px] tracking-wide text-center",
                                                i === currentTierIndex
                                                    ? "text-muted-gold font-medium"
                                                    : i < currentTierIndex
                                                        ? "text-champagne/60"
                                                        : "text-bone/25",
                                            ].join(" ")}
                                        >
                                            {tier.name.replace("The ", "")}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Progress track */}
                            <div className="relative h-px bg-muted-gold/15 w-full">
                                {/* Filled connectors between completed dots */}
                                <div
                                    className="absolute top-0 left-0 h-px bg-muted-gold/50 transition-all duration-700"
                                    style={{
                                        width: `${(currentTierIndex / (tiers.length - 1)) * 100}%`,
                                    }}
                                />
                            </div>
                        </div>

                        {/* Within-tier progress */}
                        <div className="mb-5">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="font-sans text-[10px] tracking-wide text-champagne/70 uppercase">
                                    Volume progress — within tier
                                </span>
                                <span className="font-sans text-[10px] text-muted-gold font-medium">
                                    {TIER_PROGRESS}%
                                </span>
                            </div>
                            <div className="h-1 bg-muted-gold/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        width: `${TIER_PROGRESS}%`,
                                        background: "linear-gradient(90deg, #8B6F42, #C5A065)",
                                    }}
                                />
                            </div>
                            <p className="font-sans text-[10px] text-bone/40 mt-1.5">
                                ~$136K to unlock <span className="text-bone/60">The Partner</span> tier
                            </p>
                        </div>

                        <GoldRule className="mb-5" />

                        {/* Benefits */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                            {tierBenefits.map((benefit) => (
                                <div key={benefit} className="flex items-start gap-2.5 text-muted-gold">
                                    <CheckIcon />
                                    <span className="font-sans text-xs text-bone/85 leading-relaxed">
                                        {benefit}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </PortalCard>

                    {/* ── Account Manager card (light) ──────────────────────── */}
                    <PortalCard>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                {/* Avatar with ring */}
                                <div className="relative shrink-0">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gold-dim to-muted-gold flex items-center justify-center">
                                        <span className="font-sans text-sm text-obsidian font-semibold tracking-wide">
                                            ST
                                        </span>
                                    </div>
                                    {/* Active indicator */}
                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#5a9e5d] border-2 border-linen rounded-full" />
                                </div>

                                <div>
                                    <SectionLabel>Your Account Manager</SectionLabel>
                                    <p className="font-serif text-[17px] text-obsidian leading-tight">
                                        Sarah Taghavi
                                    </p>
                                    <p className="font-sans text-xs text-slate mt-0.5">
                                        Account Manager · Best Bottles
                                    </p>
                                </div>
                            </div>

                            {/* CTA buttons — right-aligned */}
                            <div className="flex items-center gap-2.5 shrink-0">
                                <PortalButton
                                    size="sm"
                                    className="flex items-center gap-2"
                                >
                                    <MailIcon />
                                    Email Sarah
                                </PortalButton>
                                <PortalButton
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-2"
                                >
                                    <CalendarIcon />
                                    Schedule a Call
                                </PortalButton>
                            </div>
                        </div>
                    </PortalCard>

                </div>
            </div>

            {/* ── Bottom row: Quick info pills ───────────────────────────────── */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: "Net Terms", value: "Net 30", note: "Next statement Mar 30" },
                    { label: "Tax Status", value: "Tax Exempt", note: "Certificate on file" },
                    { label: "Member Since", value: "March 2021", note: "4+ year partnership" },
                    { label: "Account Tier", value: "The Scaler", note: "$200K – $1M volume" },
                ].map(({ label, value, note }) => (
                    <PortalCard key={label} className="py-4 px-5">
                        <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-slate mb-1">
                            {label}
                        </p>
                        <p className="font-serif text-lg text-obsidian font-normal leading-tight mb-0.5">
                            {value}
                        </p>
                        <p className="font-sans text-[11px] text-slate/70">
                            {note}
                        </p>
                    </PortalCard>
                ))}
            </div>
        </div>
    );
}
