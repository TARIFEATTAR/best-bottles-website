---
name: product-naming-best-practices
description: Analyzes and normalizes product naming for B2B bottle/packaging e-commerce. Use when naming products, display names, slugs, or comparing with industry best practices for wholesale bottles, roll-ons, sprayers, and packaging.
---

# Product Naming Best Practices — B2B Bottles & Packaging

## When to Use

- User asks about naming conventions, display names, or slug structure
- Comparing site naming with industry best practices
- Normalizing product titles (e.g. "Cylinder 5 ml" vs "5 ml Roll-On")
- Fixing catalog/filter mismatches (spray showing in roll-on, etc.)

---

## Core Principles

### 1. Application-First for Bottles

For bottles with applicators, **lead with the application method** when the user is browsing by applicator:

| Context | Preferred | Avoid |
|---------|-----------|-------|
| Roll-on catalog filter | "5 ml Roll-On Clear" | "Cylinder 5 ml (0.17 oz) Clear (Roll-On)" |
| Spray catalog filter | "5 ml Spray Clear" | "Cylinder 5 ml (0.17 oz) Clear (Spray)" |
| General / family browse | "Cylinder 5 ml Clear" | — |

**Rationale:** B2B buyers often search by application (roll-on, spray, dropper). Leading with shape (Cylinder) buries the applicator.

### 2. Attribute Order

Industry pattern for packaging product names:

1. **Application / product type** (Roll-On, Spray, Dropper, Cap)
2. **Capacity** (5 ml, 10 ml)
3. **Material / shape** (Glass, Cylinder, Boston Round)
4. **Color** (Clear, Amber, Blue)

Example: `5 ml Roll-On Glass Bottle — Clear` or `5 ml Roll-On Cylinder — Clear`

### 3. Slug & URL Consistency

Slugs must **uniquely identify** the product and **match filter expectations**:

- `cylinder-5ml-clear-13-415-rollon` → Roll-on only
- `cylinder-5ml-clear-13-415-spray` → Spray only

**Never** show a `-spray` slug when the user filtered by roll-on (and vice versa). Enforce slug suffix in catalog filters.

### 4. SEO & Clarity

- Include capacity, thread size, and applicator in display names
- Keep names under ~60 chars for search snippets
- Use consistent terminology (e.g. "Roll-On" not "Roll on" or "Rollon")

---

## Naming Templates

### Bottles with Applicators

```
[Capacity] [Applicator] [Shape/Family] — [Color]
```

Examples:
- `5 ml Roll-On Cylinder — Clear`
- `10 ml Spray Bell — Amber`
- `15 ml Dropper Boston Round — Cobalt Blue`

### Caps & Components

```
[Type] [Thread] — [Color]
```

Examples:
- `Short Cap 13-415 — Black`
- `Fine Mist Sprayer 13-415 — Gold`

---

## Implementation Checklist

When changing naming:

1. **buildDisplayName** (convex/migrations.ts) — controls group display names
2. **Catalog filter** — ensure slug suffix matches applicator filter (belt-and-suspenders)
3. **PDP title** — uses `group.displayName`; consider application-first when `applicatorParam` is set
4. **Breadcrumbs** — reflect filter context (e.g. "Roll-On Bottles > Cylinder > 5 ml Clear")

---

## Reference Sites

- **SKS Bottle** (sks-bottle.com): Categories by application (Dropper Bottles, Sprayers) and material
- **BestBottles** (bestbottles.com): Family + capacity + applicator in URLs
- **Juni / e-commerce**: Plan naming before launch; avoid redirects; use attribute templates
