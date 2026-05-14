import { buildCatalogPrintCss } from "./styles";
import type {
    CatalogPdfData,
    PrintableCatalogGroup,
    PrintableProduct,
} from "./types";

function chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
    return chunks;
}

function formatDate(iso: string): string {
    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    }).format(new Date(iso));
}

function formatPrice(value: number | null): string {
    if (value == null || value <= 0) return "Upon request";
    return `$${value.toFixed(2)}`;
}

function compact(value: string | number | null | undefined): string {
    if (value == null || value === "") return "—";
    return String(value);
}

function sectionedGroups(groups: PrintableCatalogGroup[]): Array<{
    label: string;
    groups: PrintableCatalogGroup[];
}> {
    const sections = new Map<string, PrintableCatalogGroup[]>();
    for (const group of groups) {
        const key = group.category || "Catalog";
        sections.set(key, [...(sections.get(key) ?? []), group]);
    }
    return [...sections.entries()].map(([label, sectionGroups]) => ({
        label,
        groups: sectionGroups,
    }));
}

function PageFooter({ label }: { label: string }) {
    return (
        <div className="page-footer">
            <span>{label}</span>
            <span className="page-number" />
        </div>
    );
}

function PrintImage({
    src,
    alt,
    className,
}: {
    src: string | null;
    alt: string;
    className?: string;
}) {
    if (!src) return <div className="image-placeholder">Photography pending</div>;
    return (
        <img
            src={src}
            alt={alt}
            className={className}
            loading="eager"
            decoding="sync"
            fetchPriority="high"
        />
    );
}

export function CatalogCover({ data }: { data: CatalogPdfData }) {
    return (
        <section className="print-page cover">
            {data.heroImageUrl ? (
                <div className="cover-media">
                    <PrintImage src={data.heroImageUrl} alt="" />
                </div>
            ) : null}
            <div className="cover-wash" />
            <div className="page-inner">
                <div className="brand-mark">Best Bottles</div>
                <div>
                    <p className="cover-kicker">Nemat International</p>
                    <h1 className="cover-title">{data.options.title}</h1>
                    <p className="cover-subtitle">{data.options.subtitle}</p>
                </div>
                <dl className="cover-metadata">
                    <div>
                        <dt>Edition</dt>
                        <dd>{formatDate(data.generatedAt)}</dd>
                    </div>
                    <div>
                        <dt>Products</dt>
                        <dd>{data.facets.totalProducts.toLocaleString("en-US")}</dd>
                    </div>
                    <div>
                        <dt>Format</dt>
                        <dd>{data.page.label}</dd>
                    </div>
                </dl>
            </div>
        </section>
    );
}

export function IndexPage({ data }: { data: CatalogPdfData }) {
    return (
        <section className="print-page">
            <div className="page-inner">
                <header className="page-heading">
                    <div>
                        <p className="section-kicker">Catalog Index</p>
                        <h2 className="page-title">Product Architecture</h2>
                    </div>
                    <p className="page-context">
                        {data.facets.totalGroups.toLocaleString("en-US")} groups /{" "}
                        {data.facets.totalProducts.toLocaleString("en-US")} SKUs
                    </p>
                </header>
                <div className="index-grid">
                    <IndexPanel title="Design Families" rows={data.facets.families} />
                    <div>
                        <IndexPanel title="Collections" rows={data.facets.collections} />
                        <div style={{ height: "0.28in" }} />
                        <IndexPanel title="Categories" rows={data.facets.categories} />
                    </div>
                </div>
            </div>
            <PageFooter label="Index" />
        </section>
    );
}

