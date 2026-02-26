'use client';

import { useState } from 'react';
import FitmentCarousel from '@/components/FitmentCarousel';
import FitmentDrawer from '@/components/FitmentDrawer';

export default function FitmentIntegrationDemo() {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const mockBottleSku = "GB-BSR-CLR-15ML-BLK-S"; // Replaced with a real Boston Round SKU

    return (
        <>
            <div className="w-full">
                <FitmentCarousel
                    bottleSku={mockBottleSku}
                    onOpenDrawer={() => setIsDrawerOpen(true)}
                />
            </div>

            <FitmentDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                bottleSku={mockBottleSku}
            />
        </>
    );
}
