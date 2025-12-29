import * as XLSX from "xlsx";
import { combineExcelFiles } from "./main";
import { PDFDocument } from "pdf-lib";

const TEMPLATE_URLS = {
    // Templates are hosted under the public folder at /updated_templates
    // cjd109: "/updated_templates/cjd109.pdf",
    // jud_affidavit: "/updated_templates/jud-affidavit-of-indigency-821.pdf",
    jud_pfc_cjp35:
        "/updated_templates/cjp35-complaint-for-dependency-c119-s39m.pdf",
    // jud_pfc_cjp37:
    //     "/updated_templates/jud-pfc-cjp37-judgment-of-dependency-c119-s39m.pdf",
    // notice_of_appearance:
    //     "/updated_templates/Notice of Appearance Form - 2023.pdf",
};

export async function getDicts(file) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const headerCandidates = [
        "Beneficiary First Name",
        "Beneficiary Last Name",
        "Beneficiary Middle Name",
        "Beneficiary Name",
        "Beneficiary",
    ];

    const headerRowIndex = allRows.findIndex(
        (row) =>
            row &&
            row.some &&
            row.some((cell) => {
                if (typeof cell !== "string") return false;
                const lower = cell.toLowerCase();
                return headerCandidates.some((h) =>
                    lower.includes(h.toLowerCase())
                );
            })
    );

    let data;
    if (headerRowIndex >= 0) {
        try {
            console.log(
                `form_automator.getDicts: detected headerRowIndex=${headerRowIndex} for file='${
                    file.name || "<combined>"
                }'`
            );
            if (allRows && allRows.length) {
                console.log(
                    "form_automator.getDicts: sample rows:",
                    allRows.slice(
                        Math.max(0, headerRowIndex - 1),
                        headerRowIndex + 3
                    )
                );
            }
        } catch (e) {}
        data = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });
    } else {
        try {
            console.warn(
                `form_automator.getDicts: failed to detect header row, falling back to range:5 for file='${
                    file.name || "<combined>"
                }'`
            );
            if (allRows && allRows.length)
                console.log(
                    "form_automator.getDicts: fallback sample rows:",
                    allRows.slice(0, 4)
                );
        } catch (e) {}
        data = XLSX.utils.sheet_to_json(sheet, { range: 5 });
    }

    console.log(
        `form_automator.getDicts: parsed ${data.length} rows for file='${
            file.name || "<combined>"
        }'`
    );
    return data;
}

/**
 * Extract beneficiary full names from Excel.
 * @param {File} file
 * @returns {Promise<string[]>}
 */
export async function getNamesFromExcel(file) {
    const rows = await getDicts(file);
    console.log(
        `form_automator.getNamesFromExcel: got ${rows.length} rows from file='${
            file.name || "<combined>"
        }'`
    );
    if (rows.length)
        console.log("form_automator.getNamesFromExcel: sample row:", rows[0]);

    return rows.map((r) => {
        const first = r["Beneficiary First Name"];
        const middle = r["Beneficiary Middle Name"];
        const last = r["Beneficiary Last Name"];
        if (first || last || middle)
            return [first, middle, last].filter(Boolean).join(" ");
        const single = r["Beneficiary Name"] || r["Beneficiary"] || "";
        return typeof single === "string" ? single : String(single);
    });
}

/**
 * Safe field extractor.
 */
function getField(column, row, returnNA = false, shouldBeNum = false) {
    const value = row[column];
    if (shouldBeNum) {
        if (typeof value !== "number" || isNaN(value))
            return returnNA ? "N/A" : "";
    } else {
        if (typeof value !== "string") return returnNA ? "N/A" : "";
    }
    return value;
}

/**
 * Process a single row into a person info object.
 */