function IndexPanel({
    title,
    rows,
}: {
    title: string;
    rows: Array<{ label: string; count: number }>;
}) {
    return (
        <section className="index-panel">
            <h3>{title}</h3>
            <ul className="index-list">
                {rows.map((row) => (
                    <li className="index-row" key={`${title}-${row.label}`}>
                        <strong>{row.label}</strong>
                        <span>{row.count.toLocaleString("en-US")}</span>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export function DividerPage({
    title,
    summary,
}: {
    title: string;
    summary: string;
}) {
    return (
        <section className="print-page section-page">
            <div className="bleed-fill" />
            <div className="page-inner">
                <p className="section-kicker">Section</p>
                <h2 className="section-title">{title}</h2>
                <p className="section-summary">{summary}</p>
            </div>
            <PageFooter label={title} />
        </section>
    );
}

export function CollectionIntro({
    title,
    groups,
}: {
    title: string;
    groups: PrintableCatalogGroup[];
}) {
    const families = [...new Set(groups.map((group) => group.family).filter(Boolean))];
    return (
        <DividerPage
            title={title}
            summary={`${groups.length.toLocaleString("en-US")} product groups across ${families.length.toLocaleString("en-US")} design families.`}
        />
    );
}

export function ProductGrid({
    title,
    groups,
    data,
}: {
    title: string;
    groups: PrintableCatalogGroup[];
    data: CatalogPdfData;
}) {
    const itemsPerPage = data.page.gridColumns * data.page.gridRows;
    const pages = chunk(groups, itemsPerPage);

    return (
        <>
            {pages.map((pageGroups, index) => (
                <section className="print-page" key={`${title}-${index}`}>
                    <div className="page-inner">
                        <header className="page-heading">
                            <div>
                                <p className="section-kicker">{title}</p>
                                <h2 className="page-title">
                                    {index === 0 ? "Selection" : "Selection Continued"}
                                </h2>
                            </div>
                            <p className="page-context">
                                {pageGroups.length} of {groups.length} groups
                            </p>
                        </header>
                        <div className="product-grid">
                            {pageGroups.map((group) => (
                                <ProductCard
                                    key={group.id || group.slug}
                                    group={group}
                                    includePricing={data.options.includePricing}
                                />
                            ))}
                        </div>
                    </div>
                    <PageFooter label={title} />
                </section>
            ))}
        </>
    );
}

function ProductCard({
    group,
    includePricing,
}: {
    group: PrintableCatalogGroup;
    includePricing: boolean;
}) {
    return (
        <article className="product-card no-break">
            <div className="product-card-media">
                <PrintImage src={group.heroImageUrl} alt={group.displayName} />
            </div>
            <div className="product-card-body">
                <h3 className="product-name">{group.displayName}</h3>
                <div className="product-meta">
                    <span>
                        <b>Family</b> {compact(group.family)}
                    </span>
                    <span>
                        <b>Capacity</b> {compact(group.capacity)}
                    </span>
                    <span>
                        <b>Color</b> {compact(group.color)}
                    </span>
                    <span>
                        <b>Thread</b> {compact(group.neckThreadSize)}
                    </span>
                    <span>
                        <b>Variants</b> {group.variantCount}
                    </span>
                    <span>
                        <b>SKU</b> {compact(group.primaryGraceSku)}
                    </span>
                </div>
                {includePricing ? (
                    <div className="price-line">From {formatPrice(group.priceRangeMin)} / ea</div>
                ) : null}
            </div>
        </article>
    );
}

export function ProductPage({
    products,
    data,
}: {
    products: PrintableProduct[];
    data: CatalogPdfData;
}) {
    const pages = chunk(products, 2);
    return (
        <>
            {pages.map((pageProducts, index) => (
                <section className="print-page" key={`spec-page-${index}`}>
                    <div className="page-inner">
                        <header className="page-heading">
                            <div>
                                <p className="section-kicker">Technical Specification</p>
                                <h2 className="page-title">SKU Reference</h2>
                            </div>
                            <p className="page-context">
                                {pageProducts.length} product{pageProducts.length === 1 ? "" : "s"}
                            </p>
                        </header>
                        <div className="spec-page-grid">
                            {pageProducts.map((product) => (
                                <SpecProduct key={product.id || product.graceSku} product={product} data={data} />
                            ))}
                        </div>
                    </div>
                    <PageFooter label="Specifications" />
                </section>
            ))}
        </>
    );
}

function SpecProduct({ product, data }: { product: PrintableProduct; data: CatalogPdfData }) {
    return (
        <article className="spec-product no-break">
            <div className="spec-product-media">
                <PrintImage src={product.imageUrl} alt={product.itemName} />
            </div>
            <div className="spec-product-body">
                <p className="meta-label">{product.graceSku || product.websiteSku}</p>
                <h3>{product.itemName}</h3>
                <dl className="spec-matrix">
                    <SpecCell label="Category" value={product.category} />
                    <SpecCell label="Family" value={product.family} />
                    <SpecCell label="Capacity" value={product.capacity} />
                    <SpecCell label="Color" value={product.color} />
                    <SpecCell label="Thread" value={product.neckThreadSize} />
                    <SpecCell label="Applicator" value={product.applicator} />
                    <SpecCell label="Height" value={product.heightWithCap} />
                    <SpecCell label="Diameter" value={product.diameter} />
                    <SpecCell label="Case Qty" value={product.caseQuantity} />
                    {data.options.includePricing ? (
                        <SpecCell label="Price" value={formatPrice(product.price1pc)} />
                    ) : null}
                </dl>
            </div>
        </article>
    );
}

function SpecCell({ label, value }: { label: string; value: string | number | null | undefined }) {
    return (
        <div>
            <dt>{label}</dt>
            <dd>{compact(value)}</dd>
        </div>
    );
}

export function TechnicalSpecTable({
    products,
    data,
}: {
    products: PrintableProduct[];
    data: CatalogPdfData;
}) {
    const pages = chunk(products, data.page.specRowsPerPage);
    return (
        <>
            {pages.map((pageProducts, index) => (
                <section className="print-page" key={`line-sheet-${index}`}>
                    <div className="page-inner">
                        <header className="page-heading">
                            <div>
                                <p className="section-kicker">Line Sheet</p>
                                <h2 className="page-title">
                                    {index === 0 ? "Product Specifications" : "Product Specifications Continued"}
                                </h2>
                            </div>
                            <p className="page-context">
                                {products.length.toLocaleString("en-US")} SKUs
                            </p>
                        </header>
                        <div className="line-table-wrap">
                            <table className="line-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: "18%" }}>SKU</th>
                                        <th style={{ width: "28%" }}>Product</th>
                                        <th style={{ width: "13%" }}>Family</th>
                                        <th style={{ width: "11%" }}>Capacity</th>
                                        <th style={{ width: "11%" }}>Thread</th>
                                        <th style={{ width: "10%" }}>Case</th>
                                        {data.options.includePricing ? <th style={{ width: "9%" }}>Price</th> : null}
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageProducts.map((product) => (
                                        <tr key={product.id || product.graceSku}>
                                            <td>
                                                <strong>{product.graceSku || product.websiteSku}</strong>
                                            </td>
                                            <td>{product.itemName}</td>
                                            <td>{compact(product.family)}</td>
                                            <td>{compact(product.capacity)}</td>
                                            <td>{compact(product.neckThreadSize)}</td>
                                            <td>{compact(product.caseQuantity)}</td>
                                            {data.options.includePricing ? <td>{formatPrice(product.price1pc)}</td> : null}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <PageFooter label="Line Sheet" />
                </section>
            ))}
        </>
    );
}

export function ClosingPage({ data }: { data: CatalogPdfData }) {
    return (
        <section className="print-page closing-page">
            <div className="page-inner">
                <div className="brand-mark">Best Bottles</div>
                <div className="closing-rule" />
                <p className="cover-kicker">Catalog System</p>
                <h2 className="closing-title">Built for precise product conversations.</h2>
                <p className="closing-copy">
                    For custom pricing, regional availability, client-specific selections, or private
                    label packaging guidance, contact the Best Bottles sales team with the SKUs shown
                    in this catalog.
                </p>
            </div>
            <PageFooter label={data.options.title} />
        </section>
    );
}

function CatalogDocument({ data }: { data: CatalogPdfData }) {
    const sections = sectionedGroups(data.groups);
    const products = data.products;

    return (
        <main className="catalog-shell">
            <CatalogCover data={data} />
            {data.options.includeIndex ? <IndexPage data={data} /> : null}
            {data.options.mode === "line-sheet" ? (
                <TechnicalSpecTable products={products} data={data} />
            ) : data.options.mode === "spec-book" ? (
                <ProductPage products={products} data={data} />
            ) : (
                sections.map((section) => (
                    <div key={section.label}>
                        <DividerPage
                            title={section.label}
                            summary={`${section.groups.length.toLocaleString("en-US")} curated product groups with controlled page breaks, fixed image boxes, and print-safe technical metadata.`}
                        />
                        <ProductGrid title={section.label} groups={section.groups} data={data} />
                    </div>
                ))
            )}
            <ClosingPage data={data} />
        </main>
    );
}

export async function renderCatalogHtml(data: CatalogPdfData): Promise<string> {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const css = buildCatalogPrintCss(data.page);
    const markup = renderToStaticMarkup(<CatalogDocument data={data} />);

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${data.options.title}</title>
<style>${css}</style>
</head>
<body>${markup}</body>
</html>`;
}
