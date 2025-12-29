#!/usr/bin/env node
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import { createCanvas, loadImage } from "canvas";

function ensureDir(p) {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function parseJsonl(file) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
    const out = [];
    for (const line of lines) {
        if (!line.trim().startsWith("{")) continue; // skip [INFO] noise if present
        out.push(JSON.parse(line));
    }
    return out;
}

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

async function main(pdfPath, jsonlPath) {
    if (!pdfPath || !jsonlPath) {
        console.error(
            "Usage: node annotateFromJsonl.mjs path/to/form.pdf widgets.jsonl"
        );
        process.exit(1);
    }

    const widgets = parseJsonl(jsonlPath);
    console.log("[INFO] widgets loaded:", widgets.length);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-pages-"));
    const prefix = path.join(tmpDir, "page");
    const dpi = 144;
    const pxPerPt = dpi / 72;

    console.log("[INFO] rendering with pdftoppm...");
    execSync(`pdftoppm -png -r ${dpi} "${pdfPath}" "${prefix}"`, {
        stdio: "inherit",
    });

    const outDir = path.resolve(process.cwd(), "field-debug");
    ensureDir(outDir);

    // group by page
    const byPage = new Map();
    for (const w of widgets) {
        if (typeof w.page !== "number" || !Array.isArray(w.rect)) continue;
        if (!byPage.has(w.page)) byPage.set(w.page, []);
        byPage.get(w.page).push(w);
    }

    const maxPage = Math.max(...Array.from(byPage.keys()), 0);

    for (let pageIndex = 0; pageIndex <= maxPage; pageIndex++) {
        const pngPath = `${prefix}-${pageIndex + 1}.png`;
        if (!fs.existsSync(pngPath)) continue;

        const img = await loadImage(pngPath);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        const pageWidgets = byPage.get(pageIndex) || [];
        console.log(
            `[INFO] page ${pageIndex + 1}: widgets=${pageWidgets.length}`
        );

        // Very visible yellow
        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(255, 255, 0, 1.0)";
        ctx.fillStyle = "rgba(255, 255, 0, 0.25)";
        ctx.font = "16px sans-serif";

        for (const w of pageWidgets) {
            const [x1, y1, x2, y2] = w.rect; // points
            const x = x1 * pxPerPt;
            const y = (img.height / pxPerPt - y2) * pxPerPt; // flip y using page height in pts
            const ww = (x2 - x1) * pxPerPt;
            const hh = (y2 - y1) * pxPerPt;

            if (ww < 4 || hh < 4) continue;

            ctx.fillRect(x, y, ww, hh);
            ctx.strokeRect(x, y, ww, hh);

            const label = w.name || "";
            const lx = clamp(x, 0, img.width - 5);
            const ly = clamp(y - 4, 18, img.height - 5);

            ctx.fillStyle = "rgba(0,0,0,0.85)";
            ctx.fillText(label, lx, ly);
            ctx.fillStyle = "rgba(255, 255, 0, 0.25)";
        }

        const outPath = path.join(
            outDir,
            `page-${pageIndex + 1}-annotated.png`
        );
        fs.writeFileSync(outPath, canvas.toBuffer("image/png"));
        console.log("[INFO] wrote", outPath);
    }

    console.log("[DONE] output:", outDir);
}

main(process.argv[2], process.argv[3]).catch((e) => {
    console.error(e);
    process.exit(1);
});
