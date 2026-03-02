import Link from "next/link";

export default function NotFound() {
    return (
        <main className="min-h-screen bg-bone flex items-center justify-center px-4">
            <div className="max-w-md text-center">
                <p className="text-xs uppercase tracking-widest font-semibold text-muted-gold mb-4">404</p>
                <h1 className="font-serif text-3xl text-obsidian mb-4">Page Not Found</h1>
                <p className="text-sm text-slate leading-relaxed mb-8">
                    The page you&apos;re looking for doesn&apos;t exist or has been moved.
                </p>
                <div className="flex items-center justify-center gap-4">
                    <Link
                        href="/"
                        className="px-6 py-2.5 text-xs uppercase tracking-widest font-semibold bg-obsidian text-bone rounded-full hover:bg-obsidian/90 transition-colors"
                    >
                        Go Home
                    </Link>
                    <Link
                        href="/catalog"
                        className="px-6 py-2.5 text-xs uppercase tracking-widest font-semibold border border-obsidian text-obsidian rounded-full hover:bg-obsidian/5 transition-colors"
                    >
                        Browse Catalog
                    </Link>
                </div>
            </div>
        </main>
    );
}
