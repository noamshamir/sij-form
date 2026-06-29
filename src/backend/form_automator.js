import * as XLSX from "xlsx";
import { combineExcelFiles } from "./main";
import { PDFDocument } from "pdf-lib";

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
    // non-Adobe viewers; the flattened templates/ copy renders (it has no fillable
    // fields, so it is produced blank for the user to complete by hand).
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
        // CJP 31 is a flat, non-fillable form (dynamic XFA) — produced blank.
        cjp31: {},
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
async function fillPdf(templateUrl, fields) {
    const res = await fetch(templateUrl);
    const arrayBuffer = await res.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const form = pdfDoc.getForm();
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
        const blob = await fillPdf(url, formFieldsMap[key]);
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