export function processPersonData(row, index) {
    let first_name = getField("Beneficiary First Name", row);
    let last_name = getField("Beneficiary Last Name", row);
    let middle_name = getField("Beneficiary Middle Name", row);

    if (!first_name && !last_name) {
        const full = getField("Beneficiary Name", row) || "";
        if (full) {
            const parts = full.trim().split(/\s+/);
            if (parts.length === 1) {
                first_name = parts[0];
                last_name = "";
            } else if (parts.length === 2) {
                first_name = parts[0];
                middle_name = "";
                last_name = parts[1];
            } else if (parts.length > 2) {
                first_name = parts[0];
                last_name = parts[parts.length - 1];
                middle_name = parts.slice(1, parts.length - 1).join(" ");
            }
        }
    }

    if (!first_name || !last_name) {
        console.error(
            `processPersonData: Row ${index}: missing names — row=`,
            row
        );
        return null;
    }

    const middle_initial = middle_name ? middle_name[0] : "";
    const full_name = [first_name, middle_name, last_name]
        .filter(Boolean)
        .join(" ");
    const address = getField("Address-Current Line 1", row);
    const address_line_two = getField("Address-Current Line 2", row, true);
    const apartment_number = address_line_two || "";
    const city = getField("Address-Current City", row);
    const state = getField("Address-Current State", row);
    let zip_code = "";
    const rawZip = row["Address-Current Zip"];
    if (typeof rawZip === "number") zip_code = String(rawZip).padStart(5, "0");

    return {
        first_name,
        last_name,
        middle_name,
        middle_initial,
        full_name,
        address,
        apartment_number,
        city,
        state,
        zip_code,
        state_and_zip: `${state} ${zip_code}`,
        age: getField("Age", row, false, true),
        birth_date: getField("Birth Date", row),
        process_type: getField("Process Type", row),
        date_opened: getField("Date Opened", row),
        nationality: getField("Nationality", row),
        case_no: getField("Case No", row),
        i765_receipt_date: getField("I-765 Receipt Date", row),
        phone_cell: getField("Phone-Cell", row),
        county: getField("Address-Current County", row),
    };
}

/**
 * Build the mapping of PDF form field names to values.
 */
