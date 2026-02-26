'use client';

import { useState } from 'react';
import FitmentDrawer from '@/components/FitmentDrawer';
import FitmentCarousel from '@/components/FitmentCarousel';

export default function FitmentDemoPage() {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Real verified SKU from the database (17-415 thread, Amber 9ml Cylinder)
    const mockBottleSku = "GBCylAmb9MtlRollBlkDot";

    return (
        <main className="min-h-screen bg-[#fdfbf7] flex flex-col items-center">

            {/* 
        Mock Product Page Layout: 
        This is a fake product page just to show where the carousel goes. 
      */}
            <div className="max-w-4xl w-full mx-auto px-6 py-12">
                <h1 className="text-3xl tracking-widest text-gray-900 border-b border-[#e5e1d8] pb-6 mb-12">UI/UX FITMENT DEMO</h1>

                {/* Mock Bottle Detail Block */}
                <div className="flex gap-12 mb-12">
                    <div className="w-1/2 aspect-square bg-gray-100 rounded-2xl flex items-center justify-center border border-[#e5e1d8]">
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Product Image</p>
                    </div>
                    <div className="w-1/2 pt-8">
                        <p className="text-xs font-bold uppercase tracking-widest text-[#8a857b] mb-2">Cylinder Family · 17-415 Thread</p>
                        <h2 className="text-4xl font-serif text-gray-900 mb-4">Amber 9ml Cylinder Glass Bottle</h2>
                        <p className="text-gray-600 mb-8 leading-relaxed">Demonstrating the agent-first UI integration. Below this description, you will find the Engineered Compatibility horizontal picker — now pulling <strong>live data</strong> from the Convex database.</p>

                        <button className="w-full py-4 bg-gray-900 text-white uppercase text-xs font-bold tracking-widest mb-4">Add Bottle to Cart - $0.52</button>
                    </div>
                </div>

                {/* 1. The Horizontal Picker Component */}
                <div className="max-w-2xl mx-auto">
                    <FitmentCarousel
                        bottleSku={mockBottleSku}
                        onOpenDrawer={() => setIsDrawerOpen(true)}
                    />
                </div>

            </div>

            {/* 2. The Slide-Out Drawer Component */}
            <FitmentDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                bottleSku={mockBottleSku}
            />

        </main>
    );
}
