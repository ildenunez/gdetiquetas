
import React from 'react';
import { MuelleData } from '../types.ts';
import { convertPdfToImages } from '../services/pdfService.ts';
import { extractMuelleDataFromImage } from '../services/geminiService.ts';
import { parseMuelleTextLocal } from '../services/localParser.ts';

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
        
        // 1. Intentar extracción local (Rápido y gratis)
        const combinedText = pages.map(p => p.textContent).join('\n');
        const localData = parseMuelleTextLocal(combinedText);
        
        if (localData.length > 0) {
          allExtractedData = localData;
        } else {
          // 2. Si falla lo local y hay API KEY, intentar IA como último recurso
          const hasApiKey = process.env.API_KEY && process.env.API_KEY.length > 10;
          if (hasApiKey) {
            for (const page of pages) {
              const data = await extractMuelleDataFromImage(page.imageUrl);
              allExtractedData = [...allExtractedData, ...data];
            }
          } else {
            alert("No se pudo extraer texto automáticamente del PDF. Intenta con un archivo PDF que no sea una imagen escaneada.");
          }
        }
        
        onDataLoaded(allExtractedData);
      } else {
        // Manejo de CSV básico
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          const rows = text.split('\n');
          const parsedData: MuelleData[] = rows
            .map(row => {
              const cols = row.split(/[,;\t]/).map(c => c.trim().replace(/"/g, ''));
              if (cols.length < 2) return null;
              return { orderNumber: cols[0], amazonRef: cols[1] };
            })
            .filter((item): item is MuelleData => item !== null && item.orderNumber !== '');
          onDataLoaded(parsedData);
          onLoadingChange(false);
        };
        reader.readAsText(file);
      }
    } catch (err) {
      console.error("Error processing muelle file:", err);
      alert("Error al procesar el archivo. Asegúrate de que es un PDF válido.");
    } finally {
      onLoadingChange(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        1. Listado de Ruta (PDF)
      </h3>
      <p className="text-sm text-slate-500 mb-4">
        Carga el PDF 'LISTADO DE RUTA' para obtener los números de pedido.
      </p>
      <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isLoading ? 'bg-slate-100 border-indigo-300' : 'bg-slate-50 border-slate-300 hover:bg-slate-100'}`}>
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
              <p className="text-sm text-indigo-600 font-medium">Analizando documento...</p>
            </>
          ) : (
            <>
              <svg className="w-8 h-8 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              <p className="mb-2 text-sm text-slate-500 text-center">Haz clic para subir el PDF de Ruta</p>
            </>
          )}
        </div>
        <input type="file" accept=".pdf,.csv" className="hidden" onChange={handleFileUpload} disabled={isLoading} />
      </label>
    </div>
  );
};

export default MuelleUploader;
