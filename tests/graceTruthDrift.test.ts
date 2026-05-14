import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../convex/gracePrompt";
import { FAMILY_MIN_SIZE_ML } from "../convex/graceSearchUtils";

type RetrievalMatrixConfig = {
    capacityMlByFamily: Record<string, number[]>;
};

type ElevenLabsAgentConfig = {
    conversation_config?: {
        agent?: {
            prompt?: {
                prompt?: string;
            };
        };
    };
};

const root = process.cwd();
const matrix = JSON.parse(
    readFileSync(resolve(root, "data/grace-evals/retrieval-matrix-config.json"), "utf8"),
) as RetrievalMatrixConfig;
const elevenLabsConfig = JSON.parse(
    readFileSync(resolve(root, "scripts/grace_agent_config.json"), "utf8"),
) as ElevenLabsAgentConfig;

const runtimePrompts = [
    { name: "convex/gracePrompt.ts", text: buildSystemPrompt() },
    {
        name: "scripts/grace_agent_config.json",
        text: elevenLabsConfig.conversation_config?.agent?.prompt?.prompt ?? "",
    },
];

describe("Grace product-truth drift", () => {
    it("keeps static family minimums aligned with the retrieval matrix", () => {
        for (const [family, minimum] of Object.entries(FAMILY_MIN_SIZE_ML)) {
            const matrixSizes = matrix.capacityMlByFamily[family];
            expect(matrixSizes, `${family} is missing from retrieval-matrix-config`).toBeTruthy();
            expect(Math.min(...matrixSizes), `${family} minimum in retrieval matrix`).toBe(minimum);
        }
    });

    it("does not ship stale family minimum claims in runtime prompts", () => {
        const staleClaims = [
            /\bCylinder:\s*5ml\b/i,
            /\bEmpire:\s*30ml\b/i,
            /\bSlim:\s*15ml\b/i,
            /\|\s*Cylinder\s*\|\s*\**5ml\b/i,
            /\|\s*Empire\s*\|\s*\**30ml\b/i,
            /\|\s*Slim\s*\|\s*\**15ml\b/i,
        ];

        for (const source of runtimePrompts) {
            for (const staleClaim of staleClaims) {
                expect(source.text, `${source.name} contains stale claim ${staleClaim}`).not.toMatch(staleClaim);
            }
        }
    });

    it("keeps the ElevenLabs config snapshot aligned with family minimums", () => {
        const prompt = elevenLabsConfig.conversation_config?.agent?.prompt?.prompt ?? "";

        for (const [family, minimum] of Object.entries(FAMILY_MIN_SIZE_ML)) {
            expect(prompt, `ElevenLabs prompt missing ${family}: ${minimum}ml`).toContain(
                `- ${family}: ${minimum}ml`,
            );
        }
    });
});
