// src/components/PeopleSelector.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Person } from "../types";
import { getNames } from "../backend/main"; // adjust path as needed
import "./PeopleSelector.css";

interface PeopleSelectorProps {
    onSelect: (
        type: "plaintiff" | "defendant" | "attorney",
        person: Person
    ) => void;
    selected: {
        plaintiff?: Person;
        defendant?: Person;
        attorney?: Person;
    };
    excelFiles?: File[];
}

export const PeopleSelector: React.FC<PeopleSelectorProps> = ({
    onSelect,
    selected,
    excelFiles,
}) => {
    const [activeTab, setActiveTab] = useState<
        "plaintiff" | "defendant" | "attorney"
    >("plaintiff");
    const [searchTerm, setSearchTerm] = useState("");
    const [names, setNames] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch names when files change, using in-browser backend
    // Fetch names when files change, using in-browser backend
    useEffect(() => {
        if (!excelFiles?.length) {
            setNames([]);
            return;
        }

        const loadNames = async () => {
            setLoading(true);
            setError(null);

            try {
                const fetchedNames = await getNames(excelFiles);
                setNames(fetchedNames);
            } catch (err: any) {
                console.error("Error fetching names:", err);
                setError(err?.message || "Failed to fetch names");
            } finally {
                setLoading(false);
            }
        };

        loadNames();
    }, [excelFiles]);

    // Filter names by searchTerm (prefix/contains)
    const filteredNames = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        return names.filter((name) => name.toLowerCase().includes(term));
    }, [names, searchTerm]);

    const handleSelect = useCallback(
        (name: string) => {
            const person: Person = { id: name, name, type: activeTab };
            onSelect(activeTab, person);
            setSearchTerm("");
        },
        [activeTab, onSelect]
    );

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    return (
        <div className='people-selector'>
            <div className='tabs'>
                {(["plaintiff", "defendant", "attorney"] as const).map(
                    (tab) => (
                        <button
                            key={tab}
                            className={`tab ${
                                activeTab === tab ? "active" : ""
                            }`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {selected[tab] && (
                                <span className='selection-dot' />
                            )}
                            {selected[tab]?.name ||
                                tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    )
                )}
            </div>

            <div className='search-container'>
                <input
                    type='text'
                    value={searchTerm}
                    onChange={handleSearchChange}
                    placeholder={`${
                        selected[activeTab] ? "Change" : "Search for"
                    } ${activeTab}...`}
                    className='search-input'
                    disabled={loading || !!error}
                />

                {loading && <div className='loading'>Loading names...</div>}
                {error && <div className='error'>{error}</div>}

                {!loading && !error && (
                    <div className='search-results'>
                        {searchTerm ? (
                            filteredNames.length > 0 ? (
                                filteredNames.map((name) => (
                                    <button
                                        key={name}
                                        className='search-result-item'
                                        onClick={() => handleSelect(name)}
                                    >
                                        {name}
                                    </button>
                                ))
                            ) : (
                                <div className='no-results'>
                                    No matches found
                                </div>
                            )
                        ) : (
                            <div className='no-results'>
                                Start typing to filter...
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
