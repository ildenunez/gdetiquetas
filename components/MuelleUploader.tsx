
import React, { useState, useRef, useEffect } from 'react';
import { MuelleData, RawToken, PdfPageResult } from '../types.ts';
import { convertPdfToImages } from '../services/pdfService.ts';
import { tokenizeText, extractBySpatialRange } from '../services/localParser.ts';

interface MuelleUploaderProps {
  onDataLoaded: (data: MuelleData[]) => void;
  isLoading: boolean;
  onLoadingChange: (loading: boolean) => void;
  loadedCount: number;
  muelleData: MuelleData[];
}

const MuelleUploader: React.FC<MuelleUploaderProps> = ({ onDataLoaded, isLoading, onLoadingChange, loadedCount, muelleData }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [allPagesData, setAllPagesData] = useState<PdfPageResult[]>([]);
  const [tokens, setTokens] = useState<RawToken[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<RawToken | null>(null);
  const [selectedRef, setSelectedRef] = useState<RawToken | null>(null);
  const [step, setStep] = useState<'order' | 'ref'>('order');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onLoadingChange(true);
    setSelectedOrder(null);
    setSelectedRef(null);
    setStep('order');
    
    try {
      const pages = await convertPdfToImages(file);
      setAllPagesData(pages);
      setTokens(tokenizeText(pages[0].textContent));
      setShowPicker(true);
    } catch (err: any) {
      alert("Error: " + err.message);
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
        // Al extraer, bultosSample es null para simplificar
        const results = extractBySpatialRange(tokenizeText(page.textContent), selectedOrder, selectedRef, null);
        allResults = [...allResults, ...results];
      });
      
      const uniqueResults = allResults.filter((v, i, a) => 
        v.orderNumber && v.amazonRef &&
        a.findIndex(t => (t.orderNumber === v.orderNumber && t.amazonRef === v.amazonRef)) === i
      );
      
      if (uniqueResults.length === 0) {
        alert("No se detectaron datos válidos. Intenta seleccionar otra línea de ejemplo.");
      } else {
        onDataLoaded(uniqueResults);
        setShowPicker(false);
      }
      onLoadingChange(false);
    }
  };

  const pageData = allPagesData[0];

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          1. Muelle ({loadedCount})
        </h3>
        {loadedCount > 0 && (
          <button onClick={() => { setAllPagesData([]); setTokens([]); onDataLoaded([]); }} className="text-[10px] text-red-500 font-black uppercase hover:underline">Cambiar PDF</button>
        )}
      </div>

      {loadedCount === 0 ? (
        <label className={`relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isLoading ? 'bg-indigo-50 border-indigo-300' : 'bg-slate-50 border-slate-300 hover:bg-slate-100 hover:border-indigo-400'}`}>
          <div className="flex flex-col items-center justify-center text-center p-4">
            {isLoading ? (
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent mx-auto"></div>
            ) : (
              <>
                <svg className="w-10 h-10 text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                <p className="text-sm text-slate-600 font-black uppercase tracking-widest">Subir Muelle (PDF)</p>
                <p className="text-[10px] text-slate-400 mt-2 font-medium">Extraeremos pedidos y referencias de Amazon automáticamente</p>
              </>
            )}
          </div>
          <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={isLoading} />
        </label>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col border border-slate-100 rounded-xl bg-slate-50">
          <div className="grid grid-cols-12 gap-2 p-3 bg-slate-800 text-[10px] font-black uppercase text-slate-300 tracking-wider">
            <div className="col-span-5">Pedido</div>
            <div className="col-span-7">Ref. Amazon</div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[300px]">
            {muelleData.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 p-3 border-b border-white text-[11px] font-mono hover:bg-indigo-50 transition-colors">
                <div className="col-span-5 font-black text-indigo-700">{item.orderNumber}</div>
                <div className="col-span-7 font-bold text-slate-600 truncate" title={item.amazonRef}>{item.amazonRef}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showPicker && pageData && (
        <div className="fixed inset-0 bg-slate-950/98 z-[2000] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-white/20">
            <div className="p-8 bg-slate-50 border-b flex justify-between items-center shrink-0">
              <div className="flex items-center gap-6">
                <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2m0 18l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                </div>
                <div>
                  <h4 className="font-black text-2xl text-slate-900 uppercase tracking-tighter">Mapeador de Muelle</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Selecciona el pedido y la referencia en la misma línea</p>
                </div>
                <div className="flex gap-2 ml-4">
                  <StepBadge active={step === 'order'} done={!!selectedOrder} label="1. Seleccionar Pedido" />
                  <StepBadge active={step === 'ref'} done={!!selectedRef} label="2. Seleccionar Referencia" />
                </div>
              </div>
              <button onClick={() => setShowPicker(false)} className="bg-slate-200 hover:bg-red-500 hover:text-white p-2 rounded-full transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-12 bg-slate-900 flex justify-center custom-scrollbar">
              <div className="relative bg-white shadow-2xl border-8 border-slate-800 rounded-lg overflow-hidden" style={{ width: 'fit-content', height: 'fit-content' }}>
                <img src={pageData.imageUrl} className="max-w-none block pointer-events-none select-none" style={{ width: '1200px' }} />
                <div className="absolute inset-0 z-50">
                  {tokens.map((token, idx) => {
                    const isOrder = selectedOrder === token;
                    const isRef = selectedRef === token;
                    
                    // Cálculo de coordenadas PDF (y es bottom-up)
                    // Para posicionar arriba, restamos el alto del token de la posición superior
                    const left = (token.x / pageData.width) * 100;
                    const hFactor = (token.height / pageData.height) * 100;
                    const top = (1 - ((token.y + token.height) / pageData.height)) * 100;
                    const width = (token.width / pageData.width) * 100;
                    
                    return (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (step === 'order') { setSelectedOrder(token); setStep('ref'); }
                          else { setSelectedRef(token); }
                        }}
                        className={`absolute flex items-center justify-center text-[7px] font-mono border-2 transition-all ${
                          isOrder ? 'bg-indigo-600 text-white border-white scale-110 z-[100] shadow-xl' :
                          isRef ? 'bg-orange-500 text-white border-white scale-110 z-[100] shadow-xl' :
                          'bg-indigo-600/5 text-transparent border-transparent hover:bg-indigo-500/30 hover:border-indigo-500'
                        }`}
                        style={{ 
                          left: `${left}%`, 
                          top: `${top}%`, 
                          width: `${width + 0.2}%`, 
                          height: `${hFactor + 0.5}%`,
                          borderRadius: '1px'
                        }}
                        title={token.text}
                      >
                        {token.text}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-8 border-t bg-slate-50 flex items-center justify-between shrink-0">
              <div className="flex gap-4">
                <SelectedBox label="Nº Pedido" value={selectedOrder?.text} color="indigo" />
                <SelectedBox label="Ref. Amazon" value={selectedRef?.text} color="orange" />
              </div>
              <div className="flex gap-6">
                <button onClick={() => { setSelectedOrder(null); setSelectedRef(null); setStep('order'); }} className="text-slate-500 font-black uppercase text-[11px] tracking-widest hover:text-slate-900 transition-colors">Reiniciar</button>
                <button disabled={!selectedOrder || !selectedRef} onClick={confirmSelection} className="px-16 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black shadow-2xl hover:bg-indigo-700 hover:scale-105 disabled:opacity-20 disabled:grayscale transition-all uppercase tracking-widest text-sm">
                  Procesar Listado
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StepBadge: React.FC<{ active: boolean, done: boolean, label: string }> = ({ active, done, label }) => (
  <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border-2 transition-all ${
    active ? 'bg-indigo-600 border-indigo-500 text-white scale-105 shadow-lg' : 
    done ? 'bg-green-100 border-green-200 text-green-600' : 'bg-slate-200 border-slate-300 text-slate-500'
  }`}>
    {done && <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
    {label}
  </div>
);

const SelectedBox: React.FC<{ label: string, value?: string, color: string }> = ({ label, value, color }) => {
  const colorMap: any = {
    indigo: 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-indigo-100',
    orange: 'border-orange-600 bg-orange-50 text-orange-700 shadow-orange-100'
  };
  return (
    <div className={`p-4 rounded-2xl border-2 min-w-[180px] shadow-lg transition-all ${value ? `${colorMap[color]} scale-105` : 'border-slate-100 bg-slate-50 text-slate-300'}`}>
      <p className="text-[8px] font-black uppercase tracking-widest mb-1 opacity-60">{label}</p>
      <p className="font-mono text-[11px] font-black truncate">{value || 'Pendiente'}</p>
    </div>
  );
};

export default MuelleUploader;
