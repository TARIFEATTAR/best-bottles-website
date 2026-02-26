'use client';

import { useState, useEffect } from 'react';
import { X, ChevronRight, Droplet, SprayCan, CheckCircle2, Droplets, Sparkles } from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface FitmentDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    bottleSku: string;
}

export default function FitmentDrawer({ isOpen, onClose, bottleSku }: FitmentDrawerProps) {
    const [step, setStep] = useState<2 | 3>(2);
    const [selectedApplicator, setSelectedApplicator] = useState<string | null>(null);

    const matchData = useQuery(api.products.getCompatibleFitments, { bottleSku });
    const componentsMap = matchData?.components || {};
    const bottle = matchData?.bottle;

    const availableFamilies = Object.keys(componentsMap);
    let filteredFitments: any[] = [];
    if (selectedApplicator === 'Roll-On Cap') {
        filteredFitments = [
            ...(componentsMap['Plastic Roller'] || []),
            ...(componentsMap['Metal Roller'] || []),
            ...(componentsMap['Roll-On Cap'] || [])
        ];
    } else if (selectedApplicator) {
        filteredFitments = componentsMap[selectedApplicator] || [];
    }

    const [agentStatus, setAgentStatus] = useState<string>('Ready to build a bundle.');

    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => setStep(2), 300);
            setAgentStatus('Drawer closed.');
        } else {
            setAgentStatus('Drawer opened. Placed on step 2, applicator selection.');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 transition-opacity"
                style={{ background: "rgba(29, 29, 31, 0.45)", backdropFilter: "blur(4px)" }}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Drawer */}
            <div
                className="fixed top-0 right-0 h-full w-full max-w-[420px] md:max-w-[760px] shadow-2xl z-50 transform transition-transform duration-300 ease-in-out border-l flex flex-col"
                style={{
                    background: "rgba(250, 248, 245, 0.95)", // Matches CartDrawer (linen/bone mix)
                    backdropFilter: "blur(28px) saturate(180%)",
                    WebkitBackdropFilter: "blur(28px) saturate(180%)",
                    borderLeft: "1px solid rgba(212, 197, 169, 0.4)",
                    boxShadow: "-24px 0 80px rgba(29, 29, 31, 0.18), -2px 0 0 rgba(255,255,255,0.6) inset",
                }}
                role="dialog"
                aria-labelledby="drawer-title"
                aria-describedby="drawer-subtitle"
                data-agent-region="fitment-builder"
            >
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-none" aria-hidden="true">
                    <div className="absolute inset-0 liquid-shimmer" style={{ opacity: 0.2 }} />
                    <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)" }} />
                </div>

                {/* Header */}
                <header className="relative flex items-center justify-between px-6 py-5 border-b border-champagne/30 shrink-0">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-9 h-9 rounded-full flex items-center justify-center bg-white"
                            style={{
                                border: "1px solid rgba(197, 160, 101, 0.3)",
                                boxShadow: "0 2px 8px rgba(197, 160, 101, 0.15)"
                            }}
                        >
                            <Sparkles className="w-4 h-4 text-muted-gold" />
                        </div>
                        <div>
                            <h2 id="drawer-title" className="font-serif text-[17px] font-medium text-obsidian tracking-wide">Compatible Fitment</h2>
                            <p id="drawer-subtitle" className="font-sans text-[11px] text-slate mt-0.5 tracking-wider uppercase">Select matched components</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer hover:bg-black/5"
                        style={{ border: "1px solid rgba(29, 29, 31, 0.08)" }}
                        aria-label="Close drawer"
                    >
                        <X className="w-4 h-4 text-obsidian/70" />
                    </button>
                </header>

                {/* Selected Bottle Summary (Step 1) */}
                <div className="relative bg-white/40 px-6 py-4 flex items-center justify-between border-b border-champagne/30 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-bone rounded-lg border border-champagne/50 shrink-0 flex items-center justify-center">
                            <span className="text-[10px] text-slate/40 font-bold uppercase" aria-hidden="true">IMG</span>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold tracking-widest text-muted-gold uppercase mb-1">Step 1: Base Selected</p>
                            <p className="text-[14px] font-medium text-obsidian leading-snug" data-fitment-base={bottleSku}>{bottle?.itemName || bottleSku}</p>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="relative flex-1 p-6 overflow-y-auto">
                    {step === 2 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="text-[10px] font-bold tracking-widest text-slate uppercase mb-1">Step 2: Action & Applicator</h3>
                            <p className="text-obsidian/80 text-[13px] mb-6 font-medium">How do you want to dispense your product?</p>

                            <div className="grid gap-3" data-agent-step="select-applicator">

                                {availableFamilies.includes('Sprayer') && (
                                    <button
                                        onClick={() => { setSelectedApplicator('Sprayer'); setStep(3); setAgentStatus('Sprayer selected. Moved to step 3, closure options.'); }}
                                        className="group flex items-center justify-between p-4 bg-white/70 border border-champagne/40 rounded-xl hover:border-muted-gold/50 hover:bg-white transition-all text-left shadow-sm hover:shadow"
                                        data-fitment-type="Sprayer"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-bone border border-champagne/50 flex items-center justify-center text-obsidian/70 group-hover:text-obsidian transition-colors">
                                                <SprayCan className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-serif text-[15px] font-medium text-obsidian">Fine Mist Sprayer</h4>
                                                <p className="text-[11px] text-slate mt-0.5">For perfumes and light mists</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-slate/40 group-hover:text-slate transition-colors" />
                                    </button>
                                )}

                                {availableFamilies.includes('Dropper') && (
                                    <button
                                        onClick={() => { setSelectedApplicator('Dropper'); setStep(3); setAgentStatus('Dropper selected. Moved to step 3, closure options.'); }}
                                        className="group flex items-center justify-between p-4 bg-white/70 border border-champagne/40 rounded-xl hover:border-muted-gold/50 hover:bg-white transition-all text-left shadow-sm hover:shadow"
                                        data-fitment-type="Dropper"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-bone border border-champagne/50 flex items-center justify-center text-obsidian/70 group-hover:text-obsidian transition-colors">
                                                <Droplet className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-serif text-[15px] font-medium text-obsidian">Glass Dropper</h4>
                                                <p className="text-[11px] text-slate mt-0.5">For essential oils and serums</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-slate/40 group-hover:text-slate transition-colors" />
                                    </button>
                                )}

                                {availableFamilies.includes('Lotion Pump') && (
                                    <button
                                        onClick={() => { setSelectedApplicator('Lotion Pump'); setStep(3); setAgentStatus('Pump selected. Moved to step 3, closure options.'); }}
                                        className="group flex items-center justify-between p-4 bg-white/70 border border-champagne/40 rounded-xl hover:border-muted-gold/50 hover:bg-white transition-all text-left shadow-sm hover:shadow"
                                        data-fitment-type="Lotion Pump"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-bone border border-champagne/50 flex items-center justify-center text-obsidian/70 group-hover:text-obsidian transition-colors">
                                                <Droplets className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-serif text-[15px] font-medium text-obsidian">Lotion Pump</h4>
                                                <p className="text-[11px] text-slate mt-0.5">For heavier liquids and serums</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-slate/40 group-hover:text-slate transition-colors" />
                                    </button>
                                )}

                                {(availableFamilies.includes('Plastic Roller') || availableFamilies.includes('Roll-On Cap')) && (
                                    <button
                                        onClick={() => { setSelectedApplicator('Roll-On Cap'); setStep(3); setAgentStatus('Roll-On selected. Moved to step 3, closure options.'); }}
                                        className="group flex items-center justify-between p-4 bg-white/70 border border-champagne/40 rounded-xl hover:border-muted-gold/50 hover:bg-white transition-all text-left shadow-sm hover:shadow"
                                        data-fitment-type="Roll-On Cap"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-bone border border-champagne/50 flex items-center justify-center text-obsidian/70 group-hover:text-obsidian transition-colors">
                                                <Droplets className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-serif text-[15px] font-medium text-obsidian">Roll-On System</h4>
                                                <p className="text-[11px] text-slate mt-0.5">Select your roller and lid color</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-slate/40 group-hover:text-slate transition-colors" />
                                    </button>
                                )}

                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-2 mb-4">
                                <button
                                    onClick={() => { setStep(2); setAgentStatus('Returned to step 2, applicator selection.'); }}
                                    className="text-[10px] font-bold tracking-widest text-slate uppercase hover:text-obsidian transition flex items-center"
                                >
                                    Step 2
                                </button>
                                <ChevronRight className="w-3 h-3 text-champagne mt-0.5" />
                                <h3 className="text-[10px] font-bold tracking-widest text-muted-gold uppercase">Step 3: Trim & Closure</h3>
                            </div>

                            <p className="text-obsidian/80 text-[13px] mb-6 font-medium leading-relaxed">
                                Select a <span className="text-obsidian capitalize">{selectedApplicator}</span> variation engineered specifically for this bottle.
                            </p>

                            <div className="grid grid-cols-2 gap-4" data-agent-step="select-aesthetic">

                                {filteredFitments.map((fitment: any, idx: number) => (
                                    <div
                                        key={idx}
                                        className="group relative flex flex-col items-center p-4 bg-white/70 border border-champagne/40 rounded-xl hover:border-muted-gold/50 hover:bg-white transition-all cursor-pointer shadow-sm hover:shadow"
                                        data-sku={fitment.graceSku}
                                        data-color={fitment.color || 'Standard'}
                                    >
                                        <div className="w-16 h-16 bg-gradient-to-br from-[#E2B974] via-[#C5A065] to-[#A38048] rounded-full mb-3 shadow-inner ring-4 ring-bone flex items-center justify-center overflow-hidden">
                                            {/* Image Placeholder */}
                                        </div>
                                        <h4 className="font-sans text-[12px] font-medium text-obsidian text-center leading-tight line-clamp-2" title={fitment.itemName}>
                                            {fitment.itemName}
                                        </h4>

                                        <button
                                            onClick={() => {
                                                setAgentStatus('Successfully added 1x ' + fitment.itemName + ' bundle to the cart.');
                                                alert('Added bundle to cart! (Demo)');
                                            }}
                                            className="mt-4 w-full py-2 bg-bone hover:bg-champagne/40 border border-champagne text-obsidian text-[11px] font-medium uppercase tracking-widest transition-colors rounded-lg flex items-center justify-center gap-1.5"
                                            data-agent-action="add-to-cart"
                                        >
                                            Add
                                        </button>
                                    </div>
                                ))}

                            </div>

                            <div className="mt-8 bg-green-50/50 border border-green-100 rounded flex items-start gap-2 p-3">
                                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                                <p className="text-[11px] text-green-800 leading-snug">All closures displayed are guaranteed to fit your <strong>{bottleSku}</strong> via our Engineered Compatibility system.</p>
                            </div>

                        </div>
                    )}
                </div>

                <div aria-live="polite" aria-atomic="true" className="sr-only" id="fitment-live-region">
                    {agentStatus}
                </div>
            </div>
        </>
    );
}
