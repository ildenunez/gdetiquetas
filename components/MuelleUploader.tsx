
import React from 'react';
import { MuelleData } from '../types.ts';
import { convertPdfToImages } from '../services/pdfService.ts';
import { extractMuelleDataFromImage } from '../services/geminiService.ts';

interface MuelleUploaderProps {
  onDataLoaded: (data: MuelleData[]) => void;
  isLoading: boolean;
  onLoadingChange: (loading: boolean) => void;
}

const MuelleUploader: React.FC<MuelleUploaderProps> = ({ onDataLoaded, isLoading, onLoadingChange }) => {
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onLoadingChange(true);
    
    try {
      if (file.type === 'application/pdf') {
        const pages = await convertPdfToImages(file);
        let allExtractedData: MuelleData[] = [];
        
        for (const page of pages) {
          const data = await extractMuelleDataFromImage(page.imageUrl);
          allExtractedData = [...allExtractedData, ...data];
        }
        
        onDataLoaded(allExtractedData);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          const rows = text.split('\n');
          const parsedData: MuelleData[] = rows
            .map(row => {
              const cols = row.split(/[,;\t]/).map(c => c.trim().replace(/"/g, ''));
              if (cols.length < 2) return null;
              const amazonRef = cols.find(c => c.startsWith('FBA') || c.length > 5) || cols[0];
              const orderNumber = cols.find(c => /^\d+$/.test(c)) || cols[1];
              return { amazonRef, orderNumber };
            })
            .filter((item): item is MuelleData => item !== null && item.amazonRef !== '' && item.orderNumber !== '');
          onDataLoaded(parsedData);
          onLoadingChange(false);
        };
        reader.readAsText(file);
      }
    } catch (err) {
      console.error("Error processing muelle file:", err);
      alert("Error al procesar el archivo muelle.");
    } finally {
      onLoadingChange(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        1. Subir Listado de Ruta (PDF)
      </h3>
      <p className="text-sm text-slate-500 mb-4">
        Carga el PDF 'LISTADO DE RUTA DE CAMIONES' para extraer los números de pedido.
      </p>
      <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isLoading ? 'bg-slate-100 border-indigo-300' : 'bg-slate-50 border-slate-300 hover:bg-slate-100'}`}>
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
              <p className="text-sm text-indigo-600 font-medium">Leyendo PDF del muelle...</p>
            </>
          ) : (
            <>
              <svg className="w-8 h-8 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              <p className="mb-2 text-sm text-slate-500">Subir PDF de Ruta / Muelle</p>
            </>
          )}
        </div>
        <input type="file" accept=".pdf,.csv" className="hidden" onChange={handleFileUpload} disabled={isLoading} />
      </label>
    </div>
  );
};

export default MuelleUploader;
