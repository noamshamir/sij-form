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
  const [activeTab, setActiveTab] = useState<typeof TAB_TYPES[number]>(
    "plaintiff"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for each tab’s form
  const [plaintiffData, setPlaintiffData] = useState<Record<string, any>>(
    Object.fromEntries(formFields.map(f => [f.key, ""]))
  );
  const [defendantData, setDefendantData] = useState<Record<string, any>>(
    Object.fromEntries(formFields.map(f => [f.key, ""]))
  );
  const [attorneyData, setAttorneyData] = useState<Record<string, any>>(
    Object.fromEntries(formFields.map(f => [f.key, ""]))
  );

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
    return names.filter(n => n.toLowerCase().includes(term));
  }, [names, searchTerm]);

  // When a name is selected from the search list,
  // load full data and populate the corresponding form
  const selectedName = selected[activeTab]?.name;
  useEffect(() => {
    if (!selectedName) return;
    loadPersonData(selectedName, excelFiles!)
      .then(person => {
        if (!person) return;
        if (activeTab === "plaintiff") {
               setPlaintiffData(person);
                   onDataChange("plaintiff", person);
                 }
                 else if (activeTab === "defendant") {
                           setDefendantData(person);
                           onDataChange("defendant", person);
                         }
                         else {
                               setAttorneyData(person);
                                   onDataChange("attorney", person);
                                 }

        // Notify parent
        onSelect(activeTab, {
          id: person.full_name,
          name: person.full_name,
          type: activeTab,
        });
      })
      .catch(console.error);
  }, [selectedName, excelFiles, activeTab, onSelect]);

  // Generic handler for manual edits
  const handleFieldChange = useCallback(
    (field: string, value: string | number) => {
      let newData: Record<string, any>;
      if (activeTab === "plaintiff") {
        newData = { ...plaintiffData, [field]: value };
        setPlaintiffData(newData);
        onDataChange("plaintiff", newData);
      } else if (activeTab === "defendant") {
        newData = { ...defendantData, [field]: value };
        setDefendantData(newData);
        onDataChange("defendant", newData);
      } else {
        newData = { ...attorneyData, [field]: value };
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
      onSelect(activeTab, { id: fullName, name: fullName, type: activeTab });
    },
    [
      activeTab,
      plaintiffData,
      defendantData,
      attorneyData,
      onSelect,
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
        {formFields.map(f => (
          <label key={f.key}>
            {f.label}
            <input
              type={f.type}
              className="search-input"
              value={data[f.key] || ""}
              onChange={e =>
                handleFieldChange(
                  f.key,
                  f.type === "number" ? +e.target.value : e.target.value
                )
              }
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
    },
    [activeTab, onSelect]
  );

  return (
    <div className="people-selector">
      {/* Tabs */}
      <div className="tabs">
        {TAB_TYPES.map(tab => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => {
              setActiveTab(tab);
              setSearchTerm("");
            }}
          >
            {selected[tab] && <span className="selection-dot" />}
            {selected[tab]?.name ||
              tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Search & Form Split */}
      <div className="select-people">
        {/* Left: Excel Search */}
        <div className="search-container">
          <h2>
            Select{" "}
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} from
            Excel
          </h2>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={`${
              selected[activeTab] ? "Change" : "Search for"
            } ${activeTab}…`}
            className="search-input"
            disabled={loading || !!error}
          />
          {error && <div className="error">{error}</div>}
          {!loading && !error && (
            <div className="search-results">
              {searchTerm &&
                filteredNames.map(name => (
                  <button
                    key={name}
                    className="search-result-item"
                    onClick={() => handleSelectName(name)}
                  >
                    {name}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Right: Create / Edit Form */}
        <div className="form-container">
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