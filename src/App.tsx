import React, { useState, useCallback, useEffect } from "react";
import { FileUploader } from "./components/FileUploader.tsx";
import { UploadedFiles } from "./components/UploadedFiles.tsx";
import { PeopleSelector } from "./components/PeopleSelector.tsx";
import { GeneratedFiles } from "./components/GeneratedFiles.tsx";
import { useProcessFiles } from "./hooks/useProcessFiles.ts";
import { UploadedFile, Person } from "./types.ts";
import { getHeaders } from "./backend/main";
import "./App.css";

const App: React.FC = () => {
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [selectedPeople, setSelectedPeople] = useState<{
        plaintiff?: Person;
        defendant?: Person;
        attorney?: Person;
    }>({});
    const [headers, setHeaders] = useState<string[]>([]);

    const {
        isProcessing,
        error,
        generatedFiles,
        processFiles,
        onDownloadAll, // ← grab the helper
        setError,
    } = useProcessFiles();

    const handleFileUpload = useCallback((files: File[]) => {
        const newFiles: UploadedFile[] = files.map((file) => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            name: file.name,
        }));
        setUploadedFiles((prev) => [...prev, ...newFiles]);
    }, []);

    const handleRemoveFile = useCallback((id: string) => {
        setUploadedFiles((prev) => prev.filter((file) => file.id !== id));
    }, []);

    const handlePersonSelect = useCallback(
        (type: "plaintiff" | "defendant" | "attorney", person: Person) => {
            setSelectedPeople((prev) => ({
                ...prev,
                [type]: person,
            }));
        },
        []
    );

    const handleSubmit = useCallback(async () => {
        if (
            !selectedPeople.plaintiff ||
            !selectedPeople.defendant ||
            !selectedPeople.attorney
        ) {
            setError("Please select all required people");
            return;
        }

        if (uploadedFiles.length === 0) {
            setError("Please upload at least one file");
            return;
        }

        await processFiles(
            uploadedFiles.map((f) => f.file),
            selectedPeople.plaintiff.name,
            selectedPeople.defendant.name,
            selectedPeople.attorney.name
        );
    }, [uploadedFiles, selectedPeople, processFiles, setError]);

    const isFormComplete =
        uploadedFiles.length > 0 &&
        selectedPeople.plaintiff &&
        selectedPeople.defendant &&
        selectedPeople.attorney;

    useEffect(() => {
        if (!uploadedFiles.length) {
            setHeaders([]);
            return;
        }
        getHeaders(uploadedFiles.map((f) => f.file))
            .then((hdrs) => setHeaders(hdrs))
            .catch((err) => console.error("Error reading headers:", err));
    }, [uploadedFiles]);

    return (
        <div className='App'>
            <div className='container'>
                <div className='left-panel'>
                    <section className='upload-section'>
                        <h2>Upload files</h2>
                        <FileUploader onUpload={handleFileUpload} />
                        <UploadedFiles
                            files={uploadedFiles}
                            onRemove={handleRemoveFile}
                        />
                    </section>

                    <section className='people-section'>
                        <h2>Select people</h2>
                        <PeopleSelector
                            onSelect={handlePersonSelect}
                            selected={selectedPeople}
                            excelFiles={uploadedFiles.map((f) => f.file)}
                        />
                    </section>
                    <section className='generate-button-container'>
                        <button
                            onClick={handleSubmit}
                            className='submit-button'
                            disabled={!isFormComplete || isProcessing}
                        >
                            {isProcessing ? "Generating..." : "Generate"}
                        </button>
                    </section>
                </div>

                <div className='right-panel'>
                    <section className='files-section'>
                        <div className='files-header'>
                            <h2>Files</h2>
                            {generatedFiles.length > 0 && (
                                <button
                                    onClick={onDownloadAll}
                                    className='download-all-button'
                                >
                                    Download All
                                </button>
                            )}
                        </div>
                        <GeneratedFiles
                            files={generatedFiles}
                            onDownloadAll={onDownloadAll}
                        />
                    </section>
                </div>
            </div>
        </div>
    );
};

export default App;
