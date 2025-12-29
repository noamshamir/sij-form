// src/components/PeopleSelector.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Person } from "../types";
import { getNames } from "../backend/main";
import { loadPersonData } from "../backend/people_selector";
import "./PeopleSelector.css";

interface PeopleSelectorProps {
    onSelect: (
        type: "plaintiff" | "defendant" | "attorney",
        person: Person
    ) => void;
    onDataChange: (
        type: "plaintiff" | "defendant" | "attorney",
        data: Record<string, any>
    ) => void;
    selected: {
        plaintiff?: Person;
        defendant?: Person;
        attorney?: Person;
    };
    excelFiles?: File[];
}

const TAB_TYPES = ["plaintiff", "defendant", "attorney"] as const;

// All 17 fields, in camelCase form matching processPersonData output
const formFields = [
    { key: "first_name", label: "Beneficiary First Name", type: "text" },
    { key: "middle_name", label: "Beneficiary Middle Name", type: "text" },
    { key: "last_name", label: "Beneficiary Last Name", type: "text" },
    { key: "address", label: "Address-Current Line 1", type: "text" },
    { key: "apartment_number", label: "Address-Current Line 2", type: "text" },
    { key: "city", label: "Address-Current City", type: "text" },
    { key: "state", label: "Address-Current State", type: "text" },
    { key: "zip_code", label: "Address-Current Zip", type: "text" },
    { key: "county", label: "Address-Current County", type: "text" },
    { key: "age", label: "Age", type: "number" },
    { key: "birth_date", label: "Birth Date", type: "date" },
    { key: "process_type", label: "Process Type", type: "text" },
    { key: "date_opened", label: "Date Opened", type: "date" },
    { key: "nationality", label: "Nationality", type: "text" },
    { key: "case_no", label: "Case No", type: "text" },
    { key: "i765_receipt_date", label: "I-765 Receipt Date", type: "date" },
    { key: "phone_cell", label: "Phone-Cell", type: "text" },
];

