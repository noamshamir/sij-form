import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadIcon } from "./icons/UploadIcon.tsx";
import "./FileUploader.css";

interface FileUploaderProps {
    onUpload: (files: File[]) => void;
    accept?: string[];
}

export const FileUploader: React.FC<FileUploaderProps> = ({
    onUpload,
    accept = [".xlsx", ".xls", ".csv"],
}) => {
    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            onUpload(acceptedFiles);
        },
        [onUpload]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: accept.reduce(
            (acc, curr) => ({
                ...acc,
                [curr]: [],
            }),
            {}
        ),
        multiple: true,
    });

    return (
        <div
            {...getRootProps()}
            className={`file-uploader ${isDragActive ? "dragging" : ""}`}
        >
            <input {...getInputProps()} />
            <div className='upload-content'>
                <UploadIcon className='upload-icon' />
                <p>Drag and drop your files here or click to upload</p>
            </div>
        </div>
    );
};
