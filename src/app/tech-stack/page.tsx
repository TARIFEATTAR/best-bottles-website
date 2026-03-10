'use client';

import { motion } from 'framer-motion';
import {
    Building2,
    Database,
    ShoppingBag,
    PenTool,
    GithubLogo,
    Server,
    Users,
} from "@/components/icons";
import React from 'react';
import Link from 'next/link';

const TechNode = ({ icon: Icon, title, description, badge, delay }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay }}
        className="relative flex flex-col items-center p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:bg-white/10 transition-colors w-64 z-10"
    >
        <div className="absolute -top-3 right-4 px-3 py-1 bg-gradient-to-r from-emerald-400 to-teal-500 text-black text-xs font-bold font-mono uppercase tracking-wider rounded-full shadow-lg">
            {badge}
        </div>
        <div className="p-4 bg-white/10 rounded-full mb-4 ring-1 ring-white/20">
            <Icon size={32} weight="regular" className="text-white" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2 tracking-tight">{title}</h3>
        <p className="text-sm text-gray-400 text-center leading-relaxed">
            {description}
        </p>
    </motion.div>
);

const ConnectionLine = ({ d, gradientId, delay = 0, reverse = false }: any) => (
    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 overflow-visible">
        <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
                <stop offset="50%" stopColor="rgba(52, 211, 153, 0.5)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
            </linearGradient>
        </defs>
        <motion.path
            d={d}
            stroke={`url(#${gradientId})`}
            strokeWidth="2"
            fill="none"
            strokeDasharray="6 6"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.5, delay, ease: "easeInOut" }}
        />
        <motion.circle r="3" fill="#34D399">
            <animateMotion
                dur="3s"
                repeatCount="indefinite"
                path={d}
                keyPoints={reverse ? "1;0" : "0;1"}
                keyTimes="0;1"
            />
        </motion.circle>
    </svg>
);

export default function TechStackVisual() {
    return (
        <div className="min-h-screen bg-neutral-950 font-sans text-neutral-50 overflow-hidden relative flex flex-col items-center justify-center py-20">
            <Link href="/" className="absolute top-6 left-6 font-sans text-[10px] tracking-[0.18em] uppercase text-neutral-400 hover:text-neutral-100 transition-colors">← Home</Link>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900/50 via-neutral-950 to-neutral-950"></div>

            {/* Background Decor */}
            <div className="absolute top-[20%] left-[20%] w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full pointer-events-none"></div>

            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1 }}
                className="text-center z-10 mb-20 max-w-2xl px-6"
            >
                <h1 className="text-4xl md:text-5xl font-light mb-6 tracking-tight text-white">
                    Our Modern <span className="font-semibold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400">Digital Architecture</span>
                </h1>
                <p className="text-lg text-neutral-400 font-light leading-relaxed">
                    A visual guide to how our technology stack works together securely and seamlessly—delivering an exceptional experience for every customer.
                </p>
            </motion.div>

            <div className="relative w-full max-w-6xl h-[700px] flex items-center justify-center">

                {/* Core Storefront (Center) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                    <TechNode
                        icon={Building2}
                        title="Vercel (The Storefront)"
                        badge="Hosting"
                        delay={0.5}
                        description="The lightning-fast foundation that builds and serves our entire website to customers around the globe instantly."
                    />
                </div>

                {/* GitHub (Top) */}
                <div className="absolute top-[5%] left-1/2 -translate-x-1/2 z-20">
                    <TechNode
                        icon={GithubLogo}
                        title="GitHub (The Vault)"
                        badge="Code Source"
                        delay={0.2}
                        description="Where our source code and blueprints are securely stored, versioned, and collaborated on by the team."
                    />
                </div>

                {/* SVG Connections for Desktop */}
                <div className="hidden lg:block">
                    {/* GitHub to Vercel */}
                    <ConnectionLine d="M 576 186 L 576 270" gradientId="grad-1" delay={0.6} reverse={false} />

                    {/* Vercel to Sanity */}
                    <ConnectionLine d="M 456 360 C 350 360 250 420 200 480" gradientId="grad-2" delay={0.8} reverse={true} />

                    {/* Vercel to Convex */}
                    <ConnectionLine d="M 576 450 L 576 560" gradientId="grad-3" delay={1.0} reverse={true} />

                    {/* Vercel to Shopify */}
                    <ConnectionLine d="M 696 360 C 800 360 900 420 950 480" gradientId="grad-4" delay={0.8} reverse={false} />
                </div>

                {/* Sanity (Bottom Left) */}
                <div className="absolute bottom-[10%] left-[10%] z-20">
                    <TechNode
                        icon={PenTool}
                        title="Sanity.io (The Studio)"
                        badge="Content"
                        delay={1.0}
                        description="The creative hub where we easily write product descriptions, update images, and manage all marketing content without touching code."
                    />
                </div>

                {/* Convex (Bottom Center) */}
                <div className="absolute bottom-[5%] left-1/2 -translate-x-1/2 z-20">
                    <TechNode
                        icon={Database}
                        title="Convex (The Brain)"
                        badge="Backend Data"
                        delay={1.2}
                        description="Our real-time database managing user profiles, smart AI capabilities (Grace), and interactive dynamic experiences."
                    />
                </div>

                {/* Shopify (Bottom Right) */}
                <div className="absolute bottom-[10%] right-[10%] z-20">
                    <TechNode
                        icon={ShoppingBag}
                        title="Shopify (The Register)"
                        badge="Commerce"
                        delay={1.0}
                        description="The trusted, secure engine for the shopping cart, taking payments safely, and managing product inventory."
                    />
                </div>

            </div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5, duration: 1 }}
                className="mt-12 text-center max-w-3xl px-6"
            >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-neutral-300">
                    <Users size={16} weight="regular" className="text-emerald-400" />
                    <span>The Result: A flawless, tailored shopping experience for every user from click to checkout.</span>
                </div>
            </motion.div>
        </div>
    );
}
