import { existsSync } from "node:fs";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser, type PDFOptions } from "puppeteer-core";

const LOCAL_CHROME_PATHS = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
].filter(Boolean) as string[];

let pooledBrowser: Promise<Browser> | null = null;

function isServerlessRuntime(): boolean {
    return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_REGION);
}

async function resolveExecutablePath(): Promise<string> {
    if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
    if (isServerlessRuntime()) return chromium.executablePath(process.env.CHROMIUM_PACK_URL);

    const localPath = LOCAL_CHROME_PATHS.find((path) => existsSync(path));
    if (localPath) return localPath;

    throw new Error(
        "No local Chrome executable found. Set PUPPETEER_EXECUTABLE_PATH or run on Vercel with @sparticuz/chromium.",
    );
}

async function launchBrowser(): Promise<Browser> {
    const serverless = isServerlessRuntime();
    const executablePath = await resolveExecutablePath();
    const args = serverless
        ? puppeteer.defaultArgs({ args: chromium.args, headless: "shell" })
        : [
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--font-render-hinting=medium",
            "--no-first-run",
            "--no-sandbox",
        ];

    return puppeteer.launch({
        args,
        defaultViewport: {
            width: 1600,
            height: 2200,
            deviceScaleFactor: 2,
        },
        executablePath,
        headless: serverless ? "shell" : true,
        protocolTimeout: Number(process.env.PDF_PROTOCOL_TIMEOUT_MS ?? 180000),
    });
}

async function getBrowser(): Promise<Browser> {
    const shouldPool = process.env.PDF_BROWSER_POOL === "true" && !isServerlessRuntime();
    if (!shouldPool) return launchBrowser();
    pooledBrowser ??= launchBrowser();
    return pooledBrowser;
}

async function waitForPrintReadiness(page: Awaited<ReturnType<Browser["newPage"]>>): Promise<void> {
    await page.evaluate(async () => {
        const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T | undefined> => {
            let timeout: number | undefined;
            const fallback = new Promise<undefined>((resolve) => {
                timeout = window.setTimeout(() => resolve(undefined), ms);
            });
            const result = await Promise.race([promise, fallback]);
            if (timeout) window.clearTimeout(timeout);
            return result;
        };

        const images = Array.from(document.images);
        await withTimeout(
            Promise.all(
                images.map((image) => {
                    image.loading = "eager";
                    if (image.complete && image.naturalWidth > 0) return Promise.resolve();
                    return new Promise<void>((resolve) => {
                        const done = () => resolve();
                        image.addEventListener("load", done, { once: true });
                        image.addEventListener("error", done, { once: true });
                    });
                }),
            ).then(() => undefined),
            30000,
        );

        if ("fonts" in document) {
            await withTimeout(document.fonts.ready, 20000);
        }

        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => setTimeout(resolve, 180));
        document.documentElement.dataset.pdfReady = "true";
    });
}

export async function renderCatalogPdf(html: string): Promise<Buffer> {
    const browser = await getBrowser();
    const closeAfterRender = process.env.PDF_BROWSER_POOL !== "true" || isServerlessRuntime();
    const page = await browser.newPage();
    const timeout = Number(process.env.PDF_RENDER_TIMEOUT_MS ?? 120000);

    try {
        await page.setCacheEnabled(true);
        await page.emulateMediaType("print");
        await page.setContent(html, {
            waitUntil: ["domcontentloaded", "load"],
            timeout,
        });
        await waitForPrintReadiness(page);

        const pdfOptions: PDFOptions = {
            margin: { top: "0", right: "0", bottom: "0", left: "0" },
            preferCSSPageSize: true,
            printBackground: true,
            scale: 1,
            tagged: true,
            timeout,
        };

        const pdf = await page.pdf(pdfOptions);
        return Buffer.from(pdf);
    } finally {
        await page.close().catch(() => undefined);
        if (closeAfterRender) {
            await browser.close().catch(() => undefined);
            if (pooledBrowser) pooledBrowser = null;
        }
    }
}
