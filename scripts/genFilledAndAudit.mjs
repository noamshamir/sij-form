// Generate the full packet through the real app pipeline (processFormsForBoth)
// with EVERY website-form field populated, then audit every AcroForm field in
// each output PDF and record which are filled vs empty.
//
// Run via esbuild bundle (resolves extensionless imports used by src/backend):
//   npx esbuild scripts/genFilledAndAudit.mjs --bundle --platform=node \
//     --outfile=/tmp/genFilledAndAudit.cjs && node /tmp/genFilledAndAudit.cjs
import fs from "fs";
import path from "path";
import { processFormsForBoth } from "../src/backend/form_automator";
import {
    PDFDocument,
    PDFTextField,
    PDFCheckBox,
    PDFDropdown,
    PDFOptionList,
    PDFRadioGroup,
    PDFButton,
    PDFSignature,
    PDFName,
    PDFString,
    PDFHexString,
} from "pdf-lib";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "generated-filled");

// --- fetch shim: template URLs ("/templates/x.pdf") -> public/ files --------
globalThis.fetch = async (url) => {
    const rel = decodeURIComponent(String(url)).replace(/^\//, "");
    const p = path.join(ROOT, "public", rel);
    const buf = fs.readFileSync(p);
    return {
        arrayBuffer: async () =>
            buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    };
};

// --- The website form's fields, ALL filled (no blanks on any tab) ----------
// Mirrors FormFiller.tsx: 17 shared fields per tab + bbo/email/firm (attorney
// extras; blank() seeds them as "" on the other tabs and App.normalize() keeps
// all 20 keys for every person).
const plaintiffData = {
    first_name: "Maria",
    middle_name: "Jose",
    last_name: "Garcia",
    address: "123 Main St",
    apartment_number: "Apt 4B",
    city: "Boston",
    state: "MA",
    zip_code: "02118",
    county: "Suffolk",
    age: 15,
    birth_date: "2010-11-05",
    process_type: "SIJ",
    date_opened: "2025-09-12",
    nationality: "Guatemala",
    case_no: "25P1234EA",
    i765_receipt_date: "2025-10-01",
    phone_cell: "617-555-0142",
    bbo: "",
    email: "",
    firm: "",
};
const defendantData = {
    first_name: "Rosa",
    middle_name: "Elena",
    last_name: "Garcia",
    address: "45 Oak Ave",
    apartment_number: "Unit 2",
    city: "Chelsea",
    state: "MA",
    zip_code: "02150",
    county: "Suffolk",
    age: 42,
    birth_date: "1984-02-20",
    process_type: "SIJ",
    date_opened: "2025-09-12",
    nationality: "Guatemala",
    case_no: "25P1234EA",
    i765_receipt_date: "2025-10-01",
    phone_cell: "617-555-0177",
    bbo: "",
    email: "",
    firm: "",
};
const attorneyData = {
    first_name: "Sarah",
    middle_name: "Anne",
    last_name: "Goldberg",
    address: "100 Beacon St",
    apartment_number: "Suite 400",
    city: "Boston",
    state: "MA",
    zip_code: "02108",
    county: "Suffolk",
    age: 38,
    birth_date: "1988-06-10",
    process_type: "SIJ",
    date_opened: "2025-09-12",
    nationality: "United States",
    case_no: "25P1234EA",
    i765_receipt_date: "2025-10-01",
    phone_cell: "617-555-0199",
    bbo: "654321",
    email: "sarah.goldberg@legalaid.org",
    firm: "Goldberg Legal Services",
};

// --- Audit helpers -----------------------------------------------------------
const decodePdfText = (v) =>
    v instanceof PDFString || v instanceof PDFHexString
        ? v.decodeText()
        : undefined;

async function auditPdf(bytes) {
    const doc = await PDFDocument.load(bytes);
    const form = doc.getForm();
    const rows = [];
    for (const f of form.getFields()) {
        const name = f.getName();
        const label = decodePdfText(f.acroField.dict.lookup(PDFName.of("TU")));
        const readOnly = typeof f.isReadOnly === "function" ? f.isReadOnly() : false;
        let row = { name, label, readOnly };
        if (f instanceof PDFTextField) {
            const value = f.getText() ?? "";
            row = { ...row, type: "text", value, filled: value.trim() !== "" };
        } else if (f instanceof PDFCheckBox) {
            const checked = f.isChecked();
            row = { ...row, type: "checkbox", value: checked, filled: checked };
        } else if (f instanceof PDFDropdown) {
            const sel = f.getSelected();
            row = {
                ...row,
                type: "dropdown",
                value: sel.join(" | "),
                options: f.getOptions(),
                filled: sel.length > 0 && sel.some((s) => String(s).trim() !== ""),
            };
        } else if (f instanceof PDFOptionList) {
            const sel = f.getSelected();
            row = {
                ...row,
                type: "optionlist",
                value: sel.join(" | "),
                options: f.getOptions(),
                filled: sel.length > 0,
            };
        } else if (f instanceof PDFRadioGroup) {
            const sel = f.getSelected();
            row = {
                ...row,
                type: "radio",
                value: sel ?? "",
                options: f.getOptions(),
                filled: sel !== undefined && sel !== null,
            };
        } else if (f instanceof PDFSignature) {
            row = { ...row, type: "signature", value: "", filled: false };
        } else if (f instanceof PDFButton) {
            row = { ...row, type: "button", value: "", filled: null };
        } else {
            row = { ...row, type: f.constructor.name, value: "", filled: null };
        }
        rows.push(row);
    }
    return rows;
}

// --- Run ---------------------------------------------------------------------
async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const outputs = await processFormsForBoth(null, {
        plaintiffData,
        defendantData,
        attorneyData,
    });

    const report = [];
    for (const { name, blob } of outputs) {
        const bytes = Buffer.from(await blob.arrayBuffer());
        const safe = name.replace(/[/\\]/g, "_");
        fs.writeFileSync(path.join(OUT_DIR, safe), bytes);
        const fields = await auditPdf(bytes);
        report.push({ form: name, fieldCount: fields.length, fields });
        const empty = fields.filter((r) => r.filled === false);
        console.log(
            `${name}: ${fields.length} fields, ${empty.length} unfilled`
        );
    }
    fs.writeFileSync(
        path.join(OUT_DIR, "audit.json"),
        JSON.stringify(report, null, 2)
    );
    console.log(`\nWrote PDFs + audit.json to ${OUT_DIR}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
