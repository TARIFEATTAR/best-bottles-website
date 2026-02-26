'use client';

import { ChevronRight, Sparkles } from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface FitmentCarouselProps {
    bottleSku: string;
    onOpenDrawer: () => void;
}

export default function FitmentCarousel({ bottleSku, onOpenDrawer }: FitmentCarouselProps) {
    const matchData = useQuery(api.products.getCompatibleFitments, { bottleSku });
    const componentsMap = matchData?.components || {};
    const bottle = matchData?.bottle;

    // Flatten all component variants into a single array for the carousel preview
    const fitments: any[] = Object.values(componentsMap).flat();
    const availableFamilies = Object.keys(componentsMap);

    // Show a skeleton if loading, or empty state if no thread size limits matching
    if (matchData === undefined) return <div className="animate-pulse h-32 bg-bone my-12 rounded-2xl" />;
    if (fitments.length === 0) return null; // Don't show carousel if no fitments found

    return (
        <div className="my-12 py-8 border-y border-champagne/30" data-agent-region="fitment-quick-carousel">
            <div className="flex items-center justify-between mb-6 px-4 md:px-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted-gold/10 rounded-lg text-muted-gold shrink-0">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-serif text-lg font-medium text-obsidian">Engineered Compatibility</h3>
                        <p className="font-sans text-[12px] text-slate mt-0.5 tracking-wide">Perfectly matched closures for the {bottle?.itemName || bottleSku}</p>
                    </div>
                </div>

                <button
                    onClick={onOpenDrawer}
                    className="group flex items-center gap-2 px-5 py-2.5 bg-bone hover:bg-champagne/40 border border-champagne text-obsidian text-[11px] font-medium tracking-widest uppercase transition-colors rounded-lg"
                    data-agent-action="open-fitment-drawer"
                >
                    View All Models
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>

            <div className="flex overflow-x-auto gap-4 pb-4 px-4 md:px-0 snap-x snap-mandatory hide-scrollbars">

                {availableFamilies.slice(0, 5).map((family: string, idx: number) => {
                    const sampleFitment = componentsMap[family]?.[0];
                    if (!sampleFitment) return null;
                    return (
                        <div
                            key={idx}
                            className="flex-none w-48 p-5 bg-white/70 border border-champagne/40 rounded-2xl snap-start cursor-pointer hover:border-muted-gold/50 hover:bg-white transition-all shadow-sm hover:shadow"
                            data-sku={sampleFitment.graceSku}
                            data-fitment-type={family}
                            onClick={onOpenDrawer}
                        >
                            {/* Placeholder fallback for images until image logic is seeded */}
                            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#E2B974] via-[#C5A065] to-[#A38048] rounded-full mb-4 shadow-inner ring-4 ring-bone flex items-center justify-center overflow-hidden">
                                {/* Images not yet stored in DB, keeping placeholder */}
                            </div>
                            <p className="text-[10px] font-bold tracking-widest text-slate uppercase text-center mb-1 truncate">{family}</p>
                            <h4 className="font-sans text-[12px] font-medium text-obsidian text-center leading-snug line-clamp-2">{sampleFitment.itemName}</h4>
                        </div>
                    );
                })}

                <div
                    className="flex-none w-48 p-5 flex flex-col justify-center items-center bg-bone/50 border border-dashed border-champagne/60 rounded-2xl snap-start cursor-pointer hover:border-muted-gold/50 hover:bg-white transition-all"
                    onClick={onOpenDrawer}
                >
                    <div className="w-12 h-12 bg-champagne/40 text-obsidian/70 rounded-full flex items-center justify-center mb-3">
                        <ChevronRight className="w-5 h-5" />
                    </div>
                    <p className="font-sans text-[13px] font-medium text-obsidian text-center">See All {fitments.length} Fits</p>
                </div>

            </div>

            <style jsx>{`
        .hide-scrollbars::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbars {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
        </div>
    );
}