export function getFormFields(plaintiff, defendant, attorney) {
    return {
        // cjd109: {
        //     "form1[0].BodyPage1[0].Subform6[0].TextField4[4]":
        //         plaintiff["first_name"],
        //     "form1[0].BodyPage1[0].Subform6[0].TextField4[5]":
        //         plaintiff["last_name"],
        //     "form1[0].BodyPage1[0].Subform6[0].TextField4[1]":
        //         defendant["first_name"],
        //     "form1[0].BodyPage1[0].Subform6[0].TextField4[2]":
        //         defendant["last_name"],
        //     "form1[0].BodyPage1[0].Subform6[0].TextField4[3]":
        //         defendant["middle_initial"],
        //     "form1[0].BodyPage1[0].Subform6[0].TextField4[6]":
        //         defendant["middle_initial"],

        //     "form1[0].BodyPage1[0].S1[0].t1[0]": plaintiff["address"],
        //     "form1[0].BodyPage1[0].S1[0].TextField4[1]":
        //         plaintiff["apartment_number"],
        //     "form1[0].BodyPage1[0].S1[0].t2[0]": plaintiff["city"],
        //     "form1[0].BodyPage1[0].S1[0].TextField4[0]": plaintiff["state"],
        //     "form1[0].BodyPage1[0].S1[0].TextField5[0]": plaintiff["zip_code"],

        //     "form1[0].BodyPage1[0].S2[0].TextField4[2]":
        //         plaintiff["first_name"],
        //     "form1[0].BodyPage1[0].S2[0].TextField4[1]":
        //         plaintiff["middle_initial"],
        //     "form1[0].BodyPage1[0].S2[0].TextField4[0]": plaintiff["last_name"],
        //     "form1[0].BodyPage1[0].S2[0].TextField5[1]": plaintiff["age"],
        //     "form1[0].BodyPage1[0].S2[0].TextField5[2]":
        //         plaintiff["birth_date"],
        //     "form1[0].BodyPage1[0].S2[0].TextField4[6]": plaintiff["address"],
        //     "form1[0].BodyPage1[0].S2[0].TextField4[5]":
        //         plaintiff["apartment_number"],
        //     "form1[0].BodyPage1[0].S2[0].TextField4[4]": plaintiff["city"],
        //     "form1[0].BodyPage1[0].S2[0].TextField4[3]": plaintiff["state"],
        //     "form1[0].BodyPage1[0].S2[0].TextField5[0]": plaintiff["zip_code"],

        //     "form1[0].BodyPage1[0].S3[0].t1[0]": defendant["address"],
        //     "form1[0].BodyPage1[0].S3[0].TextField4[0]":
        //         defendant["apartment_number"],
        //     "form1[0].BodyPage1[0].S3[0].t2[0]": defendant["city"],
        //     "form1[0].BodyPage1[0].S3[0].TextField4[1]": defendant["state"],
        //     "form1[0].BodyPage1[0].S3[0].TextField5[0]": defendant["zip_code"],

        //     "form1[0].BodyPage1[0].S8[0].TextField5[0]": attorney["full_name"],
        //     "form1[0].BodyPage1[0].S8[0].TextField5[4]": attorney["address"],
        //     "form1[0].BodyPage1[0].S8[0].TextField4[0]":
        //         attorney["apartment_number"],
        //     "form1[0].BodyPage1[0].S8[0].TextField5[3]": attorney["city"],
        //     "form1[0].BodyPage1[0].S8[0].TextField5[2]": attorney["state"],
        //     "form1[0].BodyPage1[0].S8[0].TextField5[1]": attorney["zip_code"],
        // },

        // jud_affidavit: {
        //     "Name of applicant": plaintiff.full_name,
        //     "Street and number": plaintiff.address,
        //     "City or town": plaintiff.city,
        //     "State and Zip": plaintiff.state_and_zip,
        //     "Attorney Name": attorney.full_name,
        //     "Attorney Address": attorney.address,
        //     "Attorney City": attorney.city,
        //     "Attorney State and Zip": attorney.state_and_zip,
        // },

        jud_pfc_cjp35: {
            // Docket No. (header repeats on pages 2–4 and also appears in the body header)
            "form1[0].#pageSet[0].Page2[0].docketno[0]": plaintiff["case_no"],
            "form1[0].#pageSet[0].Page2[1].docketno[0]": plaintiff["case_no"],
            "form1[0].#pageSet[0].Page2[2].docketno[0]": plaintiff["case_no"],
            "form1[0].BodyPage1[0].S1[0].docketno[0]": plaintiff["case_no"],

            // Caption block (Page 1): Plaintiff (child) name
            // Left = First, middle small = MI, right = Last
            "form1[0].BodyPage1[0].S1[0].TextField4[1]":
                plaintiff["first_name"], // Plaintiff First
            "form1[0].BodyPage1[0].S1[0].TextField4[2]":
                plaintiff["middle_initial"], // Plaintiff MI
            "form1[0].BodyPage1[0].S1[0].TextField4[0]": plaintiff["last_name"], // Plaintiff Last

            // Caption block (Page 1): Defendant “Parent One” name (maps to your `defendant`)
            "form1[0].BodyPage1[0].S1[0].TextField4[5]":
                defendant["first_name"], // Parent One First
            "form1[0].BodyPage1[0].S1[0].TextField4[4]":
                defendant["middle_initial"], // Parent One MI
            "form1[0].BodyPage1[0].S1[0].TextField4[3]": defendant["last_name"], // Parent One Last

            // Defendant “Parent Two” (S1 TextField4[6..8]) = if applicable -> leave blank

            // 1. Plaintiff (child) address line (Address / Apt / City / State / Zip)
            "form1[0].BodyPage1[0].S2[0].TextField4[3]": plaintiff["address"], // Address
            "form1[0].BodyPage1[0].S2[0].TextField4[2]":
                plaintiff["apartment_number"], // Apt/Unit
            "form1[0].BodyPage1[0].S2[0].TextField4[1]": plaintiff["city"], // City/Town
            "form1[0].BodyPage1[0].S2[0].TextField4[0]": plaintiff["state"], // State
            "form1[0].BodyPage1[0].S2[0].TextField5[0]": plaintiff["zip_code"], // Zip

            // 2. Child who is the subject (name + address)
            "form1[0].BodyPage1[0].S3[0].TextField4[1]":
                plaintiff["first_name"], // Child First
            "form1[0].BodyPage1[0].S3[0].TextField4[2]":
                plaintiff["middle_initial"], // Child MI
            "form1[0].BodyPage1[0].S3[0].TextField4[0]": plaintiff["last_name"], // Child Last

            "form1[0].BodyPage1[0].S3[0].TextField4[3]": plaintiff["address"], // Child Address
            "form1[0].BodyPage1[0].S3[0].TextField4[6]":
                plaintiff["apartment_number"], // Child Apt/Unit
            "form1[0].BodyPage1[0].S3[0].TextField4[4]": plaintiff["city"], // Child City/Town
            "form1[0].BodyPage1[0].S3[0].TextField4[5]": plaintiff["state"], // Child State
            "form1[0].BodyPage1[0].S3[0].TextField5[0]": plaintiff["zip_code"], // Child Zip

            // Child DOB
            "form1[0].BodyPage1[0].S3[0].DateField1[0]":
                plaintiff["birth_date"],

            // 3. Parent One (defendant) name + address
            "form1[0].BodyPage1[0].S4[0].TextField4[0]":
                defendant["first_name"], // Parent One First
            "form1[0].BodyPage1[0].S4[0].TextField4[1]":
                defendant["middle_initial"], // Parent One MI
            "form1[0].BodyPage1[0].S4[0].TextField4[6]": defendant["last_name"], // Parent One Last

            "form1[0].BodyPage1[0].S4[0].TextField4[2]": defendant["address"], // Parent One Address
            "form1[0].BodyPage1[0].S4[0].TextField4[5]":
                defendant["apartment_number"], // Parent One Apt/Unit
            "form1[0].BodyPage1[0].S4[0].TextField4[3]": defendant["city"], // Parent One City/Town
            "form1[0].BodyPage1[0].S4[0].TextField4[4]": defendant["state"], // Parent One State
            "form1[0].BodyPage1[0].S4[0].TextField5[0]": defendant["zip_code"], // Parent One Zip

            // 7. Child’s best interest not to return to ______ (Country)
            // If you consider nationality as the “country” field, this is the cleanest available input.
            "form1[0].BodyPage1[0].S8[0].TextField4[0]":
                plaintiff["nationality"],

            // Signature block (Page 4): Attorney info
            // Date: leave blank unless you have a date value you want to insert
            // "form1[0].BodyPage1[0].S12[0].DateField2[0]": "",

            "form1[0].BodyPage1[0].S12[0].TextField5[0]": attorney["full_name"], // Print name
            "form1[0].BodyPage1[0].S12[0].TextField5[4]": attorney["address"], // Address
            "form1[0].BodyPage1[0].S12[0].TextField4[0]":
                attorney["apartment_number"], // Apt/Unit
            "form1[0].BodyPage1[0].S12[0].TextField5[3]": attorney["city"], // City/Town
            "form1[0].BodyPage1[0].S12[0].TextField5[2]": attorney["state"], // State
            "form1[0].BodyPage1[0].S12[0].TextField5[1]": attorney["zip_code"], // Zip

            // Optional if present in your attorneyData (otherwise these will just fill blank)
            "form1[0].BodyPage1[0].S12[0].TextField7[0]":
                attorney["phone_cell"], // Primary Phone #
            // BBO # and Email aren't in your current schema; leave unmapped unless you add them
            // "form1[0].BodyPage1[0].S12[0].TextField6[0]": attorney["bbo_no"],
            // "form1[0].BodyPage1[0].S12[0].TextField6[1]": attorney["email"],
        },

        // jud_pfc_cjp37: {
        //     "form1[0].BodyPage1[0].S1[0].TextField4[1]":
        //         plaintiff["first_name"],
        //     "form1[0].BodyPage1[0].S1[0].TextField4[3]": plaintiff["last_name"],
        //     "form1[0].BodyPage1[0].S1[0].TextField4[4]":
        //         defendant["first_name"],
        //     "form1[0].BodyPage1[0].S1[0].TextField4[6]": defendant["last_name"],
        //     "form1[0].BodyPage1[0].S1[0].TextField4[5]":
        //         defendant["middle_initial"],
        //     "form1[0].BodyPage1[0].S1[0].TextField4[7]": defendant["address"],
        //     "form1[0].BodyPage1[0].S1[0].TextField4[8]": defendant["city"],
        //     "form1[0].BodyPage1[0].S1[0].TextField4[9]": defendant["state"],
        //     "form1[0].BodyPage1[0].S1[0].TextField5[1]": defendant["zip_code"],
        //     "form1[0].BodyPage1[0].S1[0].TextField4[10]": attorney["full_name"],
        // },

        // notice_of_appearance: {
        //     "form1[0].BodyPage1[0].CaseNameSub[0].PlffField[0]":
        //         plaintiff.full_name,
        //     "form1[0].BodyPage1[0].CaseNameSub[0].DfdtField[0]": `${defendant.first_name} ${defendant.last_name}`,
        //     "form1[0].BodyPage1[0].AttyField[0]": attorney.full_name,
        //     "form1[0].BodyPage1[0].AttyAddrField[0]": attorney.address,
        //     "form1[0].BodyPage1[0].AttyCityField[0]": `${attorney.city}, ${attorney.state} ${attorney.zip_code}`,
        // },
    };
}

