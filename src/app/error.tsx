"use client";

import Link from "next/link";

export default function GlobalError({
    error: _error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <main className="min-h-screen bg-bone flex items-center justify-center px-4">
            <div className="max-w-md text-center">
                <h1 className="font-serif text-3xl text-obsidian mb-4">Something went wrong</h1>
                <p className="text-sm text-slate leading-relaxed mb-8">
                    We encountered an unexpected error. Please try again or return to the homepage.
                </p>
                <div className="flex items-center justify-center gap-4">
                    <button
                        onClick={reset}
                        className="px-6 py-2.5 text-xs uppercase tracking-widest font-semibold bg-obsidian text-bone rounded-full hover:bg-obsidian/90 transition-colors"
                    >
                        Try Again
                    </button>
                    <Link
                        href="/"
                        className="px-6 py-2.5 text-xs uppercase tracking-widest font-semibold border border-obsidian text-obsidian rounded-full hover:bg-obsidian/5 transition-colors"
                    >
                        Go Home
                    </Link>
                </div>
            </div>
        </main>
    );
}
