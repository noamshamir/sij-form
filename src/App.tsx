// App.tsx
import React, { useState, useCallback, useEffect } from "react";
import { FileUploader } from "./components/FileUploader.tsx";
import { UploadedFiles } from "./components/UploadedFiles.tsx";
import { PeopleSelector } from "./components/PeopleSelector.tsx";
import { GeneratedFiles } from "./components/GeneratedFiles.tsx";
import { useProcessFiles } from "./hooks/useProcessFiles.ts";
import { UploadedFile, Person } from "./types.ts";
import type { GeneratedFile } from "./hooks/useProcessFiles";
import { getHeaders } from "./backend/main";
import "./App.css";
import "./GuideSection.css";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";

interface NextButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    to: string;
    disabled: boolean;
    children?: React.ReactNode;
    onClick?: () => void;
}

const NextButton: React.FC<NextButtonProps> = ({
    to,
    disabled,
    children,
    onClick,
    ...rest
}) => {
    const navigate = useNavigate();
    return (
        <button
            className='submit-button'
            disabled={disabled}
            onClick={(e) => {
                if (onClick) {
                    e.preventDefault();
                    if (!disabled) onClick();
                } else {
                    if (!disabled) navigate(to);
                }
            }}
            {...rest}
        >
            {children || "Next"}
        </button>
    );
};

// Upload instructions side panel
const GuideSection: React.FC = () => (
    <aside className='guide-panel'>
        <h2>How to Prepare Your Excel Report</h2>
        <ol className='guide-steps'>
            <li>
                <strong>Create a new report template</strong>
                <p>
                    In the left-hand nav, click <b>Reports</b> →{" "}
                    <b>Add New Template</b> → choose your object (Address Book,
                    Cases, etc.).
                </p>
            </li>
            <li>
                <strong>Configure the columns</strong>
                <p>
                    Switch to the <b>Report Columns</b> tab and add every field
                    your import expects. Use these exact headers:
                </p>
                <div className='guide-columns-grid'>
                    {[
                        "Beneficiary First Name",
                        "Beneficiary Middle Name",
                        "Beneficiary Last Name",
                        "Address‑Current Line 1",
                        "Address‑Current Line 2",
                        "Address‑Current City",
                        "Address‑Current State",
                        "Address‑Current Zip",
                        "Address‑Current County",
                        "Phone‑Cell",
                        "Age",
                        "Birth Date",
                        "Process Type",
                        "Date Opened",
                        "Nationality",
                        "Case No",
                        "I‑765 Receipt Date",
                    ].map((col) => (
                        <span key={col} className='column-pill'>
                            {col}
                        </span>
                    ))}
                </div>
            </li>
            <li>
                <strong>Run and export</strong>
                <p>
                    Save the template, click <b>Run</b>, then{" "}
                    <b>Export → Excel</b> to download your .xlsx.
                </p>
            </li>
            <li>
                <strong>Roles</strong>
                <p>
                    For each person (child/plaintiff, parent(s)/defendant,
                    attorney) you may choose to include their data in the excel
                    or fill it later.
                </p>
            </li>
            <li>
                <strong>Merge exports</strong>
                <p>
                    You can upload multiple excels and they will be
                    automatically merged.
                </p>
            </li>
        </ol>
    </aside>
);

// Upload page
interface UploadPageProps {
    uploadedFiles: UploadedFile[];
    handleFileUpload: (files: File[]) => void;
    handleRemoveFile: (id: string) => void;
}
const UploadPage: React.FC<UploadPageProps> = ({
    uploadedFiles,
    handleFileUpload,
    handleRemoveFile,
}) => (
    <div className='upload-container'>
        <div
            className='upload-panel'
            style={{ width: "100%", paddingRight: 0 }}
        >
            <h2>Upload files</h2>
            <FileUploader onUpload={handleFileUpload} />
            <div className='uploaded-files'>
                <UploadedFiles
                    files={uploadedFiles}
                    onRemove={handleRemoveFile}
                />
            </div>
            <div className='generate-button-container'>
                <NextButton
                    to='/people'
                    disabled={uploadedFiles.length === 0}
                />
            </div>
        </div>
    </div>
);

// People selection page
interface PeoplePageProps {
    uploadedFiles: UploadedFile[];
    selectedPeople: {
        plaintiff?: Person;
        defendant?: Person;
        attorney?: Person;
    };
    handlePersonSelect: (
        type: keyof PeoplePageProps["selectedPeople"],
        person: Person
    ) => void;
    handlePersonDataChange: (
        type: keyof PeoplePageProps["selectedPeople"],
        data: Record<string, any>
    ) => void;
    onGenerate: () => void;
    isProcessing: boolean;
    isFormComplete: boolean;
}
const PeoplePage: React.FC<PeoplePageProps> = ({
    uploadedFiles,
    selectedPeople,
    handlePersonSelect,
    handlePersonDataChange,
    onGenerate,
    isProcessing,
    isFormComplete,
}) => (
    <div className='container'>
        <div className='left-panel'>
            <section className='people-section'>
                <PeopleSelector
                    onSelect={handlePersonSelect}
                    onDataChange={handlePersonDataChange}
                    selected={selectedPeople}
                    excelFiles={uploadedFiles.map((f) => f.file)}
                />
            </section>
            <div className='generate-button-container'>
                <NextButton
                    to={"#"}
                    disabled={isProcessing}
                    onClick={onGenerate}
                >
                    {isProcessing ? "Generating..." : "Generate"}
                </NextButton>
            </div>
        </div>
    </div>
);

