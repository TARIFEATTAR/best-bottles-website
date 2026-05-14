import type { CatalogPageConfig } from "./types";

export function buildCatalogPrintCss(page: CatalogPageConfig): string {
    return `
@import url("https://fonts.googleapis.com/css2?family=Cormorant:wght@400;500;600;700&family=EB+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=block");

@page {
  size: ${page.width} ${page.height};
  margin: 0;
}

:root {
  --page-width: ${page.width};
  --page-height: ${page.height};
  --safe: ${page.safeMargin};
  --bleed: ${page.bleed};
  --grid-columns: ${page.gridColumns};
  --grid-rows: ${page.gridRows};
  --ink: #1d1d1f;
  --soft-ink: #4d5660;
  --slate: #637588;
  --bone: #f5f3ef;
  --linen: #fbfaf7;
  --paper: #fffdf9;
  --travertine: #eee6d4;
  --champagne: #d4c5a9;
  --gold: #a47f3d;
  --rule: #d8d0c2;
  --display-font: "Cormorant", "EB Garamond", Georgia, serif;
  --body-font: "Inter", ui-sans-serif, system-ui, sans-serif;
  --serif-font: "EB Garamond", Georgia, serif;
  --mono-font: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
}

* {
  box-sizing: border-box;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

html,
body {
  width: var(--page-width);
  min-height: var(--page-height);
  margin: 0;
  padding: 0;
  background: var(--bone);
  color: var(--ink);
  font-family: var(--body-font);
  font-size: 10pt;
}

body {
  counter-reset: catalog-page;
}

img {
  display: block;
  max-width: 100%;
  image-rendering: auto;
}

.catalog-shell {
  width: var(--page-width);
  background: var(--bone);
}

.print-page {
  position: relative;
  width: var(--page-width);
  height: var(--page-height);
  overflow: hidden;
  padding: var(--safe);
  background: var(--linen);
  break-after: page;
  page-break-after: always;
  counter-increment: catalog-page;
}

.print-page:last-child {
  break-after: auto;
  page-break-after: auto;
}

.page-inner {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.page-footer {
  position: absolute;
  left: var(--safe);
  right: var(--safe);
  bottom: calc(var(--safe) * 0.55);
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--soft-ink);
  font-size: 7pt;
  line-height: 1;
  font-family: var(--mono-font);
}

.page-number::after {
  content: counter(catalog-page, decimal-leading-zero);
}

.bleed-fill {
  position: absolute;
  inset: calc(var(--bleed) * -1);
  z-index: 0;
}

.cover {
  background: var(--ink);
  color: white;
  padding: calc(var(--safe) * 1.1);
}

.cover-media {
  position: absolute;
  inset: calc(var(--bleed) * -1);
  opacity: 0.46;
}

.cover-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-wash {
  position: absolute;
  inset: calc(var(--bleed) * -1);
  background:
    linear-gradient(90deg, rgba(29,29,31,0.96) 0%, rgba(29,29,31,0.78) 42%, rgba(29,29,31,0.28) 100%),
    linear-gradient(180deg, rgba(99,117,136,0.18), rgba(164,127,61,0.22));
  z-index: 1;
}

.cover .page-inner {
  justify-content: space-between;
}

.brand-mark {
  font-family: var(--display-font);
  font-size: 18pt;
  font-weight: 600;
  line-height: 1;
}

.cover-kicker,
.section-kicker,
.meta-label,
.table-label {
  margin: 0;
  color: var(--gold);
  font-family: var(--mono-font);
  font-size: 7pt;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0;
}

.cover-title {
  max-width: 72%;
  margin: 0;
  font-family: var(--display-font);
  font-size: 48pt;
  font-weight: 500;
  line-height: 0.92;
}

.cover-subtitle {
  max-width: 58%;
  margin: 0.24in 0 0;
  font-family: var(--serif-font);
  font-size: 15pt;
  line-height: 1.25;
  color: rgba(255,255,255,0.84);
}

.cover-metadata {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.18in;
  max-width: 78%;
}

.cover-metadata div {
  border-top: 1px solid rgba(255,255,255,0.24);
  padding-top: 0.08in;
}

.cover-metadata dt {
  margin: 0 0 0.04in;
  color: rgba(255,255,255,0.54);
  font-size: 7pt;
  font-family: var(--mono-font);
}

.cover-metadata dd {
  margin: 0;
  color: white;
  font-size: 10pt;
}

.page-heading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.2in;
  align-items: end;
  padding-bottom: 0.16in;
  border-bottom: 1px solid var(--rule);
}

.page-title {
  margin: 0.04in 0 0;
  font-family: var(--display-font);
  font-size: 23pt;
  font-weight: 500;
  line-height: 1;
}

.page-context {
  margin: 0;
  color: var(--soft-ink);
  font-size: 8pt;
  text-align: right;
}

.index-grid {
  display: grid;
  grid-template-columns: 1.12fr 0.88fr;
  gap: 0.32in;
  padding-top: 0.34in;
  min-height: 0;
}

.index-panel {
  border-top: 1px solid var(--ink);
  padding-top: 0.16in;
}

.index-panel h3 {
  margin: 0 0 0.14in;
  font-family: var(--serif-font);
  font-size: 16pt;
  font-weight: 500;
}

.index-list {
  display: grid;
  gap: 0.055in;
  margin: 0;
  padding: 0;
  list-style: none;
}

.index-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.1in;
  align-items: baseline;
  font-size: 8.5pt;
  color: var(--soft-ink);
}

.index-row strong {
  min-width: 0;
  color: var(--ink);
  font-weight: 500;
}

.section-page {
  background: var(--ink);
  color: white;
}

.section-page .bleed-fill {
  background:
    linear-gradient(135deg, rgba(99,117,136,0.28), transparent 42%),
    linear-gradient(45deg, rgba(164,127,61,0.22), transparent 55%),
    var(--ink);
}

.section-title {
  max-width: 72%;
  margin: auto 0 0;
  font-family: var(--display-font);
  font-size: 40pt;
  font-weight: 500;
  line-height: 0.95;
}

.section-summary {
  max-width: 50%;
  margin: 0.18in 0 0;
  color: rgba(255,255,255,0.72);
  font-family: var(--serif-font);
  font-size: 13pt;
  line-height: 1.24;
}

.product-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(var(--grid-columns), minmax(0, 1fr));
  grid-template-rows: repeat(var(--grid-rows), minmax(0, 1fr));
  gap: 0.145in;
  min-height: 0;
  padding-top: 0.18in;
  padding-bottom: 0.24in;
}

.product-card {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--paper);
  border: 1px solid var(--rule);
  break-inside: avoid;
  page-break-inside: avoid;
}

.product-card-media {
  position: relative;
  flex: 1 1 auto;
  min-height: 0.9in;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.68), rgba(238,230,212,0.44)),
    var(--travertine);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.1in;
}

.product-card-media img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.image-placeholder {
  color: rgba(29,29,31,0.42);
  font-family: var(--serif-font);
  font-size: 12pt;
}

.product-card-body {
  flex: 0 0 auto;
  padding: 0.13in 0.14in 0.14in;
  border-top: 1px solid rgba(216,208,194,0.72);
}

.product-name {
  min-height: 0.36in;
  margin: 0;
  font-family: var(--serif-font);
  font-size: 12pt;
  font-weight: 500;
  line-height: 1.05;
}

.product-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.04in 0.08in;
  margin-top: 0.1in;
  color: var(--soft-ink);
  font-size: 7.2pt;
  line-height: 1.2;
}

.product-meta span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.price-line {
  margin-top: 0.09in;
  color: var(--ink);
  font-size: 8.2pt;
  font-weight: 600;
}

.spec-page-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.2in;
  padding-top: 0.22in;
  padding-bottom: 0.26in;
  min-height: 0;
}

.spec-product {
  display: grid;
  grid-template-rows: 1.35fr auto;
  min-height: 0;
  overflow: hidden;
  border-top: 1px solid var(--ink);
  break-inside: avoid;
}

.spec-product-media {
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--travertine);
  padding: 0.16in;
}

.spec-product-media img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.spec-product-body {
  padding-top: 0.14in;
}

.spec-product h3 {
  margin: 0;
  font-family: var(--serif-font);
  font-size: 16pt;
  font-weight: 500;
  line-height: 1.02;
}

.spec-matrix {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.055in 0.12in;
  margin-top: 0.12in;
}

.spec-matrix div {
  border-top: 1px solid var(--rule);
  padding-top: 0.05in;
}

.spec-matrix dt {
  margin: 0;
  color: var(--soft-ink);
  font-family: var(--mono-font);
  font-size: 6.8pt;
}

.spec-matrix dd {
  margin: 0.03in 0 0;
  font-size: 8.2pt;
  line-height: 1.2;
}

.line-table-wrap {
  flex: 1;
  min-height: 0;
  padding-top: 0.18in;
  padding-bottom: 0.24in;
}

.line-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 7.2pt;
}

.line-table thead {
  display: table-header-group;
}

.line-table tr {
  break-inside: avoid;
  page-break-inside: avoid;
}

.line-table th {
  padding: 0.055in 0.04in;
  border-top: 1px solid var(--ink);
  border-bottom: 1px solid var(--ink);
  color: var(--ink);
  font-family: var(--mono-font);
  font-size: 6.8pt;
  text-align: left;
  font-weight: 600;
}

.line-table td {
  padding: 0.055in 0.04in;
  border-bottom: 1px solid var(--rule);
  vertical-align: top;
  color: var(--soft-ink);
  line-height: 1.22;
  overflow-wrap: anywhere;
}

.line-table td strong {
  color: var(--ink);
  font-weight: 500;
}

.closing-page {
  background: var(--paper);
}

.closing-rule {
  height: 1px;
  background: var(--ink);
  width: 100%;
  margin: auto 0 0.28in;
}

.closing-title {
  margin: 0;
  font-family: var(--display-font);
  font-size: 34pt;
  font-weight: 500;
  line-height: 1;
}

.closing-copy {
  max-width: 56%;
  margin: 0.18in 0 0;
  color: var(--soft-ink);
  font-family: var(--serif-font);
  font-size: 13pt;
  line-height: 1.25;
}

.no-break {
  break-inside: avoid;
  page-break-inside: avoid;
}

@media screen {
  body {
    margin: 24px auto;
  }

  .print-page {
    margin: 0 auto 24px;
    box-shadow: 0 18px 60px rgba(29,29,31,0.18);
  }
}

@media print {
  html,
  body,
  .catalog-shell {
    width: var(--page-width);
    margin: 0;
  }
}
`;
}
