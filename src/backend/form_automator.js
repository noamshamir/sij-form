import * as XLSX from "xlsx";
import { combineExcelFiles } from "./main";
import { PDFDocument, StandardFonts } from "pdf-lib";

// CJP 31 ships only as a flat (dynamic-XFA) PDF with no fillable AcroForm
// fields, so we create form fields at fixed coordinates instead. Coordinates
// are PDF points (bottom-left origin); page is 0-based. Derived from the
// form's printed labels and verified by rendering.
//
// Every entry becomes a field in the output — entries with a value in
// getFormFields() are pre-filled; the rest are created empty so the attorney
// can complete the whole form digitally (service options, dates, the
// attempts-to-locate tables, signature). type: "checkbox" makes a checkbox
// (default is a text field); multiline allows wrapped text.
const CJP31_FIELD_RECTS = {
    caseName_p1: { page: 0, x: 60, y: 692, w: 545, h: 13 },
    docket_p1: { page: 0, x: 320, y: 733, w: 110, h: 13 },
    division_p1: { page: 0, x: 405, y: 683, w: 118, h: 12 },
    // Service options ("check only ONE").
    optPublicationOnly: { page: 0, x: 29.5, y: 625, w: 10, h: 10, type: "checkbox" },
    optPublicationAndMail: { page: 0, x: 29.5, y: 580.5, w: 10, h: 10, type: "checkbox" },
    optOtherMeans: { page: 0, x: 29.5, y: 526.5, w: 10, h: 10, type: "checkbox" },
    optPleaseSpecify: { page: 0, x: 299.5, y: 526.5, w: 10, h: 10, type: "checkbox" },
    optInstructMe: { page: 0, x: 420, y: 526.5, w: 10, h: 10, type: "checkbox" },
    otherMeansSpecify: { page: 0, x: 48, y: 505, w: 535, h: 13 },
    // General information.
    serveName: { page: 0, x: 232, y: 435, w: 180, h: 12 },
    addrUnknown: { page: 0, x: 327.5, y: 387.5, w: 10, h: 10, type: "checkbox" },
    lastAddr: { page: 0, x: 80, y: 379, w: 285, h: 12 },
    cityStZip: { page: 0, x: 80, y: 342, w: 285, h: 12 },
    lastLivedDate: { page: 0, x: 265, y: 307, w: 172, h: 13 },
    lastContactDate: { page: 0, x: 427, y: 262, w: 148, h: 13 },
    // Attempts to locate (page 1).
    attPhone: { page: 0, x: 48, y: 184.5, w: 10, h: 10, type: "checkbox" },
    phoneNumber: { page: 0, x: 446, y: 181, w: 137, h: 12 },
    phoneResponse: { page: 0, x: 66, y: 150.5, w: 517, h: 13 },
    attEmail: { page: 0, x: 48, y: 122, w: 10, h: 10, type: "checkbox" },
    emailAddress: { page: 0, x: 367, y: 119, w: 216, h: 12 },
    emailResponse: { page: 0, x: 66, y: 81, w: 517, h: 13 },
    // Attempts to locate (page 2).
    caseName_p2: { page: 1, x: 90, y: 760, w: 420, h: 12 },
    docket_p2: { page: 1, x: 540, y: 767, w: 70, h: 11 },
    attSocial: { page: 1, x: 47.5, y: 715, w: 10, h: 10, type: "checkbox" },
    socialSite1: { page: 1, x: 66, y: 657, w: 185, h: 15 },
    socialDate1: { page: 1, x: 253, y: 657, w: 157, h: 15 },
    socialResp1: { page: 1, x: 412, y: 657, w: 172, h: 15 },
    socialSite2: { page: 1, x: 66, y: 636, w: 185, h: 15 },
    socialDate2: { page: 1, x: 253, y: 636, w: 157, h: 15 },
    socialResp2: { page: 1, x: 412, y: 636, w: 172, h: 15 },
    attInternet: { page: 1, x: 47.5, y: 603.5, w: 10, h: 10, type: "checkbox" },
    webSite1: { page: 1, x: 66, y: 546.5, w: 185, h: 15 },
    webDate1: { page: 1, x: 253, y: 546.5, w: 157, h: 15 },
    webResp1: { page: 1, x: 412, y: 546.5, w: 172, h: 15 },
    webSite2: { page: 1, x: 66, y: 525.5, w: 185, h: 15 },
    webDate2: { page: 1, x: 253, y: 525.5, w: 157, h: 15 },
    webResp2: { page: 1, x: 412, y: 525.5, w: 172, h: 15 },
    attChildSupport: { page: 1, x: 47.5, y: 495, w: 10, h: 10, type: "checkbox" },
    attContacts: { page: 1, x: 47.5, y: 451, w: 10, h: 10, type: "checkbox" },
    contactName1: { page: 1, x: 66, y: 410, w: 143, h: 14 },
    contactRel1: { page: 1, x: 211, y: 410, w: 92, h: 14 },
    contactDate1: { page: 1, x: 305, y: 410, w: 92, h: 14 },
    contactTold1: { page: 1, x: 399, y: 410, w: 185, h: 14 },
    contactName2: { page: 1, x: 66, y: 391, w: 143, h: 14 },
    contactRel2: { page: 1, x: 211, y: 391, w: 92, h: 14 },
    contactDate2: { page: 1, x: 305, y: 391, w: 92, h: 14 },
    contactTold2: { page: 1, x: 399, y: 391, w: 185, h: 14 },
    attMilitary: { page: 1, x: 47.5, y: 360, w: 10, h: 10, type: "checkbox" },
    attOther: { page: 1, x: 47.5, y: 307, w: 10, h: 10, type: "checkbox" },
    otherEfforts: { page: 1, x: 66, y: 269, w: 517, h: 26, multiline: true },
    // Attempts to serve (page 2).
    serveMailedPetition: { page: 1, x: 47.5, y: 190, w: 10, h: 10, type: "checkbox" },
    serveMailedDate: { page: 1, x: 414, y: 186.5, w: 129, h: 12 },
    serveSheriff: { page: 1, x: 47.5, y: 136, w: 10, h: 10, type: "checkbox" },
    serveNotAttempted: { page: 1, x: 47.5, y: 82, w: 10, h: 10, type: "checkbox" },
    // Signature block (page 3). The "FOR COURT USE ONLY" section is left alone.
    caseName_p3: { page: 2, x: 90, y: 760, w: 420, h: 12 },
    docket_p3: { page: 2, x: 540, y: 767, w: 70, h: 11 },
    signDate: { page: 2, x: 53, y: 665.5, w: 213, h: 13 },
    signature: { page: 2, x: 281, y: 669, w: 302, h: 13 },
    atName: { page: 2, x: 315, y: 623, w: 200, h: 12 },
    atAddr: { page: 2, x: 315, y: 595, w: 170, h: 12 },
    atApt: { page: 2, x: 505, y: 595, w: 70, h: 12 },
    atCity: { page: 2, x: 315, y: 567, w: 150, h: 12 },
    atState: { page: 2, x: 485, y: 567, w: 45, h: 12 },
    atZip: { page: 2, x: 543, y: 567, w: 55, h: 12 },
    atPhone: { page: 2, x: 375, y: 538, w: 230, h: 11 },
    atBBO: { page: 2, x: 375, y: 520, w: 230, h: 11 },
    atEmail: { page: 2, x: 375, y: 502, w: 230, h: 11 },
};

