// src/backend/people_selector.js

import * as XLSX from "xlsx";
import { combineExcelFiles } from "./main";
import { processPersonData } from "./form_automator";

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

  // 1) combine all Excel files into one workbook File
  const combinedFile = await combineExcelFiles(excelFiles);

  // 2) read its bytes, load into XLSX
  const buffer = await combinedFile.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];

  // 3) convert to JSON, starting at row 6 (zero‐based range:5)
  const rows = XLSX.utils.sheet_to_json(sheet, { range: 5 });

  // 4) build a lowercase target to match
  const target = fullName.toLowerCase().trim();

  // 5) find the matching row by concatenating first/middle/last
  const row = rows.find((r) => {
    const parts = [
      r["Beneficiary First Name"] || "",
      r["Beneficiary Middle Name"] || "",
      r["Beneficiary Last Name"] || "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .trim();
    return parts === target;
  });

  if (!row) {
    return null;
  }

  // 6) map that row into the camelCase person object
  return processPersonData(row, /* index */ 0);
}