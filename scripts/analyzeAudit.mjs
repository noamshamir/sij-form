// Compare the intended field mapping (getFormFields) against the audit of the
// generated PDFs: which intended sets failed, and which PDF fields remain empty.
import fs from "fs";
import path from "path";
import { getFormFields } from "../src/backend/form_automator";

const ROOT = process.cwd();
const audit = JSON.parse(
    fs.readFileSync(path.join(ROOT, "generated-filled", "audit.json"), "utf8")
);

const makeFullName = (d) =>
    [d.first_name, d.middle_name, d.last_name].filter(Boolean).join(" ");
const withDerived = (d) => ({
    ...d,
    full_name: makeFullName(d),
    middle_initial: d.middle_name ? String(d.middle_name)[0] : "",
    state_and_zip: `${d.state} ${d.zip_code}`,
});

const data = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const mapping = getFormFields(
    withDerived(data.plaintiffData),
    withDerived(data.defendantData),
    withDerived(data.attorneyData)
);

const result = {};
for (const entry of audit) {
    const key = entry.form.split(".")[0];
    const intended = mapping[key] || {};
    const byName = Object.fromEntries(entry.fields.map((f) => [f.name, f]));

    const failures = [];
    for (const [fname, want] of Object.entries(intended)) {
        const auditName = key === "cjp31" ? `cjp31_${fname}` : fname;
        const row = byName[auditName];
        const wantStr =
            want && typeof want === "object"
                ? "check" in want
                    ? "[check]"
                    : String(want.select ?? "")
                : String(want ?? "");
        if (wantStr === "") continue; // intentionally empty mapping
        if (!row) {
            failures.push({ field: fname, want: wantStr, why: "field not found in PDF" });
        } else if (row.filled === false) {
            failures.push({ field: fname, want: wantStr, why: "set attempted but empty in output" });
        }
    }

    const intendedNames = new Set(
        Object.keys(intended).map((n) => (key === "cjp31" ? `cjp31_${n}` : n))
    );
    const unfilled = entry.fields.filter(
        (f) => f.filled === false && !intendedNames.has(f.name)
    );
    result[key] = {
        form: entry.form,
        totalFields: entry.fieldCount,
        mappingFailures: failures,
        unmappedEmpty: unfilled.map((f) => ({
            name: f.name,
            type: f.type,
            label: f.label,
            options: f.options,
            readOnly: f.readOnly,
        })),
    };
}
fs.writeFileSync(
    path.join(ROOT, "generated-filled", "analysis.json"),
    JSON.stringify(result, null, 2)
);
for (const [k, v] of Object.entries(result)) {
    console.log(
        `${k}: ${v.mappingFailures.length} mapping failures, ${v.unmappedEmpty.length} unmapped empty fields`
    );
    for (const f of v.mappingFailures) console.log(`  FAIL ${f.field} (${f.why})`);
}
