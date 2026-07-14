// Draw proposed CJP 31 field rects as translucent boxes on the flat template so
// alignment can be verified visually before wiring them into form_automator.js.
import fs from "fs";
import { PDFDocument, rgb } from "pdf-lib";

// Proposed NEW rects (the attorney-completable blanks). Existing data-backed
// rects from form_automator.js are drawn too (in blue) as calibration anchors.
export const NEW_RECTS = {
    // --- page 1: service option checkboxes + specify line ---
    optPublicationOnly: { page: 0, x: 29.5, y: 625, w: 10, h: 10, type: "checkbox" },
    optPublicationAndMail: { page: 0, x: 29.5, y: 580.5, w: 10, h: 10, type: "checkbox" },
    optOtherMeans: { page: 0, x: 29.5, y: 526.5, w: 10, h: 10, type: "checkbox" },
    optPleaseSpecify: { page: 0, x: 299.5, y: 526.5, w: 10, h: 10, type: "checkbox" },
    optInstructMe: { page: 0, x: 420, y: 526.5, w: 10, h: 10, type: "checkbox" },
    otherMeansSpecify: { page: 0, x: 48, y: 505, w: 535, h: 13 },
    // --- page 1: general information ---
    addrUnknown: { page: 0, x: 327.5, y: 387.5, w: 10, h: 10, type: "checkbox" },
    lastLivedDate: { page: 0, x: 265, y: 307, w: 172, h: 13 },
    lastContactDate: { page: 0, x: 427, y: 262, w: 148, h: 13 },
    // --- page 1: attempts to locate ---
    attPhone: { page: 0, x: 48, y: 184.5, w: 10, h: 10, type: "checkbox" },
    phoneNumber: { page: 0, x: 446, y: 181, w: 137, h: 12 },
    phoneResponse: { page: 0, x: 66, y: 150.5, w: 517, h: 13 },
    attEmail: { page: 0, x: 48, y: 122, w: 10, h: 10, type: "checkbox" },
    emailAddress: { page: 0, x: 367, y: 119, w: 216, h: 12 },
    emailResponse: { page: 0, x: 66, y: 81, w: 517, h: 13 },
    // --- page 2: social media ---
    attSocial: { page: 1, x: 47.5, y: 715, w: 10, h: 10, type: "checkbox" },
    socialSite1: { page: 1, x: 66, y: 657, w: 185, h: 15 },
    socialDate1: { page: 1, x: 253, y: 657, w: 157, h: 15 },
    socialResp1: { page: 1, x: 412, y: 657, w: 172, h: 15 },
    socialSite2: { page: 1, x: 66, y: 636, w: 185, h: 15 },
    socialDate2: { page: 1, x: 253, y: 636, w: 157, h: 15 },
    socialResp2: { page: 1, x: 412, y: 636, w: 172, h: 15 },
    // --- page 2: internet searches ---
    attInternet: { page: 1, x: 47.5, y: 603.5, w: 10, h: 10, type: "checkbox" },
    webSite1: { page: 1, x: 66, y: 546.5, w: 185, h: 15 },
    webDate1: { page: 1, x: 253, y: 546.5, w: 157, h: 15 },
    webResp1: { page: 1, x: 412, y: 546.5, w: 172, h: 15 },
    webSite2: { page: 1, x: 66, y: 525.5, w: 185, h: 15 },
    webDate2: { page: 1, x: 253, y: 525.5, w: 157, h: 15 },
    webResp2: { page: 1, x: 412, y: 525.5, w: 172, h: 15 },
    // --- page 2: child support / contacts / military / other ---
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
    // --- page 2: attempts to serve ---
    serveMailedPetition: { page: 1, x: 47.5, y: 190, w: 10, h: 10, type: "checkbox" },
    serveMailedDate: { page: 1, x: 414, y: 186.5, w: 129, h: 12 },
    serveSheriff: { page: 1, x: 47.5, y: 136, w: 10, h: 10, type: "checkbox" },
    serveNotAttempted: { page: 1, x: 47.5, y: 82, w: 10, h: 10, type: "checkbox" },
    // --- page 3: signature block ---
    signDate: { page: 2, x: 53, y: 665.5, w: 213, h: 13 },
    signature: { page: 2, x: 281, y: 669, w: 302, h: 13 },
};

// Existing data-backed rects (from form_automator.js) — calibration anchors.
const EXISTING = {
    caseName_p1: { page: 0, x: 60, y: 692, w: 545, h: 13 },
    docket_p1: { page: 0, x: 320, y: 733, w: 110, h: 13 },
    division_p1: { page: 0, x: 405, y: 683, w: 118, h: 12 },
    serveName: { page: 0, x: 232, y: 435, w: 180, h: 12 },
    lastAddr: { page: 0, x: 80, y: 379, w: 285, h: 12 },
    cityStZip: { page: 0, x: 80, y: 342, w: 285, h: 12 },
    caseName_p2: { page: 1, x: 90, y: 760, w: 420, h: 12 },
    docket_p2: { page: 1, x: 540, y: 767, w: 70, h: 11 },
    caseName_p3: { page: 2, x: 90, y: 760, w: 420, h: 12 },
    docket_p3: { page: 2, x: 540, y: 767, w: 70, h: 11 },
    atName: { page: 2, x: 315, y: 623, w: 200, h: 12 },
};

async function main() {
    const bytes = fs.readFileSync(
        "public/templates/Motion for Service by Alternate Means & Affidavit (CJP 31)_07-16-2024_1038.pdf"
    );
    const doc = await PDFDocument.load(bytes);
    const pages = doc.getPages();
    const draw = (rects, color) => {
        for (const r of Object.values(rects)) {
            pages[r.page].drawRectangle({
                x: r.x, y: r.y, width: r.w, height: r.h,
                color, opacity: 0.35,
            });
        }
    };
    draw(NEW_RECTS, rgb(1, 0.2, 0.1));
    draw(EXISTING, rgb(0.1, 0.3, 1));
    fs.writeFileSync("/tmp/cjp31_debug.pdf", await doc.save());
    console.log("wrote /tmp/cjp31_debug.pdf");
}
main().catch((e) => { console.error(e); process.exit(1); });