/**
 * Fill a template PDF for a set of fields, return a Blob.
 */
async function fillPdf(templateUrl, fields) {
    const encodedUrl = encodeURI(templateUrl);
    const res = await fetch(encodedUrl);
    if (!res.ok) {
        const txt = await res.text().catch(() => "<no-body>");
        throw new Error(
            `Failed to fetch template ${templateUrl}: ${res.status} ${
                res.statusText
            } — ${txt.slice(0, 200)}`
        );
    }
    const contentType = res.headers.get("content-type") || "";
    if (
        !contentType.includes("pdf") &&
        !contentType.includes("application/octet-stream")
    ) {
        const txt = await res.text().catch(() => "<no-body>");
        throw new Error(
            `Expected PDF for ${templateUrl} but got '${contentType}': ${txt.slice(
                0,
                200
            )}`
        );
    }
    const arrayBuffer = await res.arrayBuffer();
    let pdfDoc;
    try {
        pdfDoc = await PDFDocument.load(arrayBuffer);
    } catch (e) {
        throw new Error(
            `Failed to parse PDF from ${templateUrl}: ${e.message}`
        );
    }
    const form = pdfDoc.getForm();
    Object.entries(fields).forEach(([key, value]) => {
        try {
            const field = form.getTextField(key);
            field.setText(String(value));
        } catch (e) {
            console.warn(`Field ${key} not found:`, e);
        }
    });
    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: "application/pdf" });
}

