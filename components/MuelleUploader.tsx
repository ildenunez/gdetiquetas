
import React, { useState } from 'react';
import { MuelleData } from '../types.ts';
import { convertPdfToImages } from '../services/pdfService.ts';
import { parseMuelleTextLocal } from '../services/localParser.ts';
import { performLocalOCR } from '../services/ocrService.ts';

interface MuelleUploaderProps {
  onDataLoaded: (data: MuelleData[]) => void;
  isLoading: boolean;
  onLoadingChange: (loading: boolean) => void;
}

const MuelleUploader: React.FC<MuelleUploaderProps> = ({ onDataLoaded, isLoading, onLoadingChange }) => {
  const [ocrStatus, setOcrStatus] = useState<string>("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onLoadingChange(true);
    setOcrStatus("Leyendo PDF...");
    
    try {
      if (file.type === 'application/pdf') {
        const pages = await convertPdfToImages(file);
        const combinedText = pages.map(p => p.textContent).join('\n');
        let localData = parseMuelleTextLocal(combinedText);
        
        if (localData.length === 0) {
          setOcrStatus("PDF sin texto. Iniciando OCR profundo...");
          let ocrCombinedText = "";
          for (let i = 0; i < pages.length; i++) {
            setOcrStatus(`Escaneando página ${i+1}/${pages.length}...`);
            const pageText = await performLocalOCR(pages[i].imageUrl);
            ocrCombinedText += pageText + "\n";
          }
          localData = parseMuelleTextLocal(ocrCombinedText);
        }
        
        if (localData.length > 0) {
          onDataLoaded(localData);
        } else {
          alert("No se encontraron pedidos. Asegúrate de que el documento es el Listado de Ruta.");
        }
      } else {
        // Manejo simple de CSV
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          const rows = text.split('\n');
          const parsedData = rows
            .map(row => {
              const cols = row.split(/[,;\t]/).map(c => c.trim().replace(/"/g, ''));
              if (cols.length < 2) return null;
              return { orderNumber: cols[0], amazonRef: cols[1] };
            })
            .filter((item): item is MuelleData => item !== null && item.orderNumber !== '');
          onDataLoaded(parsedData);
        };
        reader.readAsText(file);
      }
    } catch (err) {
      console.error(err);
      alert("Error al procesar el listado.");
    } finally {
      onLoadingChange(false);
      setOcrStatus("");
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        1. Listado de Ruta
      </h3>
      <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all ${isLoading ? 'bg-slate-100 border-indigo-300' : 'bg-slate-50 border-slate-300 hover:bg-slate-100'}`}>
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
              <p className="text-[10px] text-indigo-600 font-bold uppercase">{ocrStatus}</p>
            </>
          ) : (
            <>
              <svg className="w-8 h-8 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              <p className="text-sm text-slate-500 font-medium">Subir PDF de Ruta</p>
            </>
          )}
        </div>
        <input type="file" accept=".pdf,.csv,image/*" className="hidden" onChange={handleFileUpload} disabled={isLoading} />
      </label>
    </div>
  );
};

export default MuelleUploader;
