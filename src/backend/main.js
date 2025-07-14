// formApi.js
import * as XLSX from "xlsx";
import { processFormsForBoth, getNamesFromExcel } from "./form_automator";

/**
 * Combine multiple Excel File objects into one combined.xlsx File.
 * @param {File[]} fileList Array of uploaded Excel File objects.
 * @returns {Promise<File>} A new File named "combined.xlsx".
 */
export async function combineExcelFiles(fileList) {
    const allRows = [];

    for (const file of fileList) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        allRows.push(...rows);
    }

    const newWb = XLSX.utils.book_new();
    const newSheet = XLSX.utils.aoa_to_sheet(allRows);
    XLSX.utils.book_append_sheet(newWb, newSheet, "Combined");

    const outBuffer = XLSX.write(newWb, {
        bookType: "xlsx",
        type: "array",
    });
    const blob = new Blob([outBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    return new File([blob], "combined.xlsx", { type: blob.type });
}

/**
 * Process Excel files to fill forms, returns generated PDFs/Files.
 * @param {File[]} files Uploaded Excel File objects.
 * @param {string} plaintiffName
 * @param {string} defendantName
 * @param {string} attorneyName
 * @returns {Promise<Array<{ name: string, blob: Blob }>>}
 */
export async function processExcelFiles(
    files,
    plaintiffName,
    defendantName,
    attorneyName
) {
    // Step 1: Combine inputs
    const combinedFile = await combineExcelFiles(files);

    // Step 2: Delegate to formAutomator.js logic
    // processFormsForBoth should return an array of { name: string, blob: Blob }
    const outputs = await processFormsForBoth(combinedFile, {
        plaintiffName,
        defendantName,
        attorneyName,
    });

    // Step 3: Prefix filenames with plaintiff directory
    return outputs.map((f) => ({
        name: `${plaintiffName}/${f.name}`,
        blob: f.blob,
    }));
}

/**
 * Extract names from Excel files.
 * @param {File[]} files Uploaded Excel File objects.
 * @returns {Promise<string[]>}
 */
export async function getNames(files) {
    const combinedFile = await combineExcelFiles(files);
    const names = await getNamesFromExcel(combinedFile);
    return names;
}

/**
 * Read header row (row 6) from combined Excel.
 * @param {File[]} files
 * @returns {Promise<string[]>}
 */
export async function getHeaders(files) {
    const combinedFile = await combineExcelFiles(files);
    const buffer = await combinedFile.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    // Read with header row at index 5 (zero-based)
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 5 });
    const headerRow = rows[0] || [];
    return headerRow;
}

/**
 * Trigger an in-browser download for a given Blob.
 * @param {Blob} blob The data to download.
 * @param {string} filename Desired filename (including path).
 */
export function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/**
 * Simple test stub for frontend.
 * @returns {{ message: string }}
 */
export function testEndpoint() {
    return { message: "Frontend module is working" };
}
