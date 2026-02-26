"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Shield, Award, TrendingUp, MapPin, Zap, ArrowUpRight, Star, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import Navbar from "@/components/Navbar";
import { useGrace } from "@/components/GraceProvider";

// -- Animation Wrapper --
const FadeUp = ({ children, delay = 0, className = "" }: { children: React.ReactNode, delay?: number, className?: string }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// -- Hero Section --
function Hero() {
  const { open: openGrace } = useGrace();
  return (
    <section className="relative min-h-[80vh] lg:h-[82vh] lg:min-h-[650px] pt-[104px] flex items-center bg-bone overflow-hidden">
      {/* Full viewport background image */}
      <div className="absolute inset-0 z-0 bg-travertine">
        <motion.div initial={{ scale: 1.05 }} animate={{ scale: 1 }} transition={{ duration: 8, ease: "easeOut" }} className="relative w-full h-full">
          <Image src="/assets/uploaded_hero.jpg" alt="Luxury perfume glass atomizer bottle" fill className="object-cover object-center lg:object-right" priority />
          {/* Subtle gradient overlay to seamlessly blend text area */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#DFD6C9] via-[#DFD6C9]/40 to-transparent"></div>
        </motion.div>
      </div>

      {/* Editorial Content */}
      <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-16 relative z-10 pt-16 lg:pt-0 pb-16 lg:pb-0">
        <div className="max-w-[600px]">
          <FadeUp delay={0.2}>
            <p className="text-xs uppercase tracking-[0.25em] text-obsidian/70 font-bold mb-6 drop-shadow-sm">EST. 1850s · NEMAT INTERNATIONAL</p>
          </FadeUp>
          <FadeUp delay={0.3}>
            <h1 className="font-serif text-5xl lg:text-[72px] font-medium text-obsidian leading-[1.05] mb-8">The Art of Beautiful Packaging</h1>
          </FadeUp>
          <FadeUp delay={0.4}>
            <p className="text-lg lg:text-xl text-obsidian/80 leading-[1.6] max-w-[480px] mb-12">
              Premium glass bottles and packaging for brands ready to scale. 170 years of fragrance expertise, now yours.
            </p>
          </FadeUp>
          <FadeUp delay={0.5} className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-8">
            <Link href="/catalog" className="w-full sm:w-auto px-8 py-4 bg-obsidian text-white uppercase text-sm font-semibold tracking-wider hover:bg-muted-gold transition-colors duration-300 shadow-md text-center">
              Explore Collections
            </Link>
            <button
              onClick={openGrace}
              className="group flex items-center space-x-2 text-obsidian text-sm font-bold hover:text-muted-gold transition-colors duration-300"
            >
              <span className="border-b-2 border-obsidian group-hover:border-muted-gold transition-colors pb-1">Talk to Grace — Our AI Expert</span>
            </button>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}

// -- Trust Bar (LIVE DATA) --
function TrustBar() {
  const stats = useQuery(api.products.getHomepageStats);

  const productCount = stats?.totalProducts
    ? `${(Math.floor(stats.totalProducts / 100) * 100).toLocaleString()}+`
    : "2,300+";

  return (
    <section className="bg-linen border-y border-champagne/50 py-8 relative z-20">
      <div className="max-w-[1440px] mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 divide-x-0 lg:divide-x divide-champagne/50">
          {[
            { stat: "170+ Years", label: "of Fragrance Expertise", icon: Shield },
            { stat: productCount, label: "Premium Products", icon: ShoppingBag },
            { stat: "Trusted by", label: "Ulta, Sephora & Whole Foods", icon: Award },
            { stat: "Made in USA", label: "No Tariff Surprises", icon: MapPin },
          ].map((item, i) => (
            <FadeUp key={i} delay={0.2 + (i * 0.1)} className="flex items-center space-x-4 lg:pl-8 first:lg:pl-0">
              <div className="w-10 h-10 rounded-full bg-bone flex items-center justify-center shrink-0 border border-champagne/30">
                <item.icon className="w-5 h-5 text-muted-gold" strokeWidth={1.5} />
              </div>
              <div>
                <h4 className="font-serif text-lg text-obsidian font-medium leading-tight">{item.stat}</h4>
                <p className="text-xs text-slate mt-0.5">{item.label}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

// -- Curated Collections --
function CuratedCollections() {
  const stats = useQuery(api.products.getHomepageStats);

  // Map collection names to display titles + visual settings
  const collectionConfig = [
    { collection: "Elegant Collection", title: "perfume & fragrance.", img: "/assets/collection_perfume.png", bg: "bg-[#DFD6C9]" },
    { collection: "Circle Collection", title: "skincare & serum.", img: "/assets/collection_skincare.png", bg: "bg-[#EADDD1]" },
    { collection: "Apothecary Collection", title: "amber apothecary.", img: "/assets/collection_amber.png", bg: "bg-[#F3E5D8]" },
    { collection: "Cylinder Collection", title: "spray & atomizer.", img: "/assets/family_cylinder.png", bg: "bg-[#D5C5B1]" },
    { collection: "Vial & Sample Collection", title: "sample & discovery.", img: "/assets/uploaded_hero.jpg", bg: "bg-[#EAE0D5]" },
    { collection: "Boston Round Collection", title: "boston rounds.", img: "/assets/collection_perfume.png", bg: "bg-[#DCD0C0]" },
    { collection: "Slim Collection", title: "slim & sleek.", img: "/assets/family_cylinder.png", bg: "bg-[#E5D7C9]" },
  ];

  return (
    <section className="pt-16 pb-20 bg-white border-y border-champagne/40">
      <div className="max-w-[1440px] mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
          <FadeUp>
            <h2 className="font-serif text-[42px] text-obsidian font-light tracking-tight lowercase">curated collections.</h2>
          </FadeUp>
          <FadeUp delay={0.2} className="mt-4 md:mt-0 text-left md:text-right flex flex-col md:items-end">
            <div className="flex items-center space-x-2 border-b border-transparent">
              <span className="text-[36px] font-bold text-obsidian leading-none mb-1">4.9</span>
              <div className="flex items-center text-muted-gold space-x-1">
                <Star className="w-5 h-5 fill-current" />
                <Star className="w-5 h-5 fill-current" />
                <Star className="w-5 h-5 fill-current" />
                <Star className="w-5 h-5 fill-current" />
                <Star className="w-5 h-5 fill-current" />
              </div>
            </div>
            <Link href="/about" className="text-[13px] text-obsidian/70 font-medium underline decoration-obsidian/30 hover:decoration-obsidian transition-colors mt-2">
              see why our customers can&apos;t stop talking about us
            </Link>
          </FadeUp>
        </div>
      </div>

      <div className="pl-6 lg:pl-[max(1.5rem,calc((100vw-1440px)/2+1.5rem))] overflow-hidden">
        <div className="flex overflow-x-auto gap-4 pb-8 snap-x snap-mandatory hide-scroll pr-[10vw]">
          {collectionConfig.map((col, i) => {
            const count = stats?.collectionCounts?.[col.collection] ?? 0;
            return (
              <FadeUp key={i} delay={i * 0.1} className="w-[80vw] sm:w-[280px] xl:w-[240px] lg:w-[260px] shrink-0 snap-center lg:snap-start">
                <Link href={`/catalog?collection=${encodeURIComponent(col.collection)}`} className={`group relative flex flex-col h-[280px] rounded-[10px] overflow-hidden cursor-pointer shadow-sm ${col.bg}`}>
                  {/* Image fills the container, anchored to the bottom */}
                  <div className="absolute inset-0 z-0 bg-[#F7F4F0]">
                    <Image src={col.img} alt={col.title} fill className="object-cover object-bottom mix-blend-multiply opacity-90 group-hover:scale-105 transition-transform duration-700 ease-out" />
                    {/* Subtle fade effect at top to keep text perfectly legible */}
                    <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#F7F4F0] to-transparent mix-blend-normal"></div>
                  </div>

                  <div className="relative z-10 p-5 mt-1 flex flex-col h-full justify-between">
                    <h3 className="font-bold text-obsidian text-[18px] lowercase leading-snug tracking-tight drop-shadow-sm">{col.title}</h3>
                    {count > 0 && (
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-obsidian/60 mt-auto">
                        {count} products
                      </p>
                    )}
                  </div>
                </Link>
              </FadeUp>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// -- Value Proposition --
function ValueProposition() {
  const pillars = [
    { title: "170 Years in Fragrance", desc: "The same glass quality we supply to Ulta and Sephora, now available for your brand.", icon: Award },
    { title: "Curated, Not Cataloged", desc: "Every product passes the same quality checks as our own retail lines. No catalog dumping.", icon: Shield },
    { title: "Grow With You", desc: "From 12-unit sample orders to 12,000-unit production runs. Volume pricing as you scale.", icon: TrendingUp },
    { title: "No Tariff Surprises", desc: "Domestic supply chain. Reliable lead times. Consistent quality. We control our own moulds.", icon: MapPin },
  ];

  return (
    <section className="bg-linen py-20 border-y border-champagne/40">
      <div className="max-w-[1440px] mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {pillars.map((pillar, i) => (
            <FadeUp key={i} delay={i * 0.1} className="flex flex-col items-center lg:items-start text-center lg:text-left">
              <div className="w-12 h-12 rounded-full border border-muted-gold/50 flex items-center justify-center mb-6 bg-bone shadow-sm">
                <pillar.icon className="w-6 h-6 text-muted-gold" strokeWidth={1.5} />
              </div>
              <h3 className="font-serif text-2xl text-obsidian mb-3">{pillar.title}</h3>
              <p className="text-slate text-sm leading-relaxed max-w-sm">{pillar.desc}</p>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

// -- Design Families Showcase (LIVE DATA) --
function DesignFamilies() {
  const stats = useQuery(api.products.getHomepageStats);

  // Primary design family cards — counts pulled live from Convex
  const familyConfig = [
    { family: "Cylinder", title: "Cylinder Collection", img: "/assets/family_cylinder.png" },
    { family: "Elegant", title: "Elegant Collection", img: "/assets/collection_perfume.png" },
    { family: "Circle", title: "Circle Collection", img: "/assets/collection_skincare.png" },
    { family: "Diva", title: "Diva Collection", img: "/assets/collection_perfume.png" },
  ];

  return (
    <section className="py-24 bg-bone overflow-hidden">
      <div className="pl-6 lg:pl-[max(1.5rem,calc((100vw-1440px)/2+1.5rem))]">
        <FadeUp className="mb-12">
          <p className="text-xs uppercase tracking-[0.25em] text-slate font-semibold mb-3">The Collection</p>
          <h2 className="font-serif text-4xl text-obsidian font-medium">Design Families</h2>
        </FadeUp>

        <div className="flex overflow-x-auto gap-8 pb-12 snap-x snap-mandatory hide-scroll pr-[10vw]">
          {familyConfig.map((fam, i) => {
            const count = stats?.familyCounts?.[fam.family] ?? 0;
            return (
              <FadeUp key={i} delay={i * 0.1} className="w-[85vw] lg:w-[420px] shrink-0 snap-center lg:snap-start">
                <Link href={`/catalog?family=${encodeURIComponent(fam.family)}`}>
                  <div className="group relative aspect-[3/4] rounded-sm overflow-hidden bg-travertine cursor-pointer shadow-sm hover:shadow-xl transition-all duration-500">
                    <Image src={fam.img} alt={fam.title} fill className="object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-in-out" />
                    <div className="absolute inset-0 bg-gradient-to-t from-obsidian/70 via-obsidian/20 to-transparent"></div>
                    <div className="absolute bottom-8 left-8 right-8">
                      <h3 className="font-serif text-[26px] text-white leading-tight mb-2">{fam.title}</h3>
                      <div className="flex items-center justify-between">
                        <p className="text-[14px] text-bone/90 font-medium">
                          {count > 0 ? `${count} products` : "Loading..."}
                        </p>
                        <span className="flex items-center text-muted-gold text-sm font-semibold opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                          Explore <ArrowRight className="w-4 h-4 ml-1" />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </FadeUp>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// -- Grace AI --
function GraceAIIntro() {
  const { open: openGrace } = useGrace();
  return (
    <section className="bg-obsidian text-bone py-24 relative overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-6 relative z-10 flex flex-col lg:flex-row items-center gap-16">
        <FadeUp className="w-full lg:w-1/2 relative">
          <div className="aspect-square lg:aspect-[4/5] relative rounded-t-full bg-travertine overflow-hidden shadow-2xl border border-white/10">
            <Image src="/assets/grace_avatar.png" alt="Grace AI Concierge" fill className="object-cover object-top" />
            <div className="absolute bottom-4 inset-x-4 bg-obsidian/90 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-xl">
              <p className="text-white/70 text-sm mb-2 font-medium">Customer</p>
              <p className="text-white text-sm leading-relaxed mb-4">&quot;I&apos;m launching an essential oil line. Need bottles for 6 different scents, probably 500 units each.&quot;</p>
              <div className="border-t border-white/10 pt-4">
                <p className="text-muted-gold text-sm mb-2 font-medium flex items-center"><Zap className="w-3 h-3 mr-1.5" /> Grace</p>
                <p className="text-bone/90 text-sm leading-relaxed">&quot;Lovely. I&apos;d recommend our amber Boston Rounds with glass droppers for UV protection. At 500 units per scent, you&apos;d qualify for our Scaler tier pricing. Shall I show you?&quot;</p>
              </div>
            </div>
          </div>
        </FadeUp>

        <div className="w-full lg:w-1/2">
          <FadeUp>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-gold font-semibold mb-3 flex items-center"><SparklesIcon className="w-4 h-4 mr-2" /> AI-POWERED CONCIERGE</p>
            <h2 className="font-serif text-4xl lg:text-5xl text-white font-medium mb-6">Meet Grace</h2>
            <p className="text-slate text-lg leading-relaxed mb-12 max-w-lg">
              Your dedicated packaging expert. Ask her anything—from bottle compatibility to scaling strategy. She knows our entire catalog inside and out.
            </p>
          </FadeUp>

          <div className="grid gap-8 mb-12">
            {[
              { title: "Product Expertise", desc: "Trained on 170 years of packaging knowledge" },
              { title: "Smart Recommendations", desc: "Suggests compatible caps, fitments, and configurations" },
              { title: "Scaling Guidance", desc: "Helps you find the right tier pricing as your brand grows" }
            ].map((feature, i) => (
              <FadeUp key={i} delay={0.2 + (i * 0.1)}>
                <h4 className="font-serif text-xl text-white mb-1">{feature.title}</h4>
                <p className="text-slate text-sm">{feature.desc}</p>
              </FadeUp>
            ))}
          </div>

          <FadeUp delay={0.5}>
            <button
              onClick={openGrace}
              className="px-8 py-4 bg-muted-gold text-obsidian uppercase text-sm font-bold tracking-wider hover:bg-white transition-colors duration-300 inline-flex items-center cursor-pointer"
            >
              Talk to Grace <ArrowUpRight className="ml-2 w-4 h-4" />
            </button>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}

function SparklesIcon(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}

// -- Social Proof --
function SocialProof() {
  const testimonials = [
    { quote: "Best Bottles transformed our unboxing experience. The glass quality is impeccable and their volume pricing scales perfectly with our growth.", name: "Sarah L.", brand: "Aura Botanica", segment: "Graduate" },
    { quote: "Grace helped us navigate a complex dropper fitment issue in minutes. It's like having an in-house packaging engineer on staff.", name: "Marcus T.", brand: "Veda Skincare", segment: "Scaler" },
    { quote: "Consistent lead times and zero tariff surprises. They are the only supply chain partner we trust completely.", name: "Elena R.", brand: "Lumiere Fragrance", segment: "Professional" }
  ];

  return (
    <section className="bg-bone py-24 overflow-hidden border-b border-champagne/40">
      <div className="max-w-[1440px] mx-auto px-6">
        <FadeUp className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.25em] text-slate font-semibold mb-3">Who Trusts Best Bottles</p>
          <h2 className="font-serif text-4xl text-obsidian font-medium mb-4">Serving 500+ Brands</h2>
          <p className="text-slate max-w-2xl mx-auto">From boutique indie perfumers to enterprise retail labels.</p>
        </FadeUp>

        <div className="flex overflow-x-auto gap-6 pb-12 snap-x snap-mandatory hide-scroll">
          {testimonials.map((test, i) => (
            <FadeUp key={i} delay={i * 0.1} className="w-[85vw] sm:w-[400px] shrink-0 snap-center">
              <div className="bg-white p-8 rounded-sm shadow-sm border border-champagne/50 h-full flex flex-col justify-between hover:border-muted-gold transition-colors duration-300">
                <p className="font-serif italic text-[20px] text-obsidian leading-relaxed mb-8">&quot;{test.quote}&quot;</p>
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-travertine"></div>
                    <div>
                      <p className="text-sm font-semibold text-obsidian">{test.name}</p>
                      <p className="text-xs text-slate">{test.brand}</p>
                    </div>
                  </div>
                  <span className="inline-block mt-2 px-3 py-1 bg-muted-gold/10 text-muted-gold text-[10px] uppercase tracking-wider font-bold rounded-full">
                    {test.segment}
                  </span>
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

// -- Education Preview --
function EducationPreview() {
  const articles = [
    { title: "Glass vs. Plastic: Why Material Matters for Your Brand", category: "Materials", img: "/assets/collection_perfume.png" },
    { title: "Finding Your Thread: A Complete Neck Size Compatibility Guide", category: "Technical", img: "/assets/family_cylinder.png" },
    { title: "From Etsy to Sephora: Scaling Your Packaging Strategy", category: "Growth", img: "/assets/collection_amber.png" }
  ];

  return (
    <section className="bg-linen py-24">
      <div className="max-w-[1440px] mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
          <FadeUp>
            <p className="text-xs uppercase tracking-[0.25em] text-slate font-semibold mb-3">From the Lab</p>
            <h2 className="font-serif text-4xl text-obsidian font-medium">Packaging Insights</h2>
          </FadeUp>
          <FadeUp delay={0.2} className="mt-6 md:mt-0">
            <button className="text-sm font-semibold text-muted-gold hover:text-obsidian transition-colors uppercase tracking-widest flex items-center">
              View All Articles <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </FadeUp>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {articles.map((article, i) => (
            <FadeUp key={i} delay={i * 0.1}>
              <div className="group cursor-pointer">
                <div className="relative aspect-[16/9] bg-travertine rounded-sm overflow-hidden mb-6 shadow-sm">
                  <Image src={article.img} alt={article.title} fill className="object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-in-out" />
                </div>
                <span className="inline-block mb-4 px-3 py-1 bg-bone text-muted-gold text-[11px] uppercase tracking-wider font-bold rounded-full border border-champagne/50">
                  {article.category}
                </span>
                <h3 className="font-serif text-2xl text-obsidian leading-tight mb-3 group-hover:text-muted-gold transition-colors">{article.title}</h3>
                <p className="text-sm text-slate mb-4">Expert insights and strategies to elevate your brand&apos;s packaging presence.</p>
                <span className="text-sm font-medium text-obsidian flex items-center group-hover:text-muted-gold transition-colors">
                  Read More <ArrowRight className="w-4 h-4 ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </span>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

// -- Newsletter --
function Newsletter() {
  return (
    <section className="bg-linen py-24 border-t border-champagne/30 text-center">
      <div className="max-w-xl mx-auto px-6">
        <FadeUp>
          <h2 className="font-serif text-3xl text-obsidian font-medium mb-4">Stay in the Know</h2>
          <p className="text-slate mb-8">Packaging insights, new arrivals, and scaling strategies. No spam—just expertise.</p>
          <form className="flex w-full items-center border border-champagne bg-white p-1 rounded-full shadow-sm hover:border-muted-gold transition-colors focus-within:border-muted-gold focus-within:ring-2 focus-within:ring-muted-gold/20">
            <input type="email" placeholder="Your email address" className="flex-1 px-6 py-3 bg-transparent text-sm focus:outline-none placeholder-slate/60 text-obsidian" required />
            <button type="submit" className="px-6 py-3 bg-muted-gold text-white uppercase text-xs font-bold tracking-wider rounded-full hover:bg-obsidian transition-colors duration-300">
              Subscribe
            </button>
          </form>
        </FadeUp>
      </div>
    </section>
  );
}

// -- Footer --
function Footer() {
  return (
    <footer className="bg-obsidian text-bone/70 pt-20 pb-8">
      <div className="max-w-[1440px] mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          <div>
            <h4 className="font-serif text-2xl text-white mb-6">BEST BOTTLES</h4>
            <p className="text-sm italic font-serif text-muted-gold mb-6">Beautifully Contained.</p>
            <div className="flex space-x-4">
              {/* Social placeholders */}
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-muted-gold transition-colors cursor-pointer"></div>
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-muted-gold transition-colors cursor-pointer"></div>
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-muted-gold transition-colors cursor-pointer"></div>
            </div>
          </div>
          <div>
            <h5 className="text-white text-sm font-semibold uppercase tracking-wider mb-6">Shop</h5>
            <ul className="space-y-4 text-sm">
              <li><Link href="/catalog" className="hover:text-muted-gold transition-colors">By Usage</Link></li>
              <li><Link href="/catalog" className="hover:text-muted-gold transition-colors">By Product Type</Link></li>
              <li><Link href="/catalog" className="hover:text-muted-gold transition-colors">By Collection</Link></li>
              <li><Link href="/catalog" className="hover:text-muted-gold transition-colors">New Arrivals</Link></li>
              <li><Link href="/catalog" className="hover:text-muted-gold transition-colors">Best Sellers</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="text-white text-sm font-semibold uppercase tracking-wider mb-6">Support</h5>
            <ul className="space-y-4 text-sm">
              <li><Link href="/contact" className="hover:text-muted-gold transition-colors">Contact</Link></li>
              <li><Link href="/resources" className="hover:text-muted-gold transition-colors">Shipping & Returns</Link></li>
              <li><Link href="/resources" className="hover:text-muted-gold transition-colors">FAQ</Link></li>
              <li><Link href="/resources" className="hover:text-muted-gold transition-colors">Compatibility Guides</Link></li>
              <li><Link href="/resources" className="hover:text-muted-gold transition-colors">Spec Sheets</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="text-white text-sm font-semibold uppercase tracking-wider mb-6">Company</h5>
            <ul className="space-y-4 text-sm">
              <li><Link href="/about" className="hover:text-muted-gold transition-colors">About / Heritage</Link></li>
              <li><a href="https://www.nematinternational.com" target="_blank" rel="noopener noreferrer" className="hover:text-muted-gold transition-colors">Nemat International</a></li>
              <li><Link href="/resources" className="hover:text-muted-gold transition-colors">Blog</Link></li>
              <li><Link href="/request-quote" className="hover:text-muted-gold transition-colors">Wholesale Inquiry</Link></li>
              <li><Link href="/contact" className="hover:text-muted-gold transition-colors">Careers</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center text-xs space-y-4 md:space-y-0 text-white/40">
          <div className="flex items-center space-x-6">
            <span>1-800-936-3628</span>
            <span>sales@nematinternational.com</span>
          </div>
          <div className="flex items-center space-x-6">
            <Link href="/resources" className="hover:text-muted-gold transition-colors">Privacy</Link>
            <Link href="/resources" className="hover:text-muted-gold transition-colors">Terms</Link>
            <span>© 2026 Nemat International</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navbar variant="home" />
      <Hero />
      <CuratedCollections />
      <TrustBar />
      <DesignFamilies />
      <SocialProof />
      <EducationPreview />
      <Newsletter />
      <Footer />
    </main>
  );
}
