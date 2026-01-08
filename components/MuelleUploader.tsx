
import React, { useState, useRef, useEffect } from 'react';
// Updated import to include PdfPageResult from types
import { MuelleData, RawToken, PdfPageResult } from '../types.ts';
import { convertPdfToImages } from '../services/pdfService.ts';
import { tokenizeText, extractBySpatialRange } from '../services/localParser.ts';

interface MuelleUploaderProps {
  onDataLoaded: (data: MuelleData[]) => void;
  isLoading: boolean;
  onLoadingChange: (loading: boolean) => void;
}

const MuelleUploader: React.FC<MuelleUploaderProps> = ({ onDataLoaded, isLoading, onLoadingChange }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [pageData, setPageData] = useState<PdfPageResult | null>(null);
  const [tokens, setTokens] = useState<RawToken[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<RawToken | null>(null);
  const [selectedRef, setSelectedRef] = useState<RawToken | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onLoadingChange(true);
    setSelectedOrder(null);
    setSelectedRef(null);
    
    try {
      const pages = await convertPdfToImages(file);
      const firstPage = pages[0];
      const pageTokens = tokenizeText(firstPage.textContent);
      
      setPageData(firstPage);
      setTokens(pageTokens);
      setShowPicker(true);
    } catch (err: any) {
      alert("Error al abrir PDF: " + err.message);
    } finally {
      onLoadingChange(false);
      if (e.target) e.target.value = '';
    }
  };

  const confirmSelection = () => {
    if (selectedOrder && selectedRef) {
      const results = extractBySpatialRange(tokens, selectedOrder, selectedRef);
      onDataLoaded(results);
      setShowPicker(false);
    }
  };

  // Escalar coordenadas del PDF al contenedor visual
  const getPos = (val: number, isY: boolean) => {
    if (!pageData) return 0;
    // PDF coordinates are usually 0-600 approx.
    // We'll use a reference scale or percentages
    return (val / (isY ? 842 : 595)) * 100;
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col justify-center">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        1. Listado de Ruta (Muelle)
      </h3>
      
      <label className={`relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isLoading ? 'bg-indigo-50 border-indigo-300' : 'bg-slate-50 border-slate-300 hover:bg-slate-100 hover:border-indigo-400'}`}>
        <div className="flex flex-col items-center justify-center text-center p-4">
          {isLoading ? (
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent mx-auto"></div>
          ) : (
            <>
              <div className="bg-indigo-100 p-3 rounded-full mb-3">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              </div>
              <p className="text-sm text-slate-700 font-bold">Subir PDF de Muelle</p>
              <p className="text-xs text-slate-500 mt-1">Configuración manual por selección de columnas</p>
            </>
          )}
        </div>
        <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={isLoading} />
      </label>

      {showPicker && pageData && (
        <div className="fixed inset-0 bg-slate-900/90 z-[200] flex items-center justify-center p-4 md:p-10 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-6xl h-full flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header Modal */}
            <div className="p-6 bg-slate-50 border-b flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-600 text-white p-2 rounded-lg">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                </div>
                <div>
                  <h4 className="font-black text-xl text-slate-900 uppercase">Configurador Visual de Columnas</h4>
                  <p className="text-sm text-slate-500">Haz clic sobre un <b>Pedido</b> y luego sobre una <b>Referencia</b> para definir el muelle.</p>
                </div>
              </div>
              <button onClick={() => setShowPicker(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Main Area: PDF Image + Tokens */}
            <div className="flex-1 overflow-auto p-12 bg-slate-200 custom-scrollbar flex justify-center">
              <div className="relative shadow-2xl bg-white border border-slate-300" style={{ width: 'fit-content', height: 'fit-content' }}>
                <img 
                  src={pageData.imageUrl} 
                  className="max-w-none block select-none pointer-events-none" 
                  alt="PDF Page" 
                  style={{ width: '800px' }} 
                />
                
                {/* Overlay de Tokens clicables */}
                <div className="absolute inset-0">
                  {tokens.slice(0, 300).map((token, idx) => {
                    const isOrder = selectedOrder === token;
                    const isRef = selectedRef === token;
                    
                    // Escalar posición (asumiendo que PDF es aprox 600x842)
                    const left = (token.x / 595) * 100;
                    const bottom = (token.y / 842) * 100;
                    const top = 100 - bottom;
                    const width = (token.width / 595) * 100;

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          if (!selectedOrder) setSelectedOrder(token);
                          else if (!selectedRef) setSelectedRef(token);
                          else { setSelectedOrder(token); setSelectedRef(null); }
                        }}
                        className={`absolute flex items-center justify-center text-[8px] font-mono whitespace-nowrap overflow-hidden transition-all border ${
                          isOrder ? 'bg-indigo-600 text-white border-indigo-800 z-50 ring-4 ring-indigo-600/30' :
                          isRef ? 'bg-orange-500 text-white border-orange-700 z-50 ring-4 ring-orange-500/30' :
                          'bg-transparent text-transparent hover:bg-indigo-100/40 hover:text-indigo-900 hover:border-indigo-400 z-10'
                        }`}
                        style={{ 
                          left: `${left}%`, 
                          top: `${top}%`, 
                          width: `${width + 1}%`,
                          height: '1.8%',
                          marginTop: '-0.9%'
                        }}
                        title={token.text}
                      >
                        {token.text}
                      </button>
                    );
                  })}
                </div>

                {/* Guías Verticales (Reglas) */}
                {selectedOrder && (
                  <div 
                    className="absolute top-0 bottom-0 bg-indigo-500/10 border-x-2 border-indigo-500/50 pointer-events-none z-0"
                    style={{ 
                      left: `${(selectedOrder.x / 595) * 100}%`, 
                      width: `${(selectedOrder.width / 595) * 100 + 1}%` 
                    }}
                  >
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full bg-indigo-600 text-white text-[10px] px-2 py-1 rounded-t font-bold">COLUMNA PEDIDO</div>
                  </div>
                )}
                {selectedRef && (
                  <div 
                    className="absolute top-0 bottom-0 bg-orange-500/10 border-x-2 border-orange-500/50 pointer-events-none z-0"
                    style={{ 
                      left: `${(selectedRef.x / 595) * 100}%`, 
                      width: `${(selectedRef.width / 595) * 100 + 1}%` 
                    }}
                  >
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full bg-orange-500 text-white text-[10px] px-2 py-1 rounded-t font-bold">COLUMNA AMAZON</div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-8 border-t bg-white flex flex-col md:flex-row gap-6 items-center justify-between shrink-0">
              <div className="flex gap-6">
                <div className={`p-4 rounded-2xl border-2 transition-all min-w-[200px] ${selectedOrder ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 bg-slate-50'}`}>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Muestra Pedido</p>
                  <p className="font-mono text-lg font-bold text-indigo-700">{selectedOrder ? selectedOrder.text : 'Haz clic en uno...'}</p>
                </div>
                <div className={`p-4 rounded-2xl border-2 transition-all min-w-[200px] ${selectedRef ? 'border-orange-500 bg-orange-50' : 'border-slate-100 bg-slate-50'}`}>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Muestra Amazon</p>
                  <p className="font-mono text-lg font-bold text-orange-600">{selectedRef ? selectedRef.text : 'Haz clic en uno...'}</p>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => { setSelectedOrder(null); setSelectedRef(null); }}
                  className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors uppercase text-sm"
                >
                  Limpiar Selección
                </button>
                <button 
                  disabled={!selectedOrder || !selectedRef}
                  onClick={confirmSelection}
                  className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-700 disabled:opacity-30 disabled:grayscale transition-all transform active:scale-95 uppercase"
                >
                  Procesar Listado Completo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
};

export default MuelleUploader;