// Template URLs. Resolve against PUBLIC_URL so the fetch works regardless of
// whether the app is served from the site root or a sub-path (e.g. /form-only).
const BASE = process.env.PUBLIC_URL || "";
const TEMPLATE_URLS = {
    cjd109: `${BASE}/updated_templates/cjd109.pdf`,
    jud_affidavit: `${BASE}/templates/jud-affidavit-of-indigency-821.pdf`,
    jud_pfc_cjp35: `${BASE}/updated_templates/cjp35-complaint-for-dependency-c119-s39m.pdf`,
    jud_pfc_cjp37: `${BASE}/updated_templates/cjp37-judgment-and-findings on dependency affirmative.pdf`,
    notice_of_appearance: `${BASE}/templates/Notice of Appearance Form - 2023.pdf`,
    cjd400: `${BASE}/updated_templates/Motion (CJ-D 400).pdf`,
    // CJP 31's official copy is a dynamic XFA form that renders "Please wait" in
    // non-Adobe viewers; the flattened templates/ copy renders. It has no fillable
    // fields of its own, so fillPdf creates them at CJP31_FIELD_RECTS coordinates —
    // data-backed ones pre-filled, the rest empty for the attorney to complete.
    cjp31: `${BASE}/templates/Motion for Service by Alternate Means & Affidavit (CJP 31)_07-16-2024_1038.pdf`,
    tc0050: `${BASE}/updated_templates/Child Care or Custody Disclosure Affidavit (TC0050).pdf`,
};

