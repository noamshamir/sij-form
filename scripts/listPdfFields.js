#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");

async function listFieldsForFile(filePath) {
    const bytes = fs.readFileSync(filePath);
    const pdf = await PDFDocument.load(bytes);
    const form = pdf.getForm();
    const fields = form.getFields().map((f) => f.getName());
    return fields;
}

async function main() {
    const templatesDir = path.resolve(
        __dirname,
        "..",
        "public",
        "updated_templates"
    );
    if (!fs.existsSync(templatesDir)) {
        console.error("Templates directory not found:", templatesDir);
        process.exit(1);
    }

    const files = fs
        .readdirSync(templatesDir)
        .filter((f) => f.toLowerCase().endsWith(".pdf"));
    if (!files.length) {
        console.error("No PDF files found in", templatesDir);
        process.exit(1);
    }

    for (const file of files) {
        const fullPath = path.join(templatesDir, file);
        try {
            const fields = await listFieldsForFile(fullPath);
            console.log("---", file, "---");
            if (!fields.length) console.log("(no form fields found)");
            else fields.forEach((f) => console.log(f));
            console.log("\n");
        } catch (e) {
            console.error("Failed to read", file, e.message || e);
        }
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
