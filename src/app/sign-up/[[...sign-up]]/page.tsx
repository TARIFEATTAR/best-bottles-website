"use client";

import { SignUp } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { CLERK_ENABLED } from "@/lib/clerk";

export default function SignUpPage() {
    const searchParams = useSearchParams();
    const redirectUrl = searchParams?.get("redirect_url") ?? "/portal";

    if (!CLERK_ENABLED) {
        return (
            <div className="min-h-screen bg-bone flex flex-col items-center justify-center px-6">
                <div className="max-w-md text-center">
                    <p className="font-sans text-[9px] tracking-[0.3em] uppercase text-muted-gold mb-2">
                        Client Portal
                    </p>
                    <h1 className="font-serif text-3xl text-obsidian font-normal tracking-[0.02em] mb-4">
                        Sign-up is temporarily unavailable
                    </h1>
                    <p className="text-sm text-slate leading-relaxed">
                        Clerk auth is disabled for this environment. Set{" "}
                        <code className="font-mono text-[12px] bg-obsidian/[0.05] px-1.5 py-0.5 rounded">
                            NEXT_PUBLIC_CLERK_ENABLED=true
                        </code>{" "}
                        in <code className="font-mono text-[12px] bg-obsidian/[0.05] px-1.5 py-0.5 rounded">.env.local</code> and restart
                        the dev server.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bone flex flex-col items-center justify-center">
            <div className="mb-8 text-center">
                <p className="font-sans text-[9px] tracking-[0.3em] uppercase text-muted-gold mb-2">
                    Client Portal
                </p>
                <h1 className="font-serif text-3xl text-obsidian font-normal tracking-[0.02em]">
                    Create your Best Bottles account
                </h1>
            </div>
            <SignUp
                fallbackRedirectUrl={redirectUrl}
                signInFallbackRedirectUrl={redirectUrl}
            />
        </div>
    );
}
