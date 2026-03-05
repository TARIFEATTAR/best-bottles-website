export default function Loading() {
    return (
        <div className="min-h-screen bg-bone flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-2 border-muted-gold/30 border-t-muted-gold rounded-full animate-spin" />
                <p className="text-sm text-slate/70">Loading…</p>
            </div>
        </div>
    );
}
