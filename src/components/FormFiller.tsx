// src/components/FormFiller.tsx
import React, { useState, useCallback, useEffect } from "react";
import "./PeopleSelector.css";
import "./FormFiller.css";

// Typing this word anywhere on the page (outside a field) auto-fills the
// form with random sample data — handy for quick testing.
const TRIGGER_WORD = "test";

export type PersonType = "plaintiff" | "defendant" | "attorney";

interface FormFillerProps {
    onDataChange: (type: PersonType, data: Record<string, any>) => void;
}

const TAB_TYPES: PersonType[] = ["plaintiff", "defendant", "attorney"];

const TAB_META: Record<PersonType, { title: string }> = {
    plaintiff: { title: "Child (Plaintiff)" },
    defendant: { title: "Parent (Defendant)" },
    attorney: { title: "Attorney" },
};

// Same 17 fields as the existing step, in the order the forms expect them.
const formFields = [
    { key: "first_name", label: "First Name", type: "text" },
    { key: "middle_name", label: "Middle Name", type: "text" },
    { key: "last_name", label: "Last Name", type: "text" },
    { key: "address", label: "Address Line 1", type: "text" },
    { key: "apartment_number", label: "Address Line 2 / Apt", type: "text" },
    { key: "city", label: "City", type: "text" },
    { key: "state", label: "State", type: "text" },
    { key: "zip_code", label: "Zip", type: "text" },
    { key: "county", label: "County", type: "text" },
    { key: "age", label: "Age", type: "number" },
    { key: "birth_date", label: "Birth Date", type: "date" },
    { key: "process_type", label: "Process Type", type: "text" },
    { key: "date_opened", label: "Date Opened", type: "date" },
    { key: "nationality", label: "Nationality", type: "text" },
    { key: "case_no", label: "Case No", type: "text" },
    { key: "i765_receipt_date", label: "I-765 Receipt Date", type: "date" },
    { key: "phone_cell", label: "Phone (Cell)", type: "text" },
];

// Extra fields shown only on the Attorney tab (used by several forms'
// signature blocks).
const attorneyExtraFields = [
    { key: "bbo", label: "B.B.O. #", type: "text" },
    { key: "email", label: "Email", type: "text" },
    { key: "firm", label: "Firm / Agency", type: "text" },
];

const fieldsForTab = (tab: PersonType) =>
    tab === "attorney" ? [...formFields, ...attorneyExtraFields] : formFields;

const blank = () =>
    Object.fromEntries(
        [...formFields, ...attorneyExtraFields].map((f) => [f.key, ""])
    );