export const PeopleSelector: React.FC<PeopleSelectorProps> = ({
    onSelect,
    onDataChange,
    selected,
    excelFiles,
}) => {
    const [activeTab, setActiveTab] =
        useState<(typeof TAB_TYPES)[number]>("plaintiff");
    const [searchTerm, setSearchTerm] = useState("");
    const [names, setNames] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showResults, setShowResults] = useState(false);
    const blurTimeoutRef = React.useRef<number | null>(null);

    // State for each tab’s form
    const [plaintiffData, setPlaintiffData] = useState<Record<string, any>>(
        Object.fromEntries(formFields.map((f) => [f.key, ""]))
    );
    const [defendantData, setDefendantData] = useState<Record<string, any>>(
        Object.fromEntries(formFields.map((f) => [f.key, ""]))
    );
    const [attorneyData, setAttorneyData] = useState<Record<string, any>>(
        Object.fromEntries(formFields.map((f) => [f.key, ""]))
    );

    const sanitizePerson = (person: Record<string, any> | null | undefined) => {
        const base: Record<string, any> = Object.fromEntries(
            formFields.map((f) => [f.key, ""])
        );
        if (!person) return base;
        for (const f of formFields) {
            const v = person[f.key];
            if (v === undefined || v === null || v === "undefined")
                base[f.key] = "";
            else base[f.key] = v;
        }
        return base;
    };

    // Ensure any undefined/null/NaN values in a data object are converted to ""
    const sanitizeData = (data: Record<string, any>) => {
        const out: Record<string, any> = {};
        for (const f of formFields) {
            const v = data?.[f.key];
            if (v === undefined || v === null || v === "undefined") {
                out[f.key] = "";
            } else if (typeof v === "number" && isNaN(v)) {
                out[f.key] = "";
            } else {
                out[f.key] = v;
            }
        }
        return out;
    };

    // Load names from Excel
    useEffect(() => {
        if (!excelFiles?.length) {
            setNames([]);
            return;
        }
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const fetched = await getNames(excelFiles);
                setNames(fetched);
            } catch (err: any) {
                console.error(err);
                setError(err.message || "Failed to fetch names");
            } finally {
                setLoading(false);
            }
        })();
    }, [excelFiles]);

    const filteredNames = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        return names.filter((n) => n.toLowerCase().includes(term));
    }, [names, searchTerm]);

    // Log filtered results when the search term or available names change
    useEffect(() => {}, [filteredNames]);

    // When a name is selected from the search list,
    // load full data and populate the corresponding form
    const selectedName = selected[activeTab]?.name;
    useEffect(() => {
        if (!selectedName || !excelFiles?.length) return;
        console.log(
            `PeopleSelector: loading selectedName='${selectedName}' for tab='${activeTab}'`
        );
        loadPersonData(selectedName, excelFiles)
            .then((person: any) => {
                if (!person) {
                    console.log(
                        `PeopleSelector: loadPersonData returned null for '${selectedName}'`
                    );
                    return;
                }

                console.log(
                    `PeopleSelector: loaded person for '${selectedName}' ->`,
                    person
                );

                const clean = sanitizePerson(person);
                const safe = sanitizeData(clean);
                if (activeTab === "plaintiff") {
                    setPlaintiffData(safe);
                    onDataChange("plaintiff", safe);
                } else if (activeTab === "defendant") {
                    setDefendantData(safe);
                    onDataChange("defendant", safe);
                } else {
                    setAttorneyData(safe);
                    onDataChange("attorney", safe);
                }

                // Build a safe full name for selection (may be blank)
                const fullName = [
                    clean.first_name,
                    clean.middle_name,
                    clean.last_name,
                ]
                    .filter(Boolean)
                    .join(" ");

                // Do NOT re-notify parent selection here — parent already
                // received the selection when the user clicked. Avoiding
                // redundant onSelect calls prevents re-render loops that
                // can cause the input's focus to rapidly toggle.
            })
            .catch((err) => {
                console.error("PeopleSelector: loadPersonData error:", err);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedName, excelFiles, activeTab, onSelect]);

    // Generic handler for manual edits
    const handleFieldChange = useCallback(
        (field: string, value: string | number) => {
            console.log(
                `PeopleSelector: handleFieldChange field='${field}' value=`,
                value
            );
            // Normalize undefined/NaN to empty string per requirement
            if (
                value === undefined ||
                value === null ||
                value === "undefined"
            ) {
                value = "";
            }
            if (typeof value === "number" && isNaN(value)) {
                value = "";
            }

            let newData: Record<string, any>;
            if (activeTab === "plaintiff") {
                newData = { ...plaintiffData, [field]: value };
                newData = sanitizeData(newData);
                setPlaintiffData(newData);
                onDataChange("plaintiff", newData);
            } else if (activeTab === "defendant") {
                newData = { ...defendantData, [field]: value };
                newData = sanitizeData(newData);
                setDefendantData(newData);
                onDataChange("defendant", newData);
            } else {
                newData = { ...attorneyData, [field]: value };
                newData = sanitizeData(newData);
                setAttorneyData(newData);
                onDataChange("attorney", newData);
            }

            // Build full_name from parts
            const fullName = [
                newData.first_name,
                newData.middle_name,
                newData.last_name,
            ]
                .filter(Boolean)
                .join(" ");
            onSelect(activeTab, {
                id: fullName,
                name: fullName,
                type: activeTab,
            });
        },
        [
            activeTab,
            plaintiffData,
            defendantData,
            attorneyData,
            onSelect,
            onDataChange,
        ]
    );

    // Render the form fields for the current tab
    const renderForm = () => {
        const data =
            activeTab === "plaintiff"
                ? plaintiffData
                : activeTab === "defendant"
                ? defendantData
                : attorneyData;

        return (
            <form>
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
                                    // keep empty string as-is, otherwise coerce to number
                                    val = raw === "" ? "" : Number(raw);
                                    if (typeof val === "number" && isNaN(val))
                                        val = "";
                                }
                                handleFieldChange(f.key, val);
                            }}
                        />
                    </label>
                ))}
            </form>
        );
    };

    // When a name is clicked in search results:
    const handleSelectName = useCallback(
        (name: string) => {
            onSelect(activeTab, { id: name, name, type: activeTab });
            setSearchTerm("");
            // Hide results immediately and cancel any pending blur hide
            setShowResults(false);
            if (blurTimeoutRef.current) {
                window.clearTimeout(blurTimeoutRef.current);
                blurTimeoutRef.current = null;
            }
            // Blur the input to avoid focus/blur oscillation
            if (document.activeElement instanceof HTMLElement) {
                try {
                    document.activeElement.blur();
                } catch (e) {
                    /* ignore */
                }
            }
        },
        [activeTab, onSelect]
    );

    return (
        <div className='people-selector'>
            {/* Tabs */}
            <div className='tabs'>
                {TAB_TYPES.map((tab) => (
                    <button
                        key={tab}
                        className={`tab ${activeTab === tab ? "active" : ""}`}
                        onClick={() => {
                            setActiveTab(tab);
                            setSearchTerm("");
                        }}
                    >
                        {selected[tab] && <span className='selection-dot' />}
                        {selected[tab]?.name ||
                            tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Search & Form Split */}
            <div className='select-people'>
                {/* Left: Excel Search */}
                <div className='search-container'>
                    <h2>
                        Select{" "}
                        {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}{" "}
                        from Excel
                    </h2>
                    <input
                        type='text'
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={() => {
                            // cancel pending blur hide
                            if (blurTimeoutRef.current) {
                                window.clearTimeout(blurTimeoutRef.current);
                                blurTimeoutRef.current = null;
                            }
                            setShowResults(true);
                        }}
                        onBlur={() => {
                            // hide results shortly after blur to allow click handlers
                            blurTimeoutRef.current = window.setTimeout(() => {
                                setShowResults(false);
                                blurTimeoutRef.current = null;
                            }, 150);
                        }}
                        placeholder={`${
                            selected[activeTab] ? "Change" : "Search for"
                        } ${activeTab}…`}
                        className='search-input'
                        disabled={loading || !!error}
                    />
                    {error && <div className='error'>{error}</div>}
                    {!loading && !error && (
                        <div className='search-results'>
                            {showResults &&
                                filteredNames.map((name, idx) => (
                                    <button
                                        key={`${name}-${idx}`}
                                        className='search-result-item'
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => handleSelectName(name)}
                                    >
                                        {name}
                                    </button>
                                ))}
                        </div>
                    )}
                </div>

                {/* Right: Create / Edit Form */}
                <div className='form-container'>
                    <h2>
                        Create/Edit{" "}
                        {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                    </h2>
                    {renderForm()}
                </div>
            </div>
        </div>
    );
};
