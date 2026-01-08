
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
    setOcrStatus("Abriendo PDF...");
    
    try {
      const pages = await convertPdfToImages(file);
      if (pages.length === 0) throw new Error("No se pudieron extraer páginas del PDF");

      let combinedText = pages.map(p => p.textContent).join('\n');
      
      // Si el texto extraído es muy pobre (menos de 10 palabras útiles), forzamos OCR
      const words = combinedText.trim().split(/\s+/).filter(w => w.length > 3);
      
      if (words.length < 15) {
        setOcrStatus("El PDF parece una imagen. Iniciando OCR...");
        combinedText = "";
        for (let i = 0; i < pages.length; i++) {
          setOcrStatus(`Escaneando página ${i + 1} de ${pages.length}...`);
          const text = await performLocalOCR(pages[i].imageUrl, (p) => {
            setOcrStatus(`Escaneando pág ${i+1}: ${p.progress}%`);
          });
          combinedText += text + "\n";
        }
      }

      const autoData = parseMuelleTextLocal(combinedText);
      const tokens = tokenizeText(combinedText);
      setAllTokens(tokens);

      if (autoData.length > 0) {
        onDataLoaded(autoData);
        setOcrStatus("");
      } else {
        // SIEMPRE abrimos el picker si no hay detección automática, 
        // para que el usuario no se quede con la pantalla vacía.
        if (tokens.length === 0) {
          alert("No se ha podido detectar texto ni siquiera con OCR. Asegúrate de que el PDF sea legible.");
        } else {
          setShowManualPicker(true);
        }
      }
    } catch (err: any) {
      console.error("Error en MuelleUploader:", err);
      alert("Error crítico: " + (err.message || "No se pudo procesar el archivo"));
    } finally {
      onLoadingChange(false);
      setOcrStatus("");
      // Reset input para permitir subir el mismo archivo si se equivoca
      if (e.target) e.target.value = '';
    }
  };

  const confirmManualSelection = () => {
    if (selectedOrder && selectedRef) {
      const results = extractByPattern(allTokens, selectedOrder, selectedRef);
      if (results.length > 0) {
        onDataLoaded(results);
        setShowManualPicker(false);
        setSelectedOrder(null);
        setSelectedRef(null);
      } else {
        alert("No se encontraron patrones similares. Prueba a seleccionar otro par de ejemplo.");
      }
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        1. Listado de Ruta
      </h3>
      
      <label className={`relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all ${isLoading ? 'bg-indigo-50 border-indigo-300' : 'bg-slate-50 border-slate-300 hover:bg-slate-100'}`}>
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {isLoading ? (
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent mx-auto mb-3"></div>
              <p className="text-xs font-bold text-indigo-600 animate-pulse">{ocrStatus || "Procesando..."}</p>
            </div>
          ) : (
            <>
              <svg className="w-8 h-8 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              <p className="text-sm text-slate-500 font-medium">Haz clic o arrastra el PDF de Ruta</p>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">PDF de Muelle / Ruta Camiones</p>
            </>
          )}
        </div>
        <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={isLoading} />
      </label>

      {showManualPicker && (
        <div className="fixed inset-0 bg-slate-900/95 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-white/20">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h4 className="font-black text-xl text-slate-900 flex items-center gap-2">
                  <span className="bg-indigo-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm">2</span>
                  Extracción Guiada
                </h4>
                <p className="text-sm text-slate-500 mt-1">
                  El sistema no ha detectado los datos automáticamente. 
                  <span className="font-bold text-indigo-600"> Selecciona un Número de Pedido y luego su Referencia de Amazon.</span>
                </p>
              </div>
              <button 
                onClick={() => setShowManualPicker(false)} 
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-slate-100 custom-scrollbar">
              <div className="bg-white p-6 rounded-2xl shadow-inner min-h-full">
                <div className="flex flex-wrap gap-2 justify-center">
                  {allTokens.length > 0 ? allTokens.map((t, idx) => (
                    <button
                      key={`${t.lineIndex}-${t.tokenIndex}-${idx}`}
                      onClick={() => {
                        if (!selectedOrder) setSelectedOrder(t);
                        else if (!selectedRef) setSelectedRef(t);
                        else { setSelectedOrder(t); setSelectedRef(null); }
                      }}
                      className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-all transform active:scale-95 ${
                        selectedOrder === t ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg scale-110 z-10' :
                        selectedRef === t ? 'bg-orange-500 text-white border-orange-600 shadow-lg scale-110 z-10' :
                        'bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-400 hover:bg-white'
                      }`}
                    >
                      {t.text}
                    </button>
                  )) : (
                    <div className="text-center py-20 text-slate-400">
                       <p>No se encontraron palabras procesables en este documento.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-white flex flex-col md:flex-row gap-6 items-center justify-between shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
              <div className="flex gap-6">
                <div className={`flex flex-col p-3 rounded-xl border-2 transition-all ${selectedOrder ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 opacity-60'}`}>
                  <span className="text-[10px] uppercase font-black text-indigo-600">PASO 1: PEDIDO</span>
                  <span className="text-lg font-mono font-bold text-slate-900">{selectedOrder?.text || 'Esperando...'}</span>
                </div>
                <div className={`flex flex-col p-3 rounded-xl border-2 transition-all ${selectedRef ? 'border-orange-500 bg-orange-50' : 'border-slate-100 opacity-60'}`}>
                  <span className="text-[10px] uppercase font-black text-orange-500">PASO 2: REFERENCIA</span>
                  <span className="text-lg font-mono font-bold text-slate-900">{selectedRef?.text || 'Esperando...'}</span>
                </div>
              </div>

              <div className="flex gap-3">
                 <button 
                  onClick={() => { setSelectedOrder(null); setSelectedRef(null); }}
                  className="px-6 py-3 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest"
                >
                  Reiniciar
                </button>
                <button 
                  disabled={!selectedOrder || !selectedRef}
                  onClick={confirmManualSelection}
                  className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm disabled:opacity-30 hover:bg-indigo-700 shadow-2xl shadow-indigo-200 transition-all uppercase tracking-widest flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  PROCESAR TODO EL LISTADO
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
