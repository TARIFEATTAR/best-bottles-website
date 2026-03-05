/**
 * audit_grace_navigation.mjs
 *
 * Simulates Grace's navigation behavior across a battery of common user queries
 * and flags any URLs that would lead to a 404 / blank page.
 *
 * Usage:
 *   node scripts/audit_grace_navigation.mjs
 *   node scripts/audit_grace_navigation.mjs --verbose
 *   node scripts/audit_grace_navigation.mjs --json > report.json
 *
 * What it checks:
 *  1. Pulls every valid product-group slug from Convex.
 *  2. Runs each test query through the searchCatalog API (same path Grace uses).
 *  3. Applies the same URL-building logic Grace uses:
 *       - 1 result  → /products/{slug}
 *       - N results → /catalog?family=X  (or /catalog?search=…)
 *       - 0 results → flags as "no results"
 *  4. For every /products/ URL, verifies the slug is in the valid-slug set.
 *  5. Prints a report with ✅ PASS / ❌ BROKEN / ⚠️ WARN lines and a summary.
 */

import { ConvexHttpClient } from "convex/browser";

// ── Config ────────────────────────────────────────────────────────────────────

const CONVEX_URL = "https://helpful-elephant-638.convex.cloud";
const VERBOSE = process.argv.includes("--verbose");
const JSON_OUTPUT = process.argv.includes("--json");

// ── Test queries ──────────────────────────────────────────────────────────────
// These mirror real things a customer might say to Grace.
// Each entry has:
//   query   : the search term Grace would pass to searchCatalog
//   family  : optional family hint (mimics when Grace calls showProducts with family)
//   label   : human-readable description of the intent
//   expectSlugContains : optional substring the resulting slug should contain
//   expectPath : optional exact path prefix we expect (e.g. "/catalog")

