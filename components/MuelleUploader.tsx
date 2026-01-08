
import React, { useState } from 'react';
import { MuelleData, RawToken } from '../types.ts';
import { convertPdfToImages } from '../services/pdfService.ts';
import { parseMuelleTextLocal, tokenizeText, extractByPattern } from '../services/localParser.ts';
import { performLocalOCR } from '../services/ocrService.ts';

interface MuelleUploaderProps {
  onDataLoaded: (data: MuelleData[]) => void;
  isLoading: boolean;
  onLoadingChange: (loading: boolean) => void;
}

const MuelleUploader: React.FC<MuelleUploaderProps> = ({ onDataLoaded, isLoading, onLoadingChange }) => {
  const [ocrStatus, setOcrStatus] = useState<string>("");
  const [showManualPicker, setShowManualPicker] = useState(false);
  const [allTokens, setAllTokens] = useState<RawToken[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<RawToken | null>(null);
  const [selectedRef, setSelectedRef] = useState<RawToken | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onLoadingChange(true);
    setOcrStatus("Leyendo PDF...");
    
    try {
      const pages = await convertPdfToImages(file);
      let combinedText = pages.map(p => p.textContent).join('\n');
      
      // Si el texto está vacío, intentamos OCR
      if (combinedText.trim().length < 50) {
        setOcrStatus("Escaneando documento...");
        combinedText = "";
        for (let i = 0; i < pages.length; i++) {
          setOcrStatus(`Escaneando pág ${i+1}/${pages.length}...`);
          const text = await performLocalOCR(pages[i].imageUrl);
          combinedText += text + "\n";
        }
      }

      const autoData = parseMuelleTextLocal(combinedText);
      
      if (autoData.length > 0) {
        onDataLoaded(autoData);
      } else {
        // Si falla el auto, mostramos el picker manual
        const tokens = tokenizeText(combinedText);
        setAllTokens(tokens);
        setShowManualPicker(true);
      }
    } catch (err) {
      console.error(err);
      alert("Error al procesar el listado.");
    } finally {
      onLoadingChange(false);
      setOcrStatus("");
    }
  };

  const confirmManualSelection = () => {
    if (selectedOrder && selectedRef) {
      const results = extractByPattern(allTokens, selectedOrder, selectedRef);
      if (results.length > 0) {
        onDataLoaded(results);
        setShowManualPicker(false);
      } else {
        alert("No se encontraron patrones similares. Prueba a seleccionar otros tokens.");
      }
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
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
              <p className="text-[10px] text-indigo-600 font-bold uppercase">{ocrStatus}</p>
            </div>
          ) : (
            <>
              <svg className="w-8 h-8 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              <p className="text-sm text-slate-500 font-medium">Subir PDF de Ruta</p>
            </>
          )}
        </div>
        <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={isLoading} />
      </label>

      {showManualPicker && (
        <div className="fixed inset-0 bg-slate-900/90 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h4 className="font-bold text-slate-900">Extracción Guiada</h4>
                <p className="text-xs text-slate-500">Selecciona el primer Pedido y la primera Referencia para enseñarle al programa.</p>
              </div>
              <button onClick={() => setShowManualPicker(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
              <div className="flex flex-wrap gap-2">
                {allTokens.map((t, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (!selectedOrder) setSelectedOrder(t);
                      else if (!selectedRef) setSelectedRef(t);
                      else { setSelectedOrder(t); setSelectedRef(null); }
                    }}
                    className={`px-3 py-1 text-xs rounded-md border transition-all ${
                      selectedOrder === t ? 'bg-indigo-600 text-white border-indigo-700 font-bold scale-110' :
                      selectedRef === t ? 'bg-orange-500 text-white border-orange-600 font-bold scale-110' :
                      'bg-white text-slate-600 border-slate-200 hover:border-indigo-400'
                    }`}
                  >
                    {t.text}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 border-t bg-white flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Pista 1: Pedido</span>
                  <span className="text-sm font-mono text-indigo-600">{selectedOrder?.text || 'Haz clic en el número...'}</span>
                </div>
                <div className="flex flex-col border-l pl-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Pista 2: Referencia</span>
                  <span className="text-sm font-mono text-orange-600">{selectedRef?.text || 'Haz clic en la ref...'}</span>
                </div>
              </div>

              <div className="flex gap-2">
                 <button 
                  onClick={() => { setSelectedOrder(null); setSelectedRef(null); }}
                  className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
                >
                  Limpiar
                </button>
                <button 
                  disabled={!selectedOrder || !selectedRef}
                  onClick={confirmManualSelection}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
                >
                  BARRER DOCUMENTO
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MuelleUploader;
