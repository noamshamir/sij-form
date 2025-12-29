#!/usr/bin/env node
import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

async function main(filePath) {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;

    // XFA forms expose a single “annotation storage” view; getFieldObjects is key.
    const fieldObjects = await pdf.getFieldObjects?.();
    if (!fieldObjects) {
        console.log(
            "No fieldObjects (may not be XFA or pdfjs couldn't extract)."
        );
        return;
    }

    // fieldObjects maps "name" -> array of widgets, each with type/rect/page/etc.
    for (const [name, widgets] of Object.entries(fieldObjects)) {
        for (const w of widgets) {
            // These properties vary; print what’s useful when present.
            const out = {
                name,
                page: w.pageIndex,
                type: w.type,
                rect: w.rect,
                // Some PDFs include alternatives:
                altText: w.alternativeText,
                tooltip: w.fieldTitle,
                // PDF.js sometimes exposes “text”/“value” for certain widgets:
                value: w.value,
            };
            console.log(JSON.stringify(out));
        }
    }
}

main(process.argv[2]).catch(console.error);
