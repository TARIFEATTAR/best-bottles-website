# Best Bottles Content Handbook

A guide for the Best Bottles team to manage homepage content through Sanity Studio.

---

## Getting Started

### Accessing Sanity Studio

1. **Local:** Run `npx sanity dev` in the project folder. Studio opens at **http://localhost:3333**
2. **Production:** Your team lead can share the Studio URL (e.g. `https://your-project.sanity.studio`)

### Publish vs. Save

- **Save** = Draft only. Changes are not visible on the live site.
- **Publish** = Changes go live. Always click **Publish** when you're done editing.

---

## Homepage Sections

### 1. Hero Slider (Top Banner)

**Single slide** = static hero. **Multiple slides** = rotating carousel (auto-advances every 6 seconds, with prev/next arrows and dots).

Each slide has:

| Field | What it does | Tips |
|-------|--------------|------|
| **Media Type** | Image or Video | Use Image for most cases. Video for special campaigns. |
| **Hero Image** | Main banner photo | Use hotspot to set the focal point. 1920×1080 or larger. |
| **Headline** | Main text (e.g. "Beautifully Contained") | Leave empty to keep the default. |
| **Subheadline** | Tagline below the headline | Short, punchy. |
| **Eyebrow** | Small label above headline | e.g. "A Division of Nemat International" |
| **Button Text** | Primary CTA label | e.g. "Explore Collections", "Shop Black Friday" |
| **Button Link** | Where the button goes | e.g. /catalog, /catalog?search=sale, /catalog?families=Boston+Round |

**Slider use cases:** Black Friday sale, seasonal promos, different collections. Add 2–6 slides; drag to reorder.

**Video:** If using video, add an MP4 or WebM file and a poster image (a frame from the video). Keep files under 10MB.

---

### 2. Start Here (Guided Browsing)

Section-level fields:

- **Eyebrow** – e.g. "Guided Browsing"
- **Section Title** – e.g. "Start Here"
- **Subheading** – e.g. "Choose your use case to narrow the catalog faster."

**Cards (up to 6):**

| Field | What it does |
|-------|--------------|
| **Title** | Card title (e.g. "essential oils & roll-ons") |
| **Subtitle** | Short description on the card |
| **Link URL** | Where the card goes when clicked |
| **Card Image** | Product or lifestyle image (optional) |
| **Background Color** | Hex color (e.g. #DFD6C9) |

**Common Link URLs for Start Here cards:**

| Use case | Link URL |
|----------|----------|
| Roll-ons | `/catalog?applicators=rollon` |
| Droppers & pumps | `/catalog?applicators=dropper&applicators=lotionpump` |
| Vials / samples | `/catalog?families=Vial` |
| Packaging | `/catalog?category=Packaging` |
| Components | `/catalog?category=Component` |
| Spray bottles | `/catalog?applicators=spray` |

---

### 3. Design Families

Bottle families shown in the carousel. **Family Slug must match the catalog exactly.**

**Valid Family Slugs:** Cylinder, Elegant, Circle, Sleek, Round, Diva, Slim, Boston Round, Empire, Rectangle, Atomizer, Flair

| Field | What it does |
|-------|--------------|
| **Family Slug** | Must match catalog. Do not change unless adding a new family. |
| **Display Title** | Label on the card (can differ, e.g. "Atomizers" for Atomizer) |
| **Card Image** | Bottle or product image (optional) |
| **Sort Order** | 0 = first, 1 = second, etc. |

---

### 4. Education Preview

Featured blog articles. Create Journal posts first, then reference them here.

| Field | What it does |
|-------|--------------|
| **Section Title** | e.g. "Packaging Insights" |
| **Section Eyebrow** | e.g. "From the Lab" |
| **Featured Articles** | Select up to 5 Journal posts |
| **View All Link** | Usually `/blog` or `/resources` |

---

### 5. Mega Menu Panels (Optional)

Featured images in the nav dropdowns (Bottles, Closures, Specialty). Leave empty for icon-only menus.

| Field | What it does |
|-------|--------------|
| **Featured Image** | Image in the dropdown |
| **Title** | Link text |
| **Subtitle** | Optional supporting text |
| **Link URL** | Where it goes (e.g. `/catalog?families=Boston+Round`) |

---

## Image Best Practices

| Section | Recommended size | Format |
|---------|------------------|--------|
| Hero | 1920×1080 or larger | JPG or PNG |
| Start Here cards | 600×400 | JPG or PNG |
| Design Family cards | 600×800 (portrait) | JPG or PNG |
| Mega menu | 400×300 | JPG or PNG |

- Use **hotspot** to set the focal point for cropping.
- Keep file sizes reasonable (under 500KB when possible).

---

## Quick Reference: Catalog URLs

Use these when building links for Start Here cards or mega menu:

- **By applicator:** `/catalog?applicators=rollon`, `applicators=dropper`, `applicators=spray`, `applicators=lotionpump`
- **By family:** `/catalog?families=Cylinder`, `families=Boston+Round`, etc.
- **By category:** `/catalog?category=Packaging`, `category=Component`
- **Search:** `/catalog?search=amber`

---

## Need Help?

- **Schema descriptions:** Hover over field labels in Sanity for inline help.
- **Technical support:** Contact your development team.
- **Content questions:** Check with your team lead.
