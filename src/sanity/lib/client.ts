import { createClient, type SanityClient } from "@sanity/client";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

export const isSanityConfigured = Boolean(projectId && projectId.length > 0);

let _client: SanityClient | null = null;

export const client: SanityClient = isSanityConfigured
    ? createClient({
          projectId: projectId!,
          dataset,
          apiVersion: "2024-01-01",
          useCdn: true,
      })
    : (null as unknown as SanityClient);
