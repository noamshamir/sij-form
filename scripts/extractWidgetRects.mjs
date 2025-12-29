#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { PDFDocument, PDFName, PDFArray, PDFDict, PDFString } from "pdf-lib";

function pdfString(v) {
    if (!v) return null;
    if (v instanceof PDFString) return v.decodeText();
    // Sometimes T is a PDFHexString; pdf-lib represents it as PDFString too.
    return v.toString?.() ?? null;
}

function getInheritableFieldName(annotDict) {
    // Walk up Parent chain until we find /T
    let cur = annotDict;
    for (let i = 0; i < 20 && cur; i++) {
        const t = cur.get(PDFName.of("T"));
        if (t) return pdfString(t);
        const parent = cur.get(PDFName.of("Parent"));
        if (!parent) break;
        cur = parent.lookup?.(PDFDict) ?? null;
    }
    return null;
}

function rectToNumbers(rectArr) {
    const vals = rectArr.asArray().map((obj) => {
        // pdf-lib objects often have .asNumber() or .value() or .toString()
        if (typeof obj?.asNumber === "function") return obj.asNumber();
        if (typeof obj?.numberValue === "function") return obj.numberValue();
        if (typeof obj?.value === "function") return obj.value();
        if (typeof obj === "number") return obj;

        // Fallback: parse from string like "123.45"
        const s = obj?.toString?.() ?? "";
        const num = Number(s);
        if (Number.isFinite(num)) return num;

        // Last resort
        throw new Error(`Could not parse rect number from: ${s}`);
    });

    if (vals.length !== 4) {
        throw new Error(
            `Rect did not have 4 numbers; got ${vals.length}: ${vals}`
        );
    }
    return vals;
}

async function main(filePath) {
    if (!filePath) {
        console.error("Usage: node extractWidgetRects.mjs path/to/form.pdf");
        process.exit(1);
    }

    const bytes = fs.readFileSync(filePath);
    const pdf = await PDFDocument.load(bytes);
    const pages = pdf.getPages();

    console.log("[INFO] pages:", pages.length);

    let total = 0;

    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const annots = page.node.get(PDFName.of("Annots"));
        if (!annots) continue;

        const annotsArr = page.node.context.lookup(annots, PDFArray);
        if (!annotsArr) continue;

        for (const ref of annotsArr.asArray()) {
            const annot = page.node.context.lookup(ref, PDFDict);
            if (!annot) continue;

            const subtype = annot.get(PDFName.of("Subtype"));
            if (!subtype || subtype.toString() !== "/Widget") continue;

            const rect = annot.get(PDFName.of("Rect"));
            if (!rect) continue;

            const rectArr = page.node.context.lookup(rect, PDFArray);
            if (!rectArr) continue;

            const name = getInheritableFieldName(annot);
            const rectNums = rectToNumbers(rectArr);

            // Some widgets have no /T directly (inheritable); still useful to output
            const out = {
                page: i, // 0-based
                name: name ?? "(no /T name found)",
                rect: rectNums,
            };

            console.log(JSON.stringify(out));
            total++;
        }
    }

    console.log("[INFO] total widget annots:", total);
}

main(process.argv[2]).catch((e) => {
    console.error(e);
    process.exit(1);
});
