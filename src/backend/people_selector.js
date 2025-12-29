// src/backend/people_selector.js

import { combineExcelFiles } from "./main";
import { processPersonData, getDicts } from "./form_automator";

/**
 * Merge the uploaded Excel File[] array, parse all rows starting
 * at header row 6 (zero-based index 5), locate the matching record
 * by full name, and return the camelCase person object.
 *
 * @param {string} fullName    e.g. "Jane Q. Doe"
 * @param {File[]} excelFiles
 * @returns {Promise<Object|null>}  the same shape that processPersonData returns
 */
export async function loadPersonData(fullName, excelFiles) {
    if (!fullName || !excelFiles?.length) {
        return null;
    }

    console.log(
        `people_selector.loadPersonData: looking up '${fullName}' in ${excelFiles.length} excel file(s)`
    );

    // 1) combine all Excel files into one workbook File
    const combinedFile = await combineExcelFiles(excelFiles);

    // 2) use getDicts to parse the combined file with auto-detected header row
    const rows = await getDicts(combinedFile);

    console.log(
        `people_selector.loadPersonData: parsed ${rows.length} rows from combined sheet; sample:`,
        rows && rows.length ? rows[0] : null
    );

    // 4) build a lowercase target to match
    const target = fullName.toLowerCase().trim();

    // 5) find the matching row by concatenating first/middle/last
    const row = rows.find((r) => {
        // Prefer separate columns, but fall back to a single `Beneficiary Name` column
        let parts = [
            r["Beneficiary First Name"] || "",
            r["Beneficiary Middle Name"] || "",
            r["Beneficiary Last Name"] || "",
        ]
            .filter(Boolean)
            .join(" ");
        if (!parts) {
            parts = r["Beneficiary Name"] || r["Beneficiary"] || "";
        }
        // Normalize whitespace and compare
        const normalized = parts.toLowerCase().replace(/\s+/g, " ").trim();
        // console log each candidate normalized (but avoid spamming too much)
        // Only log the candidate when it matches target or when small set
        if (normalized === target) {
            console.log(
                `people_selector.loadPersonData: matched row normalized='${normalized}' target='${target}'`,
                r
            );
        }
        return normalized === target;
    });

    if (!row) {
        console.log(
            `people_selector.loadPersonData: no matching row found for '${fullName}' (target='${target}').`,
            // show first 6 normalized candidates for inspection
            rows.slice(0, 6).map((r) => {
                let parts = [
                    r["Beneficiary First Name"] || "",
                    r["Beneficiary Middle Name"] || "",
                    r["Beneficiary Last Name"] || "",
                ]
                    .filter(Boolean)
                    .join(" ");
                if (!parts)
                    parts = r["Beneficiary Name"] || r["Beneficiary"] || "";
                return (parts || "").toLowerCase().replace(/\s+/g, " ").trim();
            })
        );
        return null;
    }

    // 6) map that row into the camelCase person object
    const person = processPersonData(row, /* index */ 0);
    console.log("people_selector.loadPersonData: processed person:", person);
    return person;
}