const TEST_QUERIES = [
  // ── Roll-ons ──
  { label: "9ml clear cylinder roll-on",     query: "9ml clear cylinder roll-on",      family: "Cylinder" },
  { label: "9ml amber cylinder roll-on",     query: "9ml amber cylinder roll-on",      family: "Cylinder" },
  { label: "9ml cobalt blue cylinder",       query: "9ml cobalt blue cylinder",        family: "Cylinder" },
  { label: "5ml roll-on",                    query: "5ml roll-on" },
  { label: "28ml cylinder roll-on",          query: "28ml cylinder roll-on",           family: "Cylinder" },
  { label: "50ml roll-on",                   query: "50ml roll-on" },
  { label: "roll-on bottles",                query: "roll-on",                         expectPath: "/catalog" },

  // ── Boston Round ──
  { label: "15ml boston round",              query: "15ml boston round",               family: "Boston Round" },
  { label: "30ml boston round",              query: "30ml boston round",               family: "Boston Round" },
  { label: "60ml boston round",              query: "60ml boston round",               family: "Boston Round" },
  { label: "boston round family browse",     query: "boston round",                    family: "Boston Round", expectPath: "/catalog" },

  // ── Diva / Elegant ──
  { label: "diva bottle",                    query: "diva",                            family: "Diva",    expectPath: "/catalog" },
  { label: "elegant bottle",                 query: "elegant",                         family: "Elegant", expectPath: "/catalog" },
  { label: "30ml elegant",                   query: "30ml elegant",                    family: "Elegant" },

  // ── Spray / Mist ──
  { label: "9ml fine mist sprayer",          query: "9ml fine mist sprayer",           family: "Cylinder" },
  { label: "fine mist spray bottles",        query: "fine mist spray",                 expectPath: "/catalog" },
  { label: "antique bulb spray",             query: "antique bulb spray" },

  // ── Lotion pumps ──
  { label: "9ml lotion pump",                query: "9ml lotion pump",                 family: "Cylinder" },
  { label: "50ml lotion pump",               query: "50ml lotion pump" },
  { label: "100ml circle lotion pump",       query: "100ml circle lotion pump",        family: "Circle" },

  // ── Dropper / Reducer ──
  { label: "dropper bottle",                 query: "dropper",                         expectPath: "/catalog" },
  { label: "reducer bottle",                 query: "reducer",                         expectPath: "/catalog" },

  // ── Atomizer ──
  { label: "atomizer",                       query: "atomizer",                        family: "Atomizer", expectPath: "/catalog" },

  // ── Square / Rectangle ──
  { label: "square bottle",                  query: "square",                          family: "Square",   expectPath: "/catalog" },
  { label: "rectangle bottle",              query: "rectangle bottle",                family: "Rectangle", expectPath: "/catalog" },

  // ── Round / Circle ──
  { label: "round bottle",                   query: "round",                           family: "Round",    expectPath: "/catalog" },
  { label: "circle bottle",                  query: "circle",                          family: "Circle",   expectPath: "/catalog" },

  // ── Grace might hallucinate these specific product pages ──
  { label: "[hallucination] /products/cylinder",            query: "_fake_slug_test_", _fakeSlug: "/products/cylinder" },
  { label: "[hallucination] /products/boston-round",        query: "_fake_slug_test_", _fakeSlug: "/products/boston-round" },
  { label: "[hallucination] /products/9ml-clear-roll-on",   query: "_fake_slug_test_", _fakeSlug: "/products/9ml-clear-roll-on" },
  { label: "[hallucination] /products/cylinder-9ml-clear-roll-on-bottle", query: "_fake_slug_test_", _fakeSlug: "/products/cylinder-9ml-clear-roll-on-bottle" },
  { label: "[hallucination] /products/boston-round-30ml",   query: "_fake_slug_test_", _fakeSlug: "/products/boston-round-30ml" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildUrl(products, query, family) {
  if (products.length === 0) return null;

  if (products.length === 1 && products[0].slug) {
    return `/products/${products[0].slug}`;
  }

  // Multiple results — same logic as Grace's showProducts
  const qs = new URLSearchParams();
  if (family) {
    qs.set("family", family);
  } else {
    const families = [...new Set(products.map((p) => p.family).filter(Boolean))];
    if (families.length === 1 && families[0]) {
      qs.set("family", families[0]);
    } else if (query) {
      qs.set("search", query);
    }
  }
  return `/catalog${qs.toString() ? `?${qs.toString()}` : ""}`;
}

const COLORS = {
  reset: "\x1b[0m",
  red:   "\x1b[31m",
  green: "\x1b[32m",
  yellow:"\x1b[33m",
  cyan:  "\x1b[36m",
  bold:  "\x1b[1m",
  dim:   "\x1b[2m",
};
const c = (color, text) => JSON_OUTPUT ? text : `${COLORS[color]}${text}${COLORS.reset}`;

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const client = new ConvexHttpClient(CONVEX_URL);

  if (!JSON_OUTPUT) {
    console.log(c("bold", "\n🔍  Grace Navigation Audit\n"));
    console.log(c("dim", `  Convex: ${CONVEX_URL}`));
    console.log(c("dim", `  Queries to test: ${TEST_QUERIES.length}\n`));
  }

  // 1. Pull all valid slugs
  if (!JSON_OUTPUT) process.stdout.write("  Loading all product group slugs… ");
  const allGroups = await client.query("products:getAllCatalogGroups");
  const validSlugs = new Set(allGroups.map((g) => g.slug).filter(Boolean));
  const allFamilies = new Set(allGroups.map((g) => g.family).filter(Boolean));
  if (!JSON_OUTPUT) console.log(c("green", `✓ ${validSlugs.size} slugs, ${allFamilies.size} families\n`));

  // 2. Run every test query
  const results = [];
  let pass = 0, broken = 0, warn = 0, noResults = 0;

  for (const test of TEST_QUERIES) {
    const row = {
      label: test.label,
      query: test.query,
      family: test.family ?? null,
      url: null,
      status: "pass",
      reason: "",
      hits: 0,
    };

    // Hallucination tests — just validate a fabricated slug directly
    if (test._fakeSlug) {
      row.url = test._fakeSlug;
      if (test._fakeSlug.startsWith("/products/")) {
        const slug = test._fakeSlug.replace("/products/", "");
        if (!validSlugs.has(slug)) {
          row.status = "broken";
          row.reason = `Slug "${slug}" does not exist in database`;
          broken++;
        } else {
          row.status = "pass";
          pass++;
        }
      }
      results.push(row);
      continue;
    }

    // Real catalog search
    let products = [];
    try {
      products = await client.query("grace:searchCatalog", {
        searchTerm: test.query,
        familyLimit: test.family,
      });
    } catch (e) {
      row.status = "error";
      row.reason = `searchCatalog threw: ${e.message}`;
      warn++;
      results.push(row);
      continue;
    }

    row.hits = products.length;

    if (products.length === 0) {
      row.status = "no_results";
      row.reason = "searchCatalog returned 0 results";
      noResults++;
      results.push(row);
      continue;
    }

    const url = buildUrl(products, test.query, test.family);
    row.url = url;

    if (!url) {
      row.status = "warn";
      row.reason = "Could not build URL from results";
      warn++;
    } else if (url.startsWith("/products/")) {
      const slug = url.replace("/products/", "");
      if (!validSlugs.has(slug)) {
        row.status = "broken";
        row.reason = `Slug "${slug}" does not exist in database`;
        broken++;
      } else {
        if (test.expectPath && !url.startsWith(test.expectPath)) {
          row.status = "warn";
          row.reason = `Expected path starting with "${test.expectPath}" but got "${url}"`;
          warn++;
        } else {
          row.status = "pass";
          pass++;
        }
      }
    } else if (url.startsWith("/catalog")) {
      if (test.expectPath && !url.startsWith(test.expectPath)) {
        row.status = "warn";
        row.reason = `Expected path starting with "${test.expectPath}" but got "${url}"`;
        warn++;
      } else {
        row.status = "pass";
        pass++;
      }
    } else {
      row.status = "warn";
      row.reason = `Unexpected URL format: "${url}"`;
      warn++;
    }

    results.push(row);
  }

  // 3. Output
  if (JSON_OUTPUT) {
    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      summary: { total: results.length, pass, broken, warn, noResults },
      validSlugCount: validSlugs.size,
      results,
    }, null, 2));
    return;
  }

  // Human-readable table
  const labelW = 52;
  const urlW   = 55;

  console.log(
    c("bold", "  " +
      "QUERY / LABEL".padEnd(labelW) +
      "HITS".padEnd(6) +
      "GENERATED URL".padEnd(urlW) +
      "STATUS"
    )
  );
  console.log("  " + "─".repeat(labelW + 6 + urlW + 12));

  for (const r of results) {
    const statusTag =
      r.status === "pass"       ? c("green",  "✅ PASS")   :
      r.status === "broken"     ? c("red",    "❌ BROKEN") :
      r.status === "warn"       ? c("yellow", "⚠️  WARN")  :
      r.status === "no_results" ? c("yellow", "⚠️  NO RESULTS") :
                                   c("yellow", "⚠️  ERROR");

    const label = r.label.length > labelW - 2 ? r.label.slice(0, labelW - 3) + "…" : r.label;
    const url   = (r.url ?? "—").length > urlW - 2 ? (r.url ?? "—").slice(0, urlW - 3) + "…" : (r.url ?? "—");

    console.log(
      "  " +
      label.padEnd(labelW) +
      String(r.hits).padEnd(6) +
      url.padEnd(urlW) +
      statusTag
    );

    if (VERBOSE && r.reason) {
      console.log(c("dim", "      ↳ " + r.reason));
    } else if (r.status !== "pass" && r.reason) {
      console.log(c("dim", "      ↳ " + r.reason));
    }
  }

  // Summary
  console.log("\n  " + "─".repeat(labelW + 6 + urlW + 12));
  console.log(
    c("bold", "\n  Summary") +
    `  Total: ${results.length}  ` +
    c("green",  `Pass: ${pass}`) + "  " +
    c("red",    `Broken: ${broken}`) + "  " +
    c("yellow", `Warn/NoResults: ${warn + noResults}`) +
    "\n"
  );

  if (broken > 0) {
    console.log(c("red", "  ⚠️  Action required: Grace would send users to broken URLs for the ❌ items above."));
    console.log(c("dim", "     Run with --json to export the full report.\n"));
    process.exitCode = 1;
  } else {
    console.log(c("green", "  All tested navigation paths resolve to valid URLs. ✓\n"));
  }

  // Bonus: print all valid families so you can cross-check Grace's prompt
  if (VERBOSE) {
    console.log(c("bold", "\n  Valid Families in Database:"));
    console.log("  " + [...allFamilies].sort().join(", ") + "\n");
  }
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