// Download page
interface DownloadPageProps {
    generatedFiles: GeneratedFile[];
    onDownloadAll: () => void;
}
const DownloadPage: React.FC<DownloadPageProps> = ({
    generatedFiles,
    onDownloadAll,
}) => (
    <div className='download-container'>
        <div className='right-panel'>
            <section className='files-section'>
                <div className='files-header'></div>
                <GeneratedFiles
                    files={generatedFiles}
                    onDownloadAll={onDownloadAll}
                />
            </section>
        </div>
    </div>
);

// Main App
const App: React.FC = () => {
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [selectedPeople, setSelectedPeople] = useState<{
        plaintiff?: Person;
        defendant?: Person;
        attorney?: Person;
    }>({});
    const [headers, setHeaders] = useState<string[]>([]);
    const [plaintiffData, setPlaintiffData] = useState<Record<string, any>>({});
    const [defendantData, setDefendantData] = useState<Record<string, any>>({});
    const [attorneyData, setAttorneyData] = useState<Record<string, any>>({});

    const {
        isProcessing,
        error,
        generatedFiles,
        processFiles,
        onDownloadAll,
        setError,
    } = useProcessFiles();

    const handleFileUpload = useCallback((files: File[]) => {
        const newFiles = files.map((file) => ({
            id: Math.random().toString(36).substr(2),
            file,
            name: file.name,
        }));
        setUploadedFiles((prev) => [...prev, ...newFiles]);
    }, []);

    const handleRemoveFile = useCallback((id: string) => {
        setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
    }, []);

    const handlePersonSelect = useCallback(
        (type: keyof PeoplePageProps["selectedPeople"], person: Person) => {
            setSelectedPeople((prev) => {
                // Avoid updating state if the selection is identical to prevent render loops
                if (prev[type]?.name === person?.name) return prev;
                return { ...prev, [type]: person };
            });
        },
        []
    );
    // ↓↓↓ NEW: receive form-data updates from PeopleSelector ↓↓↓
    const handlePersonDataChange = useCallback(
        (
            type: keyof PeoplePageProps["selectedPeople"],
            data: Record<string, any>
        ) => {
            if (type === "plaintiff") setPlaintiffData(data);
            if (type === "defendant") setDefendantData(data);
            if (type === "attorney") setAttorneyData(data);
        },
        []
    );

    const navigate = useNavigate();
    const handleGenerate = useCallback(async () => {
        // allow missing people — pass along whatever data exists (may be empty)
        if (!uploadedFiles.length) {
            setError("Please upload at least one file");
            return;
        }
        // Ensure each person data object has all expected fields and no 'undefined' values
        const personKeys = [
            "first_name",
            "middle_name",
            "last_name",
            "address",
            "apartment_number",
            "city",
            "state",
            "zip_code",
            "county",
            "age",
            "birth_date",
            "process_type",
            "date_opened",
            "nationality",
            "case_no",
            "i765_receipt_date",
            "phone_cell",
        ];

        const normalize = (data: Record<string, any>) => {
            const out: Record<string, any> = {};
            for (const k of personKeys) {
                const v = data?.[k];
                if (v === undefined || v === null || v === "undefined")
                    out[k] = "";
                else out[k] = v;
            }
            return out;
        };

        const pPlaintiff = normalize(plaintiffData || {});
        const pDefendant = normalize(defendantData || {});
        const pAttorney = normalize(attorneyData || {});

        await processFiles(
            uploadedFiles.map((f) => f.file),
            pPlaintiff,
            pDefendant,
            pAttorney
        );
        navigate("/download");
    }, [
        uploadedFiles,
        selectedPeople,
        processFiles,
        setError,
        navigate,
        plaintiffData,
        defendantData,
        attorneyData,
    ]);

    // form is considered ready when files have been uploaded; people are optional
    const isFormComplete = uploadedFiles.length > 0;

    useEffect(() => {
        if (!uploadedFiles.length) return setHeaders([]);
        getHeaders(uploadedFiles.map((f) => f.file))
            .then(setHeaders)
            .catch(console.error);
    }, [uploadedFiles]);

    return (
        <div className='App'>
            <Routes>
                <Route
                    path='/'
                    element={
                        <UploadPage
                            uploadedFiles={uploadedFiles}
                            handleFileUpload={handleFileUpload}
                            handleRemoveFile={handleRemoveFile}
                        />
                    }
                />
                <Route
                    path='/people'
                    element={
                        uploadedFiles.length === 0 ? (
                            <Navigate to='/' />
                        ) : (
                            <PeoplePage
                                uploadedFiles={uploadedFiles}
                                selectedPeople={selectedPeople}
                                handlePersonSelect={handlePersonSelect}
                                handlePersonDataChange={handlePersonDataChange}
                                onGenerate={handleGenerate}
                                isProcessing={isProcessing}
                                isFormComplete={isFormComplete}
                            />
                        )
                    }
                />
                <Route
                    path='/download'
                    element={
                        !uploadedFiles.length ? (
                            <Navigate to='/' />
                        ) : (
                            <DownloadPage
                                generatedFiles={generatedFiles}
                                onDownloadAll={onDownloadAll}
                            />
                        )
                    }
                />
            </Routes>
            {error && <div className='error-message'>{error}</div>}
        </div>
    );
};

export default App;
