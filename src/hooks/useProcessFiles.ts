// src/hooks/useProcessFiles.ts
import { useState } from 'react';
import { processExcelFiles, downloadFile } from '../backend/main';
import JSZip from 'jszip';

interface GeneratedFile {
  id: string;
  name: string;
  blob: Blob;
  url: string;
}

export const useProcessFiles = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);

  const processFiles = async (
    files: File[],
    plaintiffName: string,
    defendantName: string,
    attorneyName: string
  ) => {
    setIsProcessing(true);
    setError(null);
    setGeneratedFiles([]);

    try {
      // Call the JS-only backend instead of fetch
      const outputs = await processExcelFiles(
        files,
        plaintiffName,
        defendantName,
        attorneyName
      );

      // Convert each Blob into a downloadable URL
      const mapped = outputs.map((o) => {
        const url = URL.createObjectURL(o.blob);
        return {
          id: Math.random().toString(36).substring(2),
          name: o.name,
          blob: o.blob,
          url,
        };
      });

      setGeneratedFiles(mapped);
    } catch (err: any) {
      console.error('Processing error:', err);
      setError(err?.message || 'An error occurred while processing files');
    } finally {
      setIsProcessing(false);
    }
  };

  const onDownloadAll = async () => {
    const zip = new JSZip();
    generatedFiles.forEach((f) => {
      zip.file(f.name, f.blob);
    });
    const zipBlob = await zip.generateAsync({ type: 'blob'});
    const zipBaseName = generatedFiles[0]?.name.split('/')[0] || 'documents';
    downloadFile(zipBlob, `${zipBaseName}.zip`);
  };
    
  

  return {
    isProcessing,
    error,
    generatedFiles,
    processFiles,
    onDownloadAll,
    setError,
  };
};