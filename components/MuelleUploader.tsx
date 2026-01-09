
import React, { useState, useRef, useEffect } from 'react';
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
  const [allPagesData, setAllPagesData] = useState<PdfPageResult[]>([]);
  const [tokens, setTokens] = useState<RawToken[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<RawToken | null>(null);
  const [selectedRef, setSelectedRef] = useState<RawToken | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onLoadingChange(true);
    setSelectedOrder(null);
    setSelectedRef(null);
    
    try {
      const pages = await convertPdfToImages(file);
      setAllPagesData(pages);
      
      const firstPage = pages[0];
      const pageTokens = tokenizeText(firstPage.textContent);
      
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
    if (selectedOrder && selectedRef && allPagesData.length > 0) {
      onLoadingChange(true);
      
      let allResults: MuelleData[] = [];
      
      allPagesData.forEach(page => {
        const pageTokens = tokenizeText(page.textContent);
        const results = extractBySpatialRange(pageTokens, selectedOrder, selectedRef);
        allResults = [...allResults, ...results];
      });

      const uniqueResults = allResults.filter((v, i, a) => 
        a.findIndex(t => (t.orderNumber === v.orderNumber && t.amazonRef === v.amazonRef)) === i
      );

      if (uniqueResults.length === 0) {
        alert("No se detectaron datos con esta selección. Prueba a seleccionar otros ejemplos en las mismas columnas.");
      } else {
        onDataLoaded(uniqueResults);
        setShowPicker(false);
      }
      onLoadingChange(false);
    }
  };

  const pageData = allPagesData[0];

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col justify-center">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        1. Listado de Ruta (Muelle)
      </h3>
      
      <label className={`relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isLoading ? 'bg-indigo-50 border-indigo-300' : 'bg-slate-50 border-slate-300 hover:bg-slate-100 hover:border-indigo-400'}`}>
        <div className="flex flex-col items-center justify-center text-center p-4">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent mx-auto"></div>
              <p className="text-xs font-bold text-indigo-600 uppercase animate-pulse">Procesando todas las páginas...</p>
            </div>
          ) : (
            <>
              <div className="bg-indigo-100 p-3 rounded-full mb-3">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              </div>
              <p className="text-sm text-slate-700 font-bold">Subir PDF de Muelle</p>
              <p className="text-xs text-slate-500 mt-1">Soporta múltiples páginas automáticamente</p>
            </>
          )}
        </div>
        <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={isLoading} />
      </label>

      {showPicker && pageData && (
        <div className="fixed inset-0 bg-slate-900/90 z-[200] flex items-center justify-center p-4 md:p-10 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-6xl h-full flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-slate-50 border-b flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-600 text-white p-2 rounded-lg">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                </div>
                <div>
                  <h4 className="font-black text-xl text-slate-900 uppercase">Configurar Columnas</h4>
                  <p className="text-sm text-slate-500">Haz clic en un Nº de pedido y luego en su referencia Amazon.</p>
                </div>
              </div>
              <button onClick={() => setShowPicker(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-12 bg-slate-200 custom-scrollbar flex justify-center">
              <div className="relative shadow-2xl bg-white border border-slate-300" style={{ width: 'fit-content', height: 'fit-content' }}>
                <img 
                  src={pageData.imageUrl} 
                  className="max-w-none block select-none pointer-events-none" 
                  alt="PDF Page" 
                  style={{ width: '800px' }} 
                />
                
                <div className="absolute inset-0">
                  {tokens.map((token, idx) => {
                    const isOrder = selectedOrder === token;
                    const isRef = selectedRef === token;
                    // Uso de las dimensiones reales enviadas desde pdfService
                    const left = (token.x / pageData.width) * 100;
                    const bottom = (token.y / pageData.height) * 100;
                    const top = 100 - bottom;
                    const width = (token.width / pageData.width) * 100;

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
                          width: `${width + 0.5}%`,
                          height: '2%',
                          marginTop: '-1%'
                        }}
                      >
                        {token.text}
                      </button>
                    );
                  })}
                </div>

                {selectedOrder && (
                  <div className="absolute top-0 bottom-0 bg-indigo-500/10 border-x-2 border-indigo-500/50 pointer-events-none"
                    style={{ left: `${(selectedOrder.x / pageData.width) * 100}%`, width: `${(selectedOrder.width / pageData.width) * 100 + 0.5}%` }}>
                  </div>
                )}
                {selectedRef && (
                  <div className="absolute top-0 bottom-0 bg-orange-500/10 border-x-2 border-orange-500/50 pointer-events-none"
                    style={{ left: `${(selectedRef.x / pageData.width) * 100}%`, width: `${(selectedRef.width / pageData.width) * 100 + 0.5}%` }}>
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 border-t bg-white flex flex-col md:flex-row gap-6 items-center justify-between shrink-0">
              <div className="flex gap-6">
                <div className={`p-4 rounded-2xl border-2 transition-all min-w-[200px] ${selectedOrder ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 bg-slate-50'}`}>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Columna Pedido</p>
                  <p className="font-mono text-lg font-bold text-indigo-700">{selectedOrder ? selectedOrder.text : 'Click en pedido...'}</p>
                </div>
                <div className={`p-4 rounded-2xl border-2 transition-all min-w-[200px] ${selectedRef ? 'border-orange-500 bg-orange-50' : 'border-slate-100 bg-slate-50'}`}>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Columna Amazon</p>
                  <p className="font-mono text-lg font-bold text-orange-600">{selectedRef ? selectedRef.text : 'Click en ref...'}</p>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => { setSelectedOrder(null); setSelectedRef(null); }}
                  className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors uppercase text-sm"
                >
                  Reiniciar
                </button>
                <button 
                  disabled={!selectedOrder || !selectedRef}
                  onClick={confirmSelection}
                  className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-700 disabled:opacity-30 transition-all uppercase text-xs"
                >
                  Confirmar Lectura
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
      `}</style>
    </div>
  );
};

export default MuelleUploader;
