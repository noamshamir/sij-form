import * as XLSX from "xlsx";
import { combineExcelFiles } from "./main";
import { PDFDocument } from "pdf-lib";

// Template URLs (host these PDF templates in your public folder):
const TEMPLATE_URLS = {
    cjd109: "../../templates/cjd109.pdf",
    jud_affidavit: "../../templates/jud-affidavit-of-indigency-821.pdf",
    jud_pfc_cjp35:
        "../../templates/jud-pfc-cjp35-complaint-for-dependency-c119-s39m.pdf",
    jud_pfc_cjp37:
        "../../templates/jud-pfc-cjp37-judgment-of-dependency-c119-s39m.pdf",
    notice_of_appearance:
        "../../templates/Notice of Appearance Form - 2023.pdf",
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
    // range:5 => start reading at zero-based row index 5 (6th row)
    const data = XLSX.utils.sheet_to_json(sheet, { range: 5 });
    return data;
}

/**
 * Extract beneficiary full names from Excel.
 * @param {File} file
 * @returns {Promise<string[]>}
 */
export async function getNamesFromExcel(file) {
    const rows = await getDicts(file);
    return rows.map((r) =>
        [
            r["Beneficiary First Name"],
            r["Beneficiary Middle Name"],
            r["Beneficiary Last Name"],
        ]
            .filter(Boolean)
            .join(" ")
    );
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
    const first_name = getField("Beneficiary First Name", row);
    const last_name = getField("Beneficiary Last Name", row);
    if (!first_name || !last_name) {
        console.error(`Row ${index}: missing names`);
        return null;
    }
    const middle_name = getField("Beneficiary Middle Name", row);
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
            "form1[0].BodyPage1[0].Subform6[0].TextField4[6]":
                defendant["middle_initial"],

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
        },
        jud_affidavit: {
            "Name of applicant": plaintiff.full_name,
            "Street and number": plaintiff.address,
            "City or town": plaintiff.city,
            "State and Zip": plaintiff.state_and_zip,
            "Attorney Name": attorney.full_name,
            "Attorney Address": attorney.address,
            "Attorney City": attorney.city,
            "Attorney State and Zip": attorney.state_and_zip,
        },
        jud_pfc_cjp35: {
            "form1[0].BodyPage1[0].S1[0].TextField4[2]":
                plaintiff["first_name"],
            "form1[0].BodyPage1[0].S1[0].TextField4[3]":
                plaintiff["middle_initial"],
            "form1[0].BodyPage1[0].S1[0].TextField4[1]": plaintiff["last_name"],
            "form1[0].BodyPage1[0].S1[0].TextField4[6]":
                defendant["first_name"],
            "form1[0].BodyPage1[0].S1[0].TextField4[4]": defendant["last_name"],
            "form1[0].BodyPage1[0].S1[0].TextField4[5]":
                defendant["middle_initial"],
            // #par 2 thing
            //     # 'form1[0].BodyPage1[0].S1[0].TextField4[8]': '<def2 mi>',
            //     # 'form1[0].BodyPage1[0].S1[0].TextField4[9]': '<def2 first name>',
            //     # 'form1[0].BodyPage1[0].S1[0].TextField4[7]': '<def2 last name>',
            "form1[0].BodyPage1[0].S2[0].TextField4[3]": plaintiff["address"],
            "form1[0].BodyPage1[0].S2[0].TextField4[2]":
                plaintiff["apartment_number"],
            "form1[0].BodyPage1[0].S2[0].TextField4[1]": plaintiff["city"],
            "form1[0].BodyPage1[0].S2[0].TextField4[0]": plaintiff["state"],
            "form1[0].BodyPage1[0].S2[0].TextField5[0]": plaintiff["zip_code"],

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

            "form1[0].BodyPage1[0].S4[0].TextField4[1]":
                defendant["middle_initial"],
            "form1[0].BodyPage1[0].S4[0].TextField4[2]": defendant["address"],
            "form1[0].BodyPage1[0].S4[0].TextField4[0]":
                defendant["first_name"],
            "form1[0].BodyPage1[0].S4[0].TextField4[3]": defendant["city"],
            "form1[0].BodyPage1[0].S4[0].TextField4[6]": defendant["last_name"],
            "form1[0].BodyPage1[0].S4[0].TextField4[4]": defendant["state"],
            "form1[0].BodyPage1[0].S4[0].TextField4[5]":
                defendant["apartment_number"],
            "form1[0].BodyPage1[0].S4[0].TextField5[0]": defendant["zip_code"],
            // #par 2 thing
            //     # 'form1[0].BodyPage2[0].S5[0].TextField4[0]': '<par2 first name>',
            //     # 'form1[0].BodyPage2[0].S5[0].TextField4[1]': '<par2 mi>',
            //     # 'form1[0].BodyPage2[0].S5[0].TextField4[6]': '<par2 last name>'
        },
        jud_pfc_cjp37: {
            "form1[0].BodyPage1[0].S1[0].TextField4[1]":
                plaintiff["first_name"],
            "form1[0].BodyPage1[0].S1[0].TextField4[3]": plaintiff["last_name"],
            "form1[0].BodyPage1[0].S1[0].TextField4[4]":
                defendant["first_name"],
            "form1[0].BodyPage1[0].S1[0].TextField4[6]": defendant["last_name"],
            "form1[0].BodyPage1[0].S1[0].TextField4[5]":
                defendant["middle_initial"],
            "form1[0].BodyPage1[0].S1[0].TextField4[7]": defendant["address"],
            "form1[0].BodyPage1[0].S1[0].TextField4[8]": defendant["city"],
            "form1[0].BodyPage1[0].S1[0].TextField4[9]": defendant["state"],
            "form1[0].BodyPage1[0].S1[0].TextField5[1]": defendant["zip_code"],
            "form1[0].BodyPage1[0].S1[0].TextField4[10]": attorney["full_name"],
        },
        notice_of_appearance: {
            "form1[0].BodyPage1[0].CaseNameSub[0].PlffField[0]":
                plaintiff.full_name,
            "form1[0].BodyPage1[0].CaseNameSub[0].DfdtField[0]": `${defendant.first_name} ${defendant.last_name}`,
            "form1[0].BodyPage1[0].AttyField[0]": attorney.full_name,
            "form1[0].BodyPage1[0].AttyAddrField[0]": attorney.address,
            "form1[0].BodyPage1[0].AttyCityField[0]": `${attorney.city}, ${attorney.state} ${attorney.zip_code}`,
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
export async function processFormsForBoth(
    excelFile,
    { plaintiffName, defendantName, attorneyName }
) {
    const rows = await getDicts(excelFile);
    const findByName = (full) => {
        const target = full.toLowerCase().trim();
        return rows.find((r) => {
            // Use empty string if middle name is undefined or empty
            const parts = [
                r["Beneficiary First Name"] || "",
                r["Beneficiary Middle Name"] || "",
                r["Beneficiary Last Name"] || "",
            ].filter(Boolean); // drop any empty strings
            const name = parts.join(" ").toLowerCase().trim();
            return name === target;
        });
    };
    const plaintiffRow = findByName(plaintiffName);
    console.log(plaintiffRow);
    const defendantRow = findByName(defendantName);
    console.log(defendantRow);
    const attorneyRow = findByName(attorneyName);
    console.log(attorneyRow);

    const plaintiffs = processPersonData(plaintiffRow, 0);
    const defendants = processPersonData(defendantRow, 1);
    const attorneys = processPersonData(attorneyRow, 2);
    const formFieldsMap = getFormFields(plaintiffs, defendants, attorneys);

    const output = [];
    for (const [key, url] of Object.entries(TEMPLATE_URLS)) {
        const blob = await fillPdf(url, formFieldsMap[key]);
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
