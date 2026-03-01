import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Wrench, MessageCircle, FileText } from "lucide-react";

export const metadata: Metadata = {
    title: "Resources — Guides, FAQs & Compatibility Tools | Best Bottles",
    description: "Everything you need to choose the right bottles, closures, and packaging for your brand. Compatibility guides, FAQs, and expert insights.",
};

const RESOURCES = [
    {
        icon: Wrench,
        title: "Compatibility Guides",
        description: "Understand neck finishes, thread sizes, and which closures work with which bottles. Our fitment system makes it foolproof.",
        cta: "Browse Catalog",
        href: "/catalog",
    },
    {
        icon: BookOpen,
        title: "Frequently Asked Questions",
        description: "From minimum order quantities to lead times, compatibility to UV protection — find answers to the questions brands ask most.",
        cta: "Contact Us",
        href: "/contact",
    },
    {
        icon: FileText,
        title: "Request a Quote",
        description: "Need volume pricing or custom packaging? Submit a quote request and our team will prepare a tailored proposal within 48 hours.",
        cta: "Request Quote",
        href: "/request-quote",
    },
    {
        icon: MessageCircle,
        title: "Ask Grace",
        description: "Our AI Bottling Specialist is available 24/7. Ask Grace about compatibility, pricing, and product recommendations.",
        cta: "Open Grace",
        href: "/",
    },
];

const FAQ_ITEMS = [
    { q: "What is the minimum order quantity?", a: "There's no strict piece count — our minimum order is approximately $50. You can mix and match bottles and components to reach that threshold." },
    { q: "How do I know which cap fits my bottle?", a: "Every bottle in our catalog lists its neck finish (e.g., 18-415, 20-400). Use our fitment system or ask Grace to find compatible closures instantly." },
    { q: "Do you offer custom etching?", a: "We offer etching services on select bottles, including atomizers. Contact us to discuss your project and we'll let you know what's possible." },
    { q: "What are your lead times?", a: "Standard stock orders ship within 3-5 business days. Larger or specialty orders may require additional lead time depending on quantities." },
    { q: "Are your bottles safe for essential oils?", a: "Our glass bottles are Type III soda-lime glass, suitable for cosmetic and pharmaceutical use. Amber and cobalt blue options offer UV protection for light-sensitive formulations." },
    { q: "Do you ship internationally?", a: "We primarily serve the domestic US market with competitive shipping rates. For international inquiries, contact us and we'll see what we can do." },
];

export default function ResourcesPage() {
    return (
        <div className="min-h-screen bg-bone">
            {/* Hero */}
            <section className="pt-32 pb-16 px-6">
                <div className="max-w-[800px] mx-auto text-center">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-gold font-bold mb-4">Resources</p>
                    <h1 className="font-serif text-5xl lg:text-6xl text-obsidian leading-tight mb-6">
                        Tools & Knowledge
                    </h1>
                    <p className="text-lg text-slate leading-relaxed max-w-[600px] mx-auto">
                        Everything you need to make confident packaging decisions — from compatibility tools to pricing guides.
                    </p>
                </div>
            </section>

            {/* Resource Cards */}
            <section className="py-12 px-6">
                <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                    {RESOURCES.map((r) => (
                        <Link
                            key={r.title}
                            href={r.href}
                            className="group bg-white rounded-xl p-6 border border-champagne/40 hover:border-muted-gold/60 transition-all hover:shadow-lg"
                        >
                            <div className="w-10 h-10 rounded-lg bg-muted-gold/10 flex items-center justify-center mb-4">
                                <r.icon className="w-5 h-5 text-muted-gold" />
                            </div>
                            <h3 className="font-serif text-xl text-obsidian mb-2">{r.title}</h3>
                            <p className="text-sm text-slate leading-relaxed mb-4">{r.description}</p>
                            <span className="text-sm font-semibold text-muted-gold group-hover:underline">{r.cta} →</span>
                        </Link>
                    ))}
                </div>
            </section>

            {/* FAQ */}
            <section className="py-16 px-6 bg-white/50 border-y border-champagne/30">
                <div className="max-w-[800px] mx-auto">
                    <h2 className="font-serif text-3xl text-obsidian mb-10 text-center">Frequently Asked Questions</h2>
                    <div className="space-y-6">
                        {FAQ_ITEMS.map((item) => (
                            <div key={item.q} className="border-b border-champagne/30 pb-6">
                                <h3 className="font-serif text-lg text-obsidian mb-2">{item.q}</h3>
                                <p className="text-sm text-slate leading-relaxed">{item.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
