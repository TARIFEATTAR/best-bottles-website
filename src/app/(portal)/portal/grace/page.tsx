export const dynamic = "force-dynamic";
import { GoldRule, PageHeader, PortalButton, PortalCard, SectionLabel } from "@/components/portal/ui";
import GraceWorkspaceChat from "@/components/portal/GraceWorkspaceChat";

const projects = [
    { name: "Spring Serum Launch", items: 6, updated: "Today", active: true },
    { name: "Holiday Gift Set 2026", items: 3, updated: "Feb 20", active: false },
    { name: "Sample Exploration", items: 11, updated: "Feb 8", active: false },
] as const;

const savedBottles = [
    "30ml Frosted Elegant · Matte Black Sprayer",
    "10ml Cobalt Roller · Gold Cap",
    "50ml Frosted Diva · Clear Pump",
] as const;

export default function PortalGrace() {
    return (
        <div className="px-12 py-10 max-w-[1400px]">
            <PageHeader
                eyebrow="Grace AI"
                title="Your Private Workspace"
                subtitle="Brainstorm, build, and save your packaging ideas with Grace."
            />

            <div className="grid grid-cols-[260px_1fr] gap-5 items-start">

                {/* Left column */}
                <div className="flex flex-col gap-4">

                    {/* Projects */}
                    <PortalCard className="!px-5 !py-5">
                        <SectionLabel>Your Projects</SectionLabel>
                        <div className="flex flex-col">
                            {projects.map((project, i) => (
                                <div key={project.name}>
                                    <div
                                        className={`py-3 cursor-pointer ${
                                            project.active
                                                ? "border-l-2 border-muted-gold pl-3 -ml-3"
                                                : ""
                                        }`}
                                    >
                                        <p
                                            className={`font-serif text-sm mb-0.5 ${
                                                project.active ? "text-obsidian" : "text-ash"
                                            }`}
                                        >
                                            {project.name}
                                        </p>
                                        <p className="font-sans text-xs text-ash">
                                            {project.items} items · {project.updated}
                                        </p>
                                    </div>
                                    {i < projects.length - 1 && <GoldRule />}
                                </div>
                            ))}
                        </div>
                        <div className="mt-4">
                            <PortalButton variant="outline" size="sm">New Project</PortalButton>
                        </div>
                    </PortalCard>

                    {/* Saved bottles */}
                    <PortalCard dark className="!px-5 !py-5">
                        <SectionLabel>Saved Bottles</SectionLabel>
                        <div className="flex flex-col">
                            {savedBottles.map((bottle, i) => (
                                <p
                                    key={bottle}
                                    className={`font-serif text-sm text-bone opacity-80 leading-relaxed py-2 ${
                                        i < savedBottles.length - 1
                                            ? "border-b border-white/[0.07]"
                                            : ""
                                    }`}
                                >
                                    {bottle}
                                </p>
                            ))}
                        </div>
                    </PortalCard>

                </div>

                {/* Chat panel */}
                <div className="bg-linen border border-champagne rounded-lg flex flex-col overflow-hidden" style={{ height: "calc(100vh - 280px)", minHeight: 500 }}>

                    {/* Chat header */}
                    <div className="px-7 py-5 border-b border-champagne flex items-center justify-between shrink-0">
                        <div>
                            <SectionLabel>Active Session</SectionLabel>
                            <h2 className="font-serif text-lg text-obsidian font-normal">
                                Spring Serum Launch
                            </h2>
                        </div>
                        <div className="flex gap-3">
                            <PortalButton variant="outline" size="sm">Save Session</PortalButton>
                            <PortalButton size="sm">Open Configurator</PortalButton>
                        </div>
                    </div>

                    {/* Client-side chat (messages + input) */}
                    <GraceWorkspaceChat />

                </div>
            </div>
        </div>
    );
}
