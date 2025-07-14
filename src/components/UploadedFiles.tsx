import React from "react";
import { TrashIcon } from "./icons/TrashIcon.tsx";
import "./UploadedFiles.css";

interface UploadedFile {
    id: string;
    name: string;
    file: File;
}

interface UploadedFilesProps {
    files: UploadedFile[];
    onRemove: (id: string) => void;
}

export const UploadedFiles: React.FC<UploadedFilesProps> = ({
    files,
    onRemove,
}) => {
    if (files.length === 0) {
        return <div className='no-files'>No files uploaded</div>;
    }

    return (
        <div className='uploaded-files'>
            {files.map((file) => (
                <div key={file.id} className='file-item'>
                    <div className='file-name'>{file.name}</div>
                    <div className='file-actions'>
                        <button
                            className='action-button trash'
                            onClick={() => onRemove(file.id)}
                            title='Trash'
                        >
                            <TrashIcon />
                            <span>Trash</span>
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};
