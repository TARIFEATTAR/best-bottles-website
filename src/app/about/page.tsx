import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Award, Globe, Shield, Users } from "lucide-react";

export const metadata: Metadata = {
    title: "About Best Bottles — 170+ Years of Packaging Excellence",
    description: "Discover the story behind Best Bottles and Nemat International. 170 years of fragrance and packaging expertise, serving brands from startups to Sephora.",
};

const VALUES = [
    { icon: Award, title: "Heritage", description: "Over 170 years of fragrance and packaging expertise, rooted in the Nemat International family tradition." },
    { icon: Shield, title: "Quality", description: "Every glass bottle meets Type III cosmetic and pharmaceutical standards. UV-resistant amber glass available across all families." },
    { icon: Globe, title: "Made in USA", description: "Domestic manufacturing means no tariff surprises, shorter lead times, and consistent quality control." },
    { icon: Users, title: "Partnership", description: "From 12-piece samples to 100,000-unit production runs, we scale with your brand at every stage." },
];

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-bone">
            {/* Hero */}
            <section className="pt-32 pb-20 px-6">
                <div className="max-w-[800px] mx-auto text-center">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-gold font-bold mb-4">Our Story</p>
                    <h1 className="font-serif text-5xl lg:text-6xl text-obsidian leading-tight mb-6">
                        The Art of Beautiful Packaging
                    </h1>
                    <p className="text-lg text-slate leading-relaxed max-w-[600px] mx-auto">
                        Best Bottles is a division of Nemat International, a family-owned business with over 170 years
                        of fragrance expertise. We provide premium glass bottles and packaging solutions to beauty,
                        fragrance, and wellness brands worldwide.
                    </p>
                </div>
            </section>

            {/* Values */}
            <section className="py-16 px-6 bg-white/50 border-y border-champagne/30">
                <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {VALUES.map((v) => (
                        <div key={v.title} className="text-center">
                            <div className="w-12 h-12 rounded-full bg-muted-gold/10 flex items-center justify-center mx-auto mb-4">
                                <v.icon className="w-5 h-5 text-muted-gold" />
                            </div>
                            <h3 className="font-serif text-lg text-obsidian mb-2">{v.title}</h3>
                            <p className="text-sm text-slate leading-relaxed">{v.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Story */}
            <section className="py-20 px-6">
                <div className="max-w-[800px] mx-auto space-y-8">
                    <h2 className="font-serif text-3xl text-obsidian">From Fragrance House to Packaging Partner</h2>
                    <p className="text-slate leading-relaxed">
                        What began as a family fragrance business in the 1850s has evolved into one of the most trusted
                        names in premium glass packaging. Our founder&apos;s original insight was simple: the bottle should
                        be as beautiful as what&apos;s inside it.
                    </p>
                    <p className="text-slate leading-relaxed">
                        Today, Best Bottles serves over 500 brands — from indie Etsy perfumers to major retailers like
                        Ulta, Sephora, and Whole Foods. Our catalog of 2,200+ products spans 12 distinct glass bottle
                        families, aluminum options, and hundreds of closure and applicator combinations.
                    </p>
                    <p className="text-slate leading-relaxed">
                        Every product in our catalog is engineered for compatibility. Our proprietary fitment system
                        ensures that caps, sprayers, droppers, and roll-ons pair perfectly with their bottles — no
                        guesswork, no surprises.
                    </p>

                    <div className="pt-8 flex flex-col sm:flex-row gap-4">
                        <Link
                            href="/catalog"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-obsidian text-bone text-sm font-semibold tracking-wide uppercase hover:bg-muted-gold transition-colors"
                        >
                            Explore the Catalog
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/contact"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-obsidian text-obsidian text-sm font-semibold tracking-wide uppercase hover:bg-obsidian hover:text-bone transition-colors"
                        >
                            Get in Touch
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
