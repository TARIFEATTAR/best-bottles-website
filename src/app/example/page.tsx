import FitmentCarousel from '@/components/FitmentCarousel';
import FitmentDrawer from '@/components/FitmentDrawer';
import FitmentIntegrationDemo from '@/components/FitmentIntegrationDemo';
import { ArrowLeft, Star, Truck, ShieldCheck, ChevronRight } from 'lucide-react';

export default function ExampleProductPage() {
    return (
        <main className="min-h-screen bg-bone">
            {/* Top Banner */}
            <div className="bg-obsidian text-champagne text-center text-xs py-2 tracking-widest font-medium uppercase">
                Free Shipping on Orders Over $199
            </div>

            {/* Nav Placeholder */}
            <nav className="border-b border-champagne/30 bg-white/50 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
                <a href="#" className="flex items-center gap-2 text-obsidian font-serif text-xl tracking-wider">
                    TARIFE <span className="text-muted-gold text-lg">ATTAR</span>
                </a>
                <div className="hidden md:flex items-center gap-8 text-[11px] font-bold tracking-widest text-obsidian uppercase">
                    <a href="#" className="hover:text-muted-gold transition-colors">Catalog</a>
                    <a href="#" className="hover:text-muted-gold transition-colors">Families</a>
                    <a href="#" className="hover:text-muted-gold transition-colors">Decorating</a>
                    <a href="#" className="hover:text-muted-gold transition-colors">About Us</a>
                </div>
                <div className="w-10 h-10 border border-champagne/50 rounded-full flex items-center justify-center text-obsidian">
                    <span className="text-xs">0</span>
                </div>
            </nav>

            {/* Breadcrumbs */}
            <div className="max-w-[1280px] mx-auto px-6 py-6 border-b border-champagne/20">
                <div className="flex items-center gap-2 text-[10px] tracking-widest font-bold uppercase text-slate">
                    <a href="#" className="flex items-center gap-1 hover:text-obsidian transition-colors"><ArrowLeft className="w-3 h-3" /> Back to Catalog</a>
                    <span className="text-champagne mx-2">/</span>
                    <a href="#" className="hover:text-obsidian transition-colors">Cylinder Collection</a>
                    <span className="text-champagne mx-2">/</span>
                    <span className="text-obsidian">5ml Blue Cylinder</span>
                </div>
            </div>

            <div className="max-w-[1280px] mx-auto px-6 py-12 flex flex-col lg:flex-row gap-16">

                {/* Gallery Section */}
                <div className="lg:w-[55%] flex gap-4">
                    {/* Thumbnails */}
                    <div className="hidden md:flex flex-col gap-4 w-20 shrink-0">
                        <div className="aspect-square bg-white rounded-xl border-2 border-muted-gold cursor-pointer shadow-sm"></div>
                        <div className="aspect-square bg-white/60 rounded-xl border border-champagne/40 cursor-pointer hover:border-muted-gold/50 transition-colors"></div>
                        <div className="aspect-square bg-white/60 rounded-xl border border-champagne/40 cursor-pointer hover:border-muted-gold/50 transition-colors"></div>
                    </div>
                    {/* Main Image */}
                    <div className="flex-1 bg-white rounded-2xl aspect-[4/5] md:aspect-[3/4] border border-champagne/40 shadow-sm flex items-center justify-center relative group overflow-hidden">
                        {/* Simulated Glass Shine Reflection */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out pointer-events-none"></div>

                        <p className="text-slate/30 font-serif italic text-2xl tracking-wider">Product Render</p>
                        <div className="absolute top-4 left-4 bg-obsidian text-white text-[10px] px-3 py-1 uppercase tracking-widest rounded-full font-bold">
                            Best Seller
                        </div>
                    </div>
                </div>

                {/* Product Info Section */}
                <div className="lg:w-[45%] flex flex-col">

                    <div className="flex items-center gap-4 mb-4">
                        <div className="flex items-center gap-1 text-muted-gold">
                            <Star className="w-4 h-4 fill-current" />
                            <Star className="w-4 h-4 fill-current" />
                            <Star className="w-4 h-4 fill-current" />
                            <Star className="w-4 h-4 fill-current" />
                            <Star className="w-4 h-4 fill-current" />
                        </div>
                        <span className="text-xs text-slate underline tracking-wide">42 Reviews</span>
                    </div>

                    <h1 className="font-serif text-4xl lg:text-5xl text-obsidian tracking-wide leading-[1.1] mb-3">
                        5ml Blue Cylinder Glass
                    </h1>
                    <p className="text-slate text-sm font-sans tracking-wide mb-6 uppercase flex items-center gap-2">
                        SKU: <span className="font-bold text-obsidian">GB-CYL-BLU-5ML</span>
                        <span className="w-px h-3 bg-champagne"></span>
                        In Stock ready to ship
                    </p>

                    <div className="flex items-baseline gap-3 mb-8">
                        <span className="font-serif text-3xl font-medium text-obsidian">$1.25</span>
                        <span className="text-slate text-sm">/ unit</span>
                    </div>

                    <p className="text-obsidian/80 font-serif leading-relaxed text-[15px] mb-8">
                        Our premium 5ml Cylinder bottle pressed from true cobalt blue glass. Engineered to protect essential oils and perfumes from UV degradation while offering a sleek, minimalist profile.
                    </p>

                    {/* Quantity / Add to Cart Block for the bottle itself */}
                    <div className="bg-white/70 p-6 rounded-2xl border border-champagne/40 shadow-sm mb-12">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-bold tracking-widest uppercase text-slate">Quantity</span>
                            <span className="text-xs text-muted-gold italic font-serif">Cases of 144</span>
                        </div>

                        <div className="flex gap-4">
                            <div className="w-32 h-12 border border-champagne/50 bg-white rounded-lg flex items-center justify-between px-4">
                                <span className="text-xl text-slate text-center cursor-pointer w-4 hover:text-obsidian">-</span>
                                <span className="font-medium text-obsidian">144</span>
                                <span className="text-xl text-slate text-center cursor-pointer w-4 hover:text-obsidian">+</span>
                            </div>
                            <button className="flex-1 h-12 bg-obsidian text-bone font-bold tracking-widest uppercase text-xs rounded-lg hover:bg-obsidian/90 transition-colors shadow-md group relative overflow-hidden">
                                <span className="absolute inset-0 liquid-shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-500" aria-hidden="true" />
                                <span className="relative">Add Bottle to Cart</span>
                            </button>
                        </div>
                    </div>

                    {/* The Magic Sauce: Agentic UI Component */}
                    <FitmentIntegrationDemo />
                </div>

            </div>

            {/* Trust Badges */}
            <div className="bg-white border-y border-champagne/30 py-8 mt-12">
                <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                    <div className="flex flex-col items-center">
                        <ShieldCheck className="w-8 h-8 text-muted-gold mb-3" strokeWidth={1.5} />
                        <h4 className="font-serif text-[15px] font-medium text-obsidian mb-1">Engineered Compatibility</h4>
                        <p className="text-slate text-xs leading-relaxed">Every closure guaranteed to fit perfectly.</p>
                    </div>
                    <div className="flex flex-col items-center">
                        <Truck className="w-8 h-8 text-muted-gold mb-3" strokeWidth={1.5} />
                        <h4 className="font-serif text-[15px] font-medium text-obsidian mb-1">Fast Global Shipping</h4>
                        <p className="text-slate text-xs leading-relaxed">Dispatched from our facility within 24 hours.</p>
                    </div>
                    <div className="flex flex-col items-center">
                        <Star className="w-8 h-8 text-muted-gold mb-3" strokeWidth={1.5} />
                        <h4 className="font-serif text-[15px] font-medium text-obsidian mb-1">Premium Grade Glass</h4>
                        <p className="text-slate text-xs leading-relaxed">ISO certified manufacturing processes.</p>
                    </div>
                </div>
            </div>

        </main>
    );
}
