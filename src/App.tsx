// App.tsx — form-only flow: fill an in-website form, then produce the forms.
import React, { useState, useCallback } from "react";
import { FormFiller, PersonType } from "./components/FormFiller.tsx";
import { GeneratedFiles } from "./components/GeneratedFiles.tsx";
import { useProcessFiles } from "./hooks/useProcessFiles.ts";
import "./App.css";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";

// The fields the generated forms can actually consume.
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
    "bbo",
    "email",
    "firm",
];

const normalize = (data: Record<string, any>) => {
    const out: Record<string, any> = {};
    for (const k of personKeys) {
        const v = data?.[k];
        out[k] = v === undefined || v === null || v === "undefined" ? "" : v;
    }
    return out;
};

// Form page: in-website form + "Produce forms" button.
interface FormPageProps {
    onDataChange: (type: PersonType, data: Record<string, any>) => void;
    onGenerate: () => void;
    isProcessing: boolean;
    canGenerate: boolean;
}
const FormPage: React.FC<FormPageProps> = ({
    onDataChange,
    onGenerate,
    isProcessing,
    canGenerate,
}) => (
    <div className='form-only-page'>
        <header className='form-only-topbar'>
            <span className='form-only-name'>SIJ Form Filler</span>
            <span
                className='form-only-info'
                tabIndex={0}
                role='button'
                aria-label='About this tool'
            >
                <span className='form-only-info-icon' aria-hidden='true'>
                    i
                </span>
                <span className='form-only-tooltip' role='tooltip'>
                    Enter the case details below, then produce the court forms.
                    Enter information about the child, parent, and attorney.
                    Only trivial fields are filled, with narrative answers left
                    blank for you to complete.
                </span>
            </span>
        </header>

        <FormFiller onDataChange={onDataChange} />

        <div className='form-only-actions'>
            {!canGenerate && (
                <span className='form-only-hint'>
                    Enter at least the child's first and last name to continue.
                </span>
            )}
            <button
                className='submit-button form-only-submit'
                disabled={isProcessing || !canGenerate}
                onClick={() => {
                    if (!isProcessing && canGenerate) onGenerate();
                }}
            >
                {isProcessing ? "Producing forms…" : "Produce forms"}
            </button>
        </div>
    </div>
);

const App: React.FC = () => {
    const [plaintiffData, setPlaintiffData] = useState<Record<string, any>>({});
    const [defendantData, setDefendantData] = useState<Record<string, any>>({});
    const [attorneyData, setAttorneyData] = useState<Record<string, any>>({});

    const { isProcessing, error, generatedFiles, processFiles, onDownloadAll } =
        useProcessFiles();

    const handleDataChange = useCallback(
        (type: PersonType, data: Record<string, any>) => {
            if (type === "plaintiff") setPlaintiffData(data);
            else if (type === "defendant") setDefendantData(data);
            else setAttorneyData(data);
        },
        [],
    );

    const navigate = useNavigate();
    const handleGenerate = useCallback(async () => {
        await processFiles(
            [], // form-only: no Excel input, data comes straight from the form
            normalize(plaintiffData),
            normalize(defendantData),
            normalize(attorneyData),
        );
        navigate("/download");
    }, [processFiles, navigate, plaintiffData, defendantData, attorneyData]);

    const canGenerate = Boolean(
        String(plaintiffData.first_name || "").trim() &&
        String(plaintiffData.last_name || "").trim(),
    );

    return (
        <div className='App'>
            <Routes>
                <Route
                    path='/'
                    element={
                        <FormPage
                            onDataChange={handleDataChange}
                            onGenerate={handleGenerate}
                            isProcessing={isProcessing}
                            canGenerate={canGenerate}
                        />
                    }
                />
                <Route
                    path='/download'
                    element={
                        generatedFiles.length === 0 ? (
                            <Navigate to='/' />
                        ) : (
                            <div className='download-container'>
                                <div className='right-panel'>
                                    <section className='files-section'>
                                        <GeneratedFiles
                                            files={generatedFiles}
                                            onDownloadAll={onDownloadAll}
                                        />
                                    </section>
                                </div>
                            </div>
                        )
                    }
                />
            </Routes>
            {error && <div className='error-message'>{error}</div>}
        </div>
    );
};

export default App;
