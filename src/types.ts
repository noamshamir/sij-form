export interface Person {
    id: string;
    name: string;
    type: "plaintiff" | "defendant" | "attorney";
}

export interface UploadedFile {
    id: string;
    name: string;
    file: File;
}

export interface GeneratedFile {
    id: string;
    name: string;
    url: string;
}

export interface NamesResponse {
    names: string[];
}