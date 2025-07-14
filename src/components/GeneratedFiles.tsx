import React from "react";
import { ViewIcon } from "./icons/ViewIcon.tsx";
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
        return <div className='no-files'>No generated files yet</div>;
    }

    return (
        <div className='generated-files'>
            {files.map((file) => (
                <div key={file.id} className='file-item'>
                    <div className='file-name'>{file.name}</div>
                    <div className='file-actions'>
                        <a
                            href={file.url}
                            download
                            className='action-button download'
                            title='Download'
                        >
                            <DownloadIcon />
                            <span>Download</span>
                        </a>
                    </div>
                </div>
            ))}
        </div>
    );
};
