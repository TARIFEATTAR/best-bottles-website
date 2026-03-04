import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
const groups = await client.query(api.products.getAllCatalogGroups);

const slugs = ['fine-mist-sprayer-20-410', 'lotion-pump-37mm'];
for (const slug of slugs) {
  const g = groups.find(g => g.slug === slug);
  if (!g) { console.log('NOT FOUND:', slug); continue; }
  const variants = await client.query(api.products.getVariantsForGroup, { groupId: g._id });
  console.log('\n=== ' + slug + ' ===');
  console.log('Group: family=' + g.family + ' | collection=' + g.bottleCollection);
  for (const v of variants) {
    console.log('  ' + v.graceSku + ' | family=' + v.family + ' | cat=' + v.category + ' | col=' + v.bottleCollection);
    console.log('    ' + (v.itemName || '').substring(0, 90));
  }
}