// --- Random test-data generation -----------------------------------------
const FIRST_NAMES = ["Maria", "Juan", "Sofia", "Carlos", "Ana", "Luis", "Camila", "Diego", "Valeria", "Mateo", "Gabriela", "Andres"];
const MIDDLE_NAMES = ["", "", "Jose", "Marie", "Alejandro", "Isabel", "Antonio", "Elena"];
const LAST_NAMES = ["Garcia", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Perez", "Sanchez", "Ramirez", "Torres", "Flores", "Rivera"];
const ATTORNEY_FIRST = ["Sarah", "Michael", "Jennifer", "David", "Emily", "Robert", "Laura", "James"];
const ATTORNEY_LAST = ["Goldberg", "Chen", "Murphy", "Patel", "Nguyen", "Cohen", "Brennan", "Kim"];
const STREETS = ["Main St", "Oak Ave", "Elm St", "Washington Blvd", "Maple Dr", "Beacon St", "Tremont St", "Highland Ave", "Summer St", "Cross St"];
const CITIES = ["Boston", "Chelsea", "Lynn", "Lawrence", "Worcester", "Springfield", "Cambridge", "Somerville", "Revere", "Everett", "Malden", "Brockton"];
const COUNTIES = ["Suffolk", "Essex", "Middlesex", "Worcester", "Hampden", "Norfolk"];
const NATIONALITIES = ["Guatemala", "Honduras", "El Salvador", "Mexico", "Brazil", "Haiti", "Ecuador", "Colombia"];

const ri = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = <T,>(arr: T[]): T => arr[ri(0, arr.length - 1)];
const pad = (n: number, l: number) => String(n).padStart(l, "0");
// type="date" inputs need yyyy-mm-dd to display a value.
const isoDate = (year: number) => `${year}-${pad(ri(1, 12), 2)}-${pad(ri(1, 28), 2)}`;
const phone = () => `617-${ri(200, 989)}-${pad(ri(0, 9999), 4)}`;
const zip = () => `0${ri(1000, 2999)}`;

function randomCase() {
    const thisYear = new Date().getFullYear();
    const familyName = pick(LAST_NAMES); // child + parent share a surname
    const county = pick(COUNTIES);
    const nationality = pick(NATIONALITIES);
    const birthYear = ri(thisYear - 20, thisYear - 3);

    const base = () => ({ ...blank(), state: "MA" });

    const plaintiff = {
        ...base(),
        first_name: pick(FIRST_NAMES),
        middle_name: pick(MIDDLE_NAMES),
        last_name: familyName,
        address: `${ri(1, 999)} ${pick(STREETS)}`,
        apartment_number: Math.random() < 0.5 ? `Apt ${ri(1, 40)}` : "",
        city: pick(CITIES),
        zip_code: zip(),
        county,
        age: thisYear - birthYear,
        birth_date: isoDate(birthYear),
        process_type: "SIJ",
        date_opened: isoDate(ri(thisYear - 2, thisYear)),
        nationality,
        case_no: `${ri(20, 25)}P${ri(1000, 9999)}EA`,
        i765_receipt_date: isoDate(ri(thisYear - 2, thisYear)),
        phone_cell: phone(),
    };

    const defendant = {
        ...base(),
        first_name: pick(FIRST_NAMES),
        middle_name: pick(MIDDLE_NAMES),
        last_name: familyName,
        address: `${ri(1, 999)} ${pick(STREETS)}`,
        apartment_number: Math.random() < 0.5 ? `Unit ${ri(1, 20)}` : "",
        city: pick(CITIES),
        zip_code: zip(),
        county,
        nationality,
    };

    const aFirst = pick(ATTORNEY_FIRST);
    const aLast = pick(ATTORNEY_LAST);
    const attorney = {
        ...base(),
        first_name: aFirst,
        middle_name: pick(MIDDLE_NAMES),
        last_name: aLast,
        address: `${ri(1, 999)} ${pick(STREETS)}`,
        apartment_number: `Suite ${ri(100, 900)}`,
        city: pick(CITIES),
        zip_code: zip(),
        phone_cell: phone(),
        bbo: String(ri(500000, 699999)),
        email: `${aFirst}.${aLast}@${pick(["legalaid", "justicecenter", "lawgroup"])}.org`.toLowerCase(),
        firm: `${aLast} ${pick(["Law Group", "Legal Services", "& Associates", "Immigration Law"])}`,
    };

    return { plaintiff, defendant, attorney };
}

export const FormFiller: React.FC<FormFillerProps> = ({ onDataChange }) => {
    const [activeTab, setActiveTab] = useState<PersonType>("plaintiff");
    const [plaintiffData, setPlaintiffData] = useState<Record<string, any>>(
        blank()
    );
    const [defendantData, setDefendantData] = useState<Record<string, any>>(
        blank()
    );
    const [attorneyData, setAttorneyData] = useState<Record<string, any>>(
        blank()
    );
    const [toast, setToast] = useState("");

    const dataFor = (tab: PersonType) =>
        tab === "plaintiff"
            ? plaintiffData
            : tab === "defendant"
            ? defendantData
            : attorneyData;

    const hasName = (tab: PersonType) => {
        const d = dataFor(tab);
        return Boolean(
            (d.first_name && String(d.first_name).trim()) ||
                (d.last_name && String(d.last_name).trim())
        );
    };

    const handleFieldChange = useCallback(
        (field: string, value: string | number) => {
            if (value === undefined || value === null || value === "undefined")
                value = "";
            if (typeof value === "number" && isNaN(value)) value = "";

            const apply = (
                prev: Record<string, any>,
                set: (d: Record<string, any>) => void
            ) => {
                const next = { ...prev, [field]: value };
                set(next);
                onDataChange(activeTab, next);
            };

            if (activeTab === "plaintiff") apply(plaintiffData, setPlaintiffData);
            else if (activeTab === "defendant")
                apply(defendantData, setDefendantData);
            else apply(attorneyData, setAttorneyData);
        },
        [activeTab, plaintiffData, defendantData, attorneyData, onDataChange]
    );

    // Fill all three tabs with random sample data.
    const fillRandom = useCallback(() => {
        const { plaintiff, defendant, attorney } = randomCase();
        setPlaintiffData(plaintiff);
        setDefendantData(defendant);
        setAttorneyData(attorney);
        onDataChange("plaintiff", plaintiff);
        onDataChange("defendant", defendant);
        onDataChange("attorney", attorney);
        setToast("Filled with random test data");
    }, [onDataChange]);

    // Listen for the trigger word typed anywhere except inside a field.
    useEffect(() => {
        let buffer = "";
        const onKey = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement | null;
            const tag = el?.tagName?.toLowerCase();
            if (
                tag === "input" ||
                tag === "textarea" ||
                tag === "select" ||
                el?.isContentEditable
            ) {
                return;
            }
            if (e.key && e.key.length === 1) {
                buffer = (buffer + e.key.toLowerCase()).slice(-TRIGGER_WORD.length);
                if (buffer === TRIGGER_WORD) {
                    buffer = "";
                    fillRandom();
                }
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [fillRandom]);

    // Auto-dismiss the toast.
    useEffect(() => {
        if (!toast) return;
        const id = window.setTimeout(() => setToast(""), 2500);
        return () => window.clearTimeout(id);
    }, [toast]);

    const data = dataFor(activeTab);

    return (
        <div className='people-selector form-filler'>
            {toast && <div className='form-only-toast'>{toast}</div>}
            {/* Tabs */}
            <div className='tabs'>
                {TAB_TYPES.map((tab) => (
                    <button
                        key={tab}
                        type='button'
                        className={`tab ${activeTab === tab ? "active" : ""}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {hasName(tab) && <span className='selection-dot' />}
                        {TAB_META[tab].title}
                    </button>
                ))}
            </div>

            {/* Single, centered form for the active tab */}
            <div className='form-only-body'>
                <div className='form-container'>
                    <h2>{TAB_META[activeTab].title}</h2>
                    <form
                        className='form-only-grid'
                        onSubmit={(e) => e.preventDefault()}
                    >
                        {fieldsForTab(activeTab).map((f) => (
                            <label key={f.key}>
                                {f.label}
                                <input
                                    type={f.type}
                                    className='search-input'
                                    value={data[f.key] || ""}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        let val: string | number = raw;
                                        if (f.type === "number") {
                                            val = raw === "" ? "" : Number(raw);
                                            if (
                                                typeof val === "number" &&
                                                isNaN(val)
                                            )
                                                val = "";
                                        }
                                        handleFieldChange(f.key, val);
                                    }}
                                />
                            </label>
                        ))}
                    </form>
                </div>
            </div>
        </div>
    );
};
