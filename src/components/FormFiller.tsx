// src/components/FormFiller.tsx
import React, { useState, useCallback } from "react";
import "./PeopleSelector.css";
import "./FormFiller.css";

export type PersonType = "plaintiff" | "defendant" | "attorney";

interface FormFillerProps {
    onDataChange: (type: PersonType, data: Record<string, any>) => void;
}

const TAB_TYPES: PersonType[] = ["plaintiff", "defendant", "attorney"];

// Friendly description of each role so the (shared) field set makes sense.
const TAB_META: Record<PersonType, { title: string; blurb: string }> = {
    plaintiff: {
        title: "Child (Plaintiff)",
        blurb: "The minor who is the subject of the petition.",
    },
    defendant: {
        title: "Parent (Defendant)",
        blurb: "A parent or prior custodian named in the case.",
    },
    attorney: {
        title: "Attorney",
        blurb: "The attorney appearing on behalf of the child.",
    },
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

const blank = () => Object.fromEntries(formFields.map((f) => [f.key, ""]));

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

    const data = dataFor(activeTab);

    return (
        <div className='people-selector form-filler'>
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
                    <p className='form-only-blurb'>
                        {TAB_META[activeTab].blurb}
                    </p>
                    <form
                        className='form-only-grid'
                        onSubmit={(e) => e.preventDefault()}
                    >
                        {formFields.map((f) => (
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