/**
 * Parse an Excel File object into an array of JS records (dicts).
 * Assumes header row at Excel row 6 (zero-indexed range:5).
 * @param {File} file
 * @returns {Promise<Object[]>}
 */
export async function getDicts(file) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    // Try to auto-detect the header row instead of assuming row 6.
    // First read as an array-of-arrays so we can inspect rows.
    const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Look for a row that contains expected beneficiary column names.
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
        // Use the detected header row as the start (XLSX uses zero-based range)
        try {
            console.log(
                `form_automator.getDicts: detected headerRowIndex=${headerRowIndex} for file='${
                    file.name || "<combined>"
                }'`
            );
            // show first 2 rows for context
            if (allRows && allRows.length) {
                console.log(
                    "form_automator.getDicts: sample rows:",
                    allRows.slice(
                        Math.max(0, headerRowIndex - 1),
                        headerRowIndex + 3
                    )
                );
            }
        } catch (e) {
            /* ignore logging errors */
        }
        data = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });
    } else {
        // Fallback to the original behavior (row 6 / index 5)
        try {
            console.warn(
                `form_automator.getDicts: failed to detect header row, falling back to range:5 for file='${
                    file.name || "<combined>"
                }'`
            );
            // show first 3 rows for debugging
            if (allRows && allRows.length) {
                console.log(
                    "form_automator.getDicts: fallback sample rows:",
                    allRows.slice(0, 4)
                );
            }
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
        if (first || last || middle) {
            return [first, middle, last].filter(Boolean).join(" ");
        }
        // Fallback: some spreadsheets provide a single 'Beneficiary Name' column
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
        if (typeof value !== "number" || isNaN(value)) {
            return returnNA ? "N/A" : "";
        }
    } else {
        if (typeof value !== "string") {
            return returnNA ? "N/A" : "";
        }
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

    // If separate first/last/middle columns are missing, try to parse a
    // single `Beneficiary Name` column (common in some Excel exports).
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
    const address_line_two = getField("Address-Current Line 2", row);
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
        cjd109: {
            "form1[0].BodyPage1[0].Subform6[0].TextField4[4]":
                plaintiff["first_name"],
            "form1[0].BodyPage1[0].Subform6[0].TextField4[5]":
                plaintiff["last_name"],
            "form1[0].BodyPage1[0].Subform6[0].TextField4[1]":
                defendant["first_name"],
            "form1[0].BodyPage1[0].Subform6[0].TextField4[2]":
                defendant["last_name"],
            "form1[0].BodyPage1[0].Subform6[0].TextField4[3]":
                defendant["middle_initial"],
            // TextField4[6] is the Plaintiff-row middle initial (verified by
            // positional probe), not a second defendant initial.
            "form1[0].BodyPage1[0].Subform6[0].TextField4[6]":
                plaintiff["middle_initial"],

            // Docket No. + court Division (the dropdown options are MA county
            // names, so the child's county selects the right division).
            "form1[0].BodyPage1[0].Subform6[0].TextField4[0]":
                plaintiff["case_no"],
            "form1[0].BodyPage1[0].Subform6[0].DropDownList1[0]": {
                select: plaintiff["county"],
            },

            "form1[0].BodyPage1[0].S1[0].t1[0]": plaintiff["address"],
            "form1[0].BodyPage1[0].S1[0].TextField4[1]":
                plaintiff["apartment_number"],
            "form1[0].BodyPage1[0].S1[0].t2[0]": plaintiff["city"],
            "form1[0].BodyPage1[0].S1[0].TextField4[0]": plaintiff["state"],
            "form1[0].BodyPage1[0].S1[0].TextField5[0]": plaintiff["zip_code"],

            "form1[0].BodyPage1[0].S2[0].TextField4[2]":
                plaintiff["first_name"],
            "form1[0].BodyPage1[0].S2[0].TextField4[1]":
                plaintiff["middle_initial"],
            "form1[0].BodyPage1[0].S2[0].TextField4[0]": plaintiff["last_name"],
            "form1[0].BodyPage1[0].S2[0].TextField5[1]": plaintiff["age"],
            "form1[0].BodyPage1[0].S2[0].TextField5[2]":
                plaintiff["birth_date"],
            "form1[0].BodyPage1[0].S2[0].TextField4[6]": plaintiff["address"],
            "form1[0].BodyPage1[0].S2[0].TextField4[5]":
                plaintiff["apartment_number"],
            "form1[0].BodyPage1[0].S2[0].TextField4[4]": plaintiff["city"],
            "form1[0].BodyPage1[0].S2[0].TextField4[3]": plaintiff["state"],
            "form1[0].BodyPage1[0].S2[0].TextField5[0]": plaintiff["zip_code"],

            "form1[0].BodyPage1[0].S3[0].t1[0]": defendant["address"],
            "form1[0].BodyPage1[0].S3[0].TextField4[0]":
                defendant["apartment_number"],
            "form1[0].BodyPage1[0].S3[0].t2[0]": defendant["city"],
            "form1[0].BodyPage1[0].S3[0].TextField4[1]": defendant["state"],
            "form1[0].BodyPage1[0].S3[0].TextField5[0]": defendant["zip_code"],

            "form1[0].BodyPage1[0].S8[0].TextField5[0]": attorney["full_name"],
            "form1[0].BodyPage1[0].S8[0].TextField5[4]": attorney["address"],
            "form1[0].BodyPage1[0].S8[0].TextField4[0]":
                attorney["apartment_number"],
            "form1[0].BodyPage1[0].S8[0].TextField5[3]": attorney["city"],
            "form1[0].BodyPage1[0].S8[0].TextField5[2]": attorney["state"],
            "form1[0].BodyPage1[0].S8[0].TextField5[1]": attorney["zip_code"],
            "form1[0].BodyPage1[0].S8[0].Phone[0]": attorney["phone_cell"],
            "form1[0].BodyPage1[0].S8[0].TextField6[0]": attorney["bbo"],
        },
        jud_affidavit: {
            // Affidavit of Indigency is completed by the applicant (the child).
            // This form has no attorney section, so only applicant fields apply.
            "Name of applicant": plaintiff.full_name,
            "Street and number": plaintiff.address,
            "City or town": plaintiff.city,
            "State and Zip": plaintiff.state_and_zip,
            // SIJ dependency filings go to the county Probate and Family Court.
            Court: plaintiff.county
                ? `${plaintiff.county} Probate and Family Court`
                : "",
            "Case Name and Number if known": [
                [plaintiff.last_name, defendant.last_name]
                    .filter(Boolean)
                    .join(" v. "),
                plaintiff.case_no,
            ]
                .filter(Boolean)
                .join(", "),
        },
        jud_pfc_cjp35: {
            // Docket No. repeats
            "form1[0].#pageSet[0].Page2[0].docketno[0]": plaintiff["case_no"],
            "form1[0].#pageSet[0].Page2[1].docketno[0]": plaintiff["case_no"],
            "form1[0].#pageSet[0].Page2[2].docketno[0]": plaintiff["case_no"],
            "form1[0].BodyPage1[0].S1[0].docketno[0]": plaintiff["case_no"],

            // Court division (= county) and "New" (an initial complaint, not an
            // amendment).
            "form1[0].BodyPage1[0].S1[0].DropDownList1[0]": {
                select: plaintiff["county"],
            },
            "form1[0].BodyPage1[0].S1[0].new[0]": { check: true },
            "form1[0].#pageSet[0].Page2[0].new[0]": { check: true },
            "form1[0].#pageSet[0].Page2[1].new[0]": { check: true },
            "form1[0].#pageSet[0].Page2[2].new[0]": { check: true },

            // Caption: Plaintiff (child)
            "form1[0].BodyPage1[0].S1[0].TextField4[1]":
                plaintiff["first_name"],
            "form1[0].BodyPage1[0].S1[0].TextField4[2]":
                plaintiff["middle_initial"],
            "form1[0].BodyPage1[0].S1[0].TextField4[0]": plaintiff["last_name"],

            // Caption: Defendant (Parent One)
            "form1[0].BodyPage1[0].S1[0].TextField4[5]":
                defendant["first_name"],
            "form1[0].BodyPage1[0].S1[0].TextField4[4]":
                defendant["middle_initial"],
            "form1[0].BodyPage1[0].S1[0].TextField4[3]": defendant["last_name"],

            // 1. Plaintiff address line
            "form1[0].BodyPage1[0].S2[0].TextField4[3]": plaintiff["address"],
            "form1[0].BodyPage1[0].S2[0].TextField4[2]":
                plaintiff["apartment_number"],
            "form1[0].BodyPage1[0].S2[0].TextField4[1]": plaintiff["city"],
            "form1[0].BodyPage1[0].S2[0].TextField4[0]": plaintiff["state"],
            "form1[0].BodyPage1[0].S2[0].TextField5[0]": plaintiff["zip_code"],

            // 2. Child subject (name + address + DOB)
            "form1[0].BodyPage1[0].S3[0].TextField4[1]":
                plaintiff["first_name"],
            "form1[0].BodyPage1[0].S3[0].TextField4[2]":
                plaintiff["middle_initial"],
            "form1[0].BodyPage1[0].S3[0].TextField4[0]": plaintiff["last_name"],

            "form1[0].BodyPage1[0].S3[0].TextField4[3]": plaintiff["address"],
            "form1[0].BodyPage1[0].S3[0].TextField4[6]":
                plaintiff["apartment_number"],
            "form1[0].BodyPage1[0].S3[0].TextField4[4]": plaintiff["city"],
            "form1[0].BodyPage1[0].S3[0].TextField4[5]": plaintiff["state"],
            "form1[0].BodyPage1[0].S3[0].TextField5[0]": plaintiff["zip_code"],

            "form1[0].BodyPage1[0].S3[0].DateField1[0]":
                plaintiff["birth_date"],

            // 3. Parent One (defendant) name + address
            "form1[0].BodyPage1[0].S4[0].TextField4[0]":
                defendant["first_name"],
            "form1[0].BodyPage1[0].S4[0].TextField4[1]":
                defendant["middle_initial"],
            "form1[0].BodyPage1[0].S4[0].TextField4[6]": defendant["last_name"],

            "form1[0].BodyPage1[0].S4[0].TextField4[2]": defendant["address"],
            "form1[0].BodyPage1[0].S4[0].TextField4[5]":
                defendant["apartment_number"],
            "form1[0].BodyPage1[0].S4[0].TextField4[3]": defendant["city"],
            "form1[0].BodyPage1[0].S4[0].TextField4[4]": defendant["state"],
            "form1[0].BodyPage1[0].S4[0].TextField5[0]": defendant["zip_code"],

            // 7. best interest not to return to ______ (country)
            "form1[0].BodyPage1[0].S8[0].TextField4[0]":
                plaintiff["nationality"],

            // Wherefore/request section: "find that it is not in Child's best
            // interest to return to, ______ (Country)" — same datum as item 7.
            // The request checkbox itself is left for the attorney.
            "form1[0].BodyPage1[0].S11a[0].TextField4[0]":
                plaintiff["nationality"],

            // Signature block: Attorney
            "form1[0].BodyPage1[0].S12[0].TextField5[0]": attorney["full_name"],
            "form1[0].BodyPage1[0].S12[0].TextField5[4]": attorney["address"],
            "form1[0].BodyPage1[0].S12[0].TextField4[0]":
                attorney["apartment_number"],
            "form1[0].BodyPage1[0].S12[0].TextField5[3]": attorney["city"],
            "form1[0].BodyPage1[0].S12[0].TextField5[2]": attorney["state"],
            "form1[0].BodyPage1[0].S12[0].TextField5[1]": attorney["zip_code"],

            "form1[0].BodyPage1[0].S12[0].TextField7[0]":
                attorney["phone_cell"],
            "form1[0].BodyPage1[0].S12[0].TextField6[0]": attorney["bbo"],
            "form1[0].BodyPage1[0].S12[0].TextField6[1]": attorney["email"],
        },
        jud_pfc_cjp37: {
            // Docket No. (repeats in the PDF)
            "form1[0].#pageSet[0].Page2[0].docketno[0]": plaintiff["case_no"],
            "form1[0].#pageSet[0].Page2[1].docketno[0]": plaintiff["case_no"],
            "form1[0].BodyPage1[0].S1[0].docketno[0]": plaintiff["case_no"],

            // Court division (= county) and "New" (initial judgment, repeated on
            // the page-set running headers).
            "form1[0].BodyPage1[0].S1[0].DropDownList1[0]": {
                select: plaintiff["county"],
            },
            "form1[0].BodyPage1[0].S1[0].new[0]": { check: true },
            "form1[0].#pageSet[0].Page2[0].new[0]": { check: true },
            "form1[0].#pageSet[0].Page2[1].new[0]": { check: true },

            // Caption: Plaintiff (Child)
            "form1[0].BodyPage1[0].S1[0].TextField4[1]":
                plaintiff["first_name"],
            "form1[0].BodyPage1[0].S1[0].TextField4[2]":
                plaintiff["middle_initial"],
            "form1[0].BodyPage1[0].S1[0].TextField4[0]": plaintiff["last_name"],

            // Caption: Defendant (Parent One)
            "form1[0].BodyPage1[0].S1[0].TextField4[5]":
                defendant["first_name"],
            "form1[0].BodyPage1[0].S1[0].TextField4[4]":
                defendant["middle_initial"],
            "form1[0].BodyPage1[0].S1[0].TextField4[3]": defendant["last_name"],

            // Caption: Defendant (Parent Two) is "If applicable" -> leave blank

            // "Filed on (date)" — use plaintiff date_opened if you have it
            "form1[0].BodyPage1[0].S1[0].DateTimeField1[0]":
                plaintiff["date_opened"],

            // 1. Child name + DOB
            "form1[0].BodyPage1[0].S2[0].TextField4[0]":
                plaintiff["first_name"],
            "form1[0].BodyPage1[0].S2[0].TextField4[1]":
                plaintiff["middle_initial"],
            "form1[0].BodyPage1[0].S2[0].TextField4[2]": plaintiff["last_name"],
            "form1[0].BodyPage1[0].S2[0].DateTimeField1[0]":
                plaintiff["birth_date"],

            // 2. Parent One name (mother/father checkboxes are selection fields -> leave blank)
            "form1[0].BodyPage1[0].S3[0].TextField4[0]":
                defendant["first_name"],
            "form1[0].BodyPage1[0].S3[0].TextField4[1]":
                defendant["middle_initial"],
            "form1[0].BodyPage1[0].S3[0].TextField4[2]": defendant["last_name"],

            // Parent Two name + checkboxes are "If applicable" / selection -> leave blank

            // 8. Country of nationality / last habitual residence (Country)
            "form1[0].BodyPage1[0].S10[0].TextField4[0]":
                plaintiff["nationality"],

            // Everything else on pages 1–3 is either:
            // - checkboxes (selection),
            // - judge name/signature/date,
            // - long narrative LG1 fields,
            // - or "If applicable" custodian/care fields not in your provided data.
        },
        notice_of_appearance: {
            // Case caption: child v. parent
            "form1[0].BodyPage1[0].CaseNameSub[0].PlffField[0]":
                plaintiff.full_name,
            "form1[0].BodyPage1[0].CaseNameSub[0].DfdtField[0]": [
                defendant.first_name,
                defendant.last_name,
            ]
                .filter(Boolean)
                .join(" "),

            // Party information block (the appearing attorney). The real field
            // names live under PartyInformationSub — the previous AttyField /
            // AttyAddrField / AttyCityField names do not exist in this template.
            "form1[0].BodyPage1[0].PartyInformationSub[0].NameField[0]":
                attorney.full_name,
            "form1[0].BodyPage1[0].PartyInformationSub[0].AddressField[0]":
                attorney.address,
            "form1[0].BodyPage1[0].PartyInformationSub[0].AptField[0]":
                attorney.apartment_number,
            "form1[0].BodyPage1[0].PartyInformationSub[0].CityField[0]":
                attorney.city,
            "form1[0].BodyPage1[0].PartyInformationSub[0].StateField[0]":
                attorney.state,
            "form1[0].BodyPage1[0].PartyInformationSub[0].ZipcodeField[0]":
                attorney.zip_code,
            // Phone-Cell is a mobile number → goes in the "Mobile" field.
            "form1[0].BodyPage1[0].PartyInformationSub[0].CellField[0]":
                attorney.phone_cell,
            // Court division (= the child's county; this is a text field despite
            // the "Drop" name) and the attorney's BBO #, firm and e-mail.
            "form1[0].BodyPage1[0].CourtDeptSiteSub[0].DeptSubform[0].DivisionDrop[0]":
                plaintiff["county"],
            "form1[0].BodyPage1[0].PartyInformationSub[0].BBOField[0]":
                attorney["bbo"],
            "form1[0].BodyPage1[0].PartyInformationSub[0].FirmField[0]":
                attorney["firm"],
            "form1[0].BodyPage1[0].PartyInformationSub[0].EmailField[0]":
                attorney["email"],
            // Office/home phone left blank — the cell already populates "Mobile".
            "form1[0].BodyPage1[0].PartyInformationSub[0].PhoneField[0]": "",
        },
        cjd400: {
            // Caption + the moving attorney's signature block. The motion's
            // relief/grounds body and all selection fields are left blank.
            "form1[0].BodyPage1[0].Docket[0]": plaintiff["case_no"],
            "form1[0].BodyPage1[0].Divisions[0]": { select: plaintiff["county"] },
            "form1[0].BodyPage1[0].Plaintiff[0]": plaintiff["full_name"],
            "form1[0].BodyPage1[0].Defendant[0]": defendant["full_name"],
            // "Now comes ___ (name of moving party)" — the child/plaintiff.
            "form1[0].BodyPage1[0].MovingParty[0]": plaintiff["full_name"],
            "form1[0].BodyPage1[0].Print[0]": attorney["full_name"],
            "form1[0].BodyPage1[0].Add[0]": [
                attorney.address,
                attorney.apartment_number,
            ]
                .filter(Boolean)
                .join(", "),
            "form1[0].BodyPage1[0].CityTown[0]": attorney["city"],
            "form1[0].BodyPage1[0].State[0]": attorney["state"],
            "form1[0].BodyPage1[0].Zip[0]": attorney["zip_code"],
            "form1[0].BodyPage1[0].TelNo[0]": attorney["phone_cell"],
            "form1[0].BodyPage1[0].BBO[0]": attorney["bbo"],
            // Page 2 Certificate of Service — caption + the party served (the
            // parent/defendant). Delivery method/date are left for the filer.
            "form1[0].Page2[0].#subform[0].Docket[0]": plaintiff["case_no"],
            "form1[0].Page2[0].#subform[0].Division[0]": {
                select: plaintiff["county"],
            },
            "form1[0].Page2[0].#subform[0].Name[0]": defendant["full_name"],
            "form1[0].Page2[0].#subform[0].Add[0]": [
                defendant.address,
                defendant.apartment_number,
            ]
                .filter(Boolean)
                .join(", "),
            "form1[0].Page2[0].#subform[0].CityTown[0]": defendant["city"],
            "form1[0].Page2[0].#subform[0].State[0]": defendant["state"],
            "form1[0].Page2[0].#subform[0].Zip[0]": defendant["zip_code"],
        },
        // CJP 31 (flat form): values keyed to CJP31_FIELD_RECTS. The motion is
        // used to serve an un-locatable parent, so the "person to serve" is the
        // defendant. The attempts-to-locate / diligent-search narrative and all
        // checkboxes are left for the filer.
        cjp31: (() => {
            const caseName = [plaintiff.full_name, defendant.full_name]
                .filter(Boolean)
                .join(" v. ");
            const defCSZ = [
                defendant.city,
                [defendant.state, defendant.zip_code]
                    .filter(Boolean)
                    .join(" "),
            ]
                .filter(Boolean)
                .join(", ");
            return {
                caseName_p1: caseName,
                caseName_p2: caseName,
                caseName_p3: caseName,
                docket_p1: plaintiff.case_no,
                docket_p2: plaintiff.case_no,
                docket_p3: plaintiff.case_no,
                division_p1: plaintiff.county,
                serveName: defendant.full_name,
                lastAddr: [defendant.address, defendant.apartment_number]
                    .filter(Boolean)
                    .join(", "),
                cityStZip: defCSZ,
                atName: attorney.full_name,
                atAddr: attorney.address,
                atApt: attorney.apartment_number,
                atCity: attorney.city,
                atState: attorney.state,
                atZip: attorney.zip_code,
                atPhone: attorney.phone_cell,
                atBBO: attorney.bbo,
                atEmail: attorney.email,
            };
        })(),
        tc0050: {
            // Caption + child A + the party-contact/attorney block. The lists of
            // other proceedings / persons and all selections are left blank.
            "form1[0].BodyPage1[0].sb_CourtDeptSite[0].CaseName[0]": `${plaintiff.full_name} v. ${defendant.full_name}`,
            "form1[0].BodyPage1[0].sb_CourtDeptSite[0].sb_Dept[0].DocketNo[0]":
                plaintiff["case_no"],
            "form1[0].BodyPage1[0].sb_CourtDeptSite[0].sb_Dept[0].DivisionCounty[0]":
                plaintiff["county"],
            // Court department = Probate & Family Court (option "6"); SIJ
            // predicate orders are filed there.
            "form1[0].BodyPage1[0].sb_CourtDeptSite[0].DeptRBSub[0].DeptRB[0]": {
                select: "6",
            },
            // The attorney is filing/signing this affidavit for the minor child
            // (the "for [child]" name is filled below), so tick both boxes.
            "form1[0].BodyPage1[0].sb_partychkbox[0].cb_attrFiling[0]": {
                check: true,
            },
            "form1[0].BodyPage3[0].Subform2[0].cb_attrSign[0]": { check: true },
            "form1[0].BodyPage1[0].sb_partychkbox[0].txt_forPartyName[0]":
                plaintiff["full_name"],
            "form1[0].BodyPage1[0].sb_childList[0].txt_ChildA_name[0]":
                plaintiff["full_name"],
            // Child A current address (same as the child's residence).
            "form1[0].BodyPage2[0].sb_listChildAddr[0].sb_ChildA[0].txt_currentAddr[0]":
                [
                    [plaintiff.address, plaintiff.apartment_number]
                        .filter(Boolean)
                        .join(" "),
                    plaintiff.city,
                    [plaintiff.state, plaintiff.zip_code]
                        .filter(Boolean)
                        .join(" "),
                ]
                    .filter(Boolean)
                    .join(", "),
            "form1[0].BodyPage3[0].Subform2[0].txt_printTypeName[0]":
                plaintiff["full_name"],
            "form1[0].BodyPage3[0].Subform2[0].txt_homeaddr[0]": [
                [plaintiff.address, plaintiff.apartment_number]
                    .filter(Boolean)
                    .join(" "),
                plaintiff.city,
                [plaintiff.state, plaintiff.zip_code].filter(Boolean).join(" "),
            ]
                .filter(Boolean)
                .join(", "),
            "form1[0].BodyPage3[0].Subform2[0].txt_PhoneNo[0]":
                plaintiff["phone_cell"],
            "form1[0].BodyPage3[0].Subform2[0].txt_AttrName[0]":
                attorney["full_name"],
            // txt_Email sits in the (child) party-contact block, so leave it
            // blank rather than putting the attorney's e-mail there.
            "form1[0].BodyPage3[0].Subform2[0].txt_BBO_bar[0]": attorney["bbo"],
        },
    };
}