/**
 * Process forms for both plaintiff, defendant, and attorney.
 * @param {File} excelFile Combined Excel input
 * @param {string} plaintiffName
 * @param {string} defendantName
 * @param {string} attorneyName
 * @returns {Promise<Array<{ name: string, blob: Blob }>>}
 */
// src/backend/form_automator.js

export async function processFormsForBoth(
    excelFile, // still accepted for compatibility, but not used for lookup
    { plaintiffData, defendantData, attorneyData }
) {
    // — build a full_name for each from its first/middle/last parts —
    const makeFullName = (d) =>
        [d.first_name, d.middle_name, d.last_name].filter(Boolean).join(" ");

    const plaintiffs = {
        ...plaintiffData,
        full_name: makeFullName(plaintiffData),
    };
    const defendants = {
        ...defendantData,
        full_name: makeFullName(defendantData),
    };
    const attorneys = {
        ...attorneyData,
        full_name: makeFullName(attorneyData),
    };

    // Ensure middle_initial exists and is a blank string when middle_name is empty
    const computeMiddleInitial = (d) =>
        d && d.middle_name ? String(d.middle_name)[0] : "";
    plaintiffs.middle_initial = computeMiddleInitial(plaintiffs);
    defendants.middle_initial = computeMiddleInitial(defendants);
    attorneys.middle_initial = computeMiddleInitial(attorneys);

    // Build the map of PDF fields → values
    const formFieldsMap = getFormFields(plaintiffs, defendants, attorneys);

    // Only generate the selected templates (skip cjd109 and jud_pfc_cjp37)
    const keysToGenerate = [
        "notice_of_appearance",
        "jud_pfc_cjp35",
        "jud_affidavit",
    ];

    const output = [];
    for (const key of keysToGenerate) {
        const url = TEMPLATE_URLS[key];
        const blob = await fillPdf(url, formFieldsMap[key] || {});
        const filename = `${key}.${plaintiffs.full_name}.pdf`;
        output.push({ name: filename, blob });
    }

    return output;
}

/**
 * Convenience wrapper for processing just names (used by main.js).
 */
export async function getNames(files) {
    return getNamesFromExcel(await combineExcelFiles(files));
}
