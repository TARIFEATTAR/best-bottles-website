import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://helpful-elephant-638.convex.cloud");

const data = await client.query("products:getProductGroup", { slug: "cylinder-9ml-clear-17-415-rollon" });

if (!data) {
    console.log("No data found");
    process.exit(1);
}

console.log("Group:", data.group.displayName);
console.log("Variants:", data.variants.length);
console.log("");

data.variants.slice(0, 8).forEach(v => {
    console.log("SKU:", v.graceSku);
    console.log("Name:", v.itemName);
    console.log("itemDescription:", v.itemDescription || "NULL");
    console.log("graceDescription:", v.graceDescription || "NULL");
    console.log("----");
});
