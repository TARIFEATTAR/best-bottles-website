// insert_missing_lotion_bottles.mjs
// Inserts the one lotion bottle SKU confirmed missing from Convex after the
// bestbottles.com lotion-pumps page audit on 2026-02-25.
//
// Missing: LBCylSwrl9LtnBlk — Cylinder Swirl 9ml Black glass, Black Lotion Pump
//
// Usage:  node scripts/insert_missing_lotion_bottles.mjs

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env.local") });

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

const MISSING_PRODUCTS = [
    {
        productId:        "BB-GB-009-0211",
        websiteSku:       "LBCylSwrl9LtnBlk",
        graceSku:         "LB-CYL-BLK-9ML-LPM-BLK",
        category:         "Glass Bottle",
        family:           "Cylinder",
        shape:            "Standard",
        color:            "Black",
        capacity:         "9 ml (0.3 oz)",
        capacityMl:       9,
        capacityOz:       0.3,
        applicator:       "Lotion Pump",
        capColor:         "Black",
        trimColor:        null,
        capStyle:         null,
        neckThreadSize:   "17-415",
        heightWithCap:    "87 ±1 mm",
        heightWithoutCap: "74 ±1 mm",
        diameter:         "21 ±0.5 mm",
        bottleWeightG:    30.14,
        caseQuantity:     null,
        qbPrice:          1.00,
        webPrice1pc:      1.00,
        webPrice10pc:     null,
        webPrice12pc:     0.95,
        stockStatus:      "In Stock",
        itemName:         "Cylinder 9 ml (0.3 oz) Black Lotion Bottle with Lotion Pump Black Cap",
        itemDescription:  "Cylinder swirl design 9ml,1/3 oz glass bottle with treatment pump with black trim and plastic overcap.",
        imageUrl:         "https://www.bestbottles.com/images/store/enlarged_pics/LBCylSwrl9LtnBlk.gif",
        productUrl:       "https://www.bestbottles.com/all-bottles/lotion-pump-cream-jars/lotion-pumps-bottles.php",
        dataGrade:        "A",
        bottleCollection: "Lotion Bottle",
        fitmentStatus:    null,
        components:       [],
        graceDescription: null,
        productGroupId:   undefined,
    },
];

console.log(`\nInserting ${MISSING_PRODUCTS.length} missing lotion bottle(s)...\n`);

for (const product of MISSING_PRODUCTS) {
    try {
        const result = await convex.mutation(api.migrations.insertMissingProduct, { product });
        if (result.skipped) {
            console.log(`  ⏭️  SKIPPED (already exists): ${product.graceSku}`);
        } else {
            console.log(`  ✅ INSERTED: ${product.websiteSku} / ${product.graceSku} → id=${result.id}`);
        }
    } catch (err) {
        console.error(`  ❌ ERROR inserting ${product.graceSku}: ${err.message}`);
    }
}

console.log("\nDone.\n");
