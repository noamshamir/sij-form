import React from "react";
import { DownloadIcon } from "./icons/DownloadIcon.tsx";
import "./GeneratedFiles.css";

interface GeneratedFile {
    id: string;
    name: string;
    url: string;
}

interface GeneratedFilesProps {
    files: GeneratedFile[];
    onDownloadAll: () => void;
}

export const GeneratedFiles: React.FC<GeneratedFilesProps> = ({
    files,
    onDownloadAll,
}) => {
    if (files.length === 0) {
        return <div className='generated-no-files'>No generated files yet</div>;
    }

    return (
        <>
            {/* Header row with title + Download All */}
            <div className='generated-files-header'>
                <h2 className='generated-files-title'>Files</h2>
                <button
                    onClick={onDownloadAll}
                    className='generated-download-all-button'
                >
                    Download All
                </button>
            </div>

            {/* List of individual files */}
            <div className='generated-files-list'>
                {files.map((file) => (
                    <div key={file.id} className='generated-file-item'>
                        <div className='generated-file-name'>{file.name}</div>
                        <div className='generated-file-actions'>
                            <a
                                href={file.url}
                                download
                                className='generated-action-button generated-download-button'
                                title='Download'
                            >
                                <DownloadIcon />
                                <span>Download</span>
                            </a>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};