/**
 * Fill a template PDF for a set of fields, return a Blob.
 */
async function fillPdf(templateUrl, fields, fieldRects) {
    const res = await fetch(templateUrl);
    const arrayBuffer = await res.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const form = pdfDoc.getForm();

    if (fieldRects) {
        // Flat template (no AcroForm): create a form field at every known
        // rectangle. Data-backed fields are pre-filled; the rest are created
        // empty so the attorney can complete the form digitally.
        const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const pages = pdfDoc.getPages();
        for (const [key, r] of Object.entries(fieldRects)) {
            const value = fields[key];
            try {
                if (r.type === "checkbox") {
                    const cb = form.createCheckBox(`cjp31_${key}`);
                    cb.addToPage(pages[r.page], {
                        x: r.x,
                        y: r.y,
                        width: r.w,
                        height: r.h,
                        borderWidth: 0,
                    });
                    if (value && typeof value === "object" && value.check)
                        cb.check();
                    continue;
                }
                const tf = form.createTextField(`cjp31_${key}`);
                if (r.multiline) tf.enableMultiline();
                tf.addToPage(pages[r.page], {
                    x: r.x,
                    y: r.y,
                    width: r.w,
                    height: r.h,
                    borderWidth: 0,
                    font: helv,
                });
                tf.setFontSize(Math.max(7, Math.min(9.5, r.h * 0.7)));
                if (String(value ?? "") !== "") tf.setText(String(value));
            } catch (e) {
                console.warn(`Could not place field ${key}:`, e);
            }
        }
        form.updateFieldAppearances(helv);
        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes], { type: "application/pdf" });
    }

    Object.entries(fields).forEach(([key, value]) => {
        try {
            if (value && typeof value === "object" && value.check === true) {
                // Checkbox to tick.
                form.getCheckBox(key).check();
            } else if (value && typeof value === "object" && "select" in value) {
                // Radio group or dropdown: only select when the wanted option
                // actually exists (matched case-insensitively), so an unexpected
                // value simply leaves the field blank instead of throwing.
                const wanted = String(value.select ?? "").trim();
                if (!wanted) return;
                const field = form.getField(key);
                const opts =
                    typeof field.getOptions === "function"
                        ? field.getOptions()
                        : [];
                const match = opts.find(
                    (o) => o.trim().toLowerCase() === wanted.toLowerCase()
                );
                if (match !== undefined) field.select(match);
            } else {
                form.getTextField(key).setText(String(value));
            }
        } catch (e) {
            console.warn(`Field ${key} not set:`, e);
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

    // Fill each template and collect outputs
    const output = [];
    for (const [key, url] of Object.entries(TEMPLATE_URLS)) {
        const rects = key === "cjp31" ? CJP31_FIELD_RECTS : undefined;
        const blob = await fillPdf(url, formFieldsMap[key], rects);
        // now filename uses a real full_name
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
