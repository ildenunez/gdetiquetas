
import React, { useState } from 'react';
import { ProcessedLabel } from '../types';

interface LabelCardProps {
  label: ProcessedLabel;
  onResolve?: () => void;
}

const LabelCard: React.FC<LabelCardProps> = ({ label, onResolve }) => {
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<'text' | 'ocr-debug' | 'barcode' | 'hex'>('ocr-debug');

  const formatChar = (char: string) => {
    const code = char.charCodeAt(0);
    if (code <= 31 || code === 127) return { label: `0x${code.toString(16)}`, class: 'bg-slate-700 text-slate-300' };
    return { label: char, class: 'bg-slate-100 text-slate-800 border-slate-200' };
  };

  const confidenceColor = label.matchConfidence === 100 ? 'text-green-600' : label.matchConfidence && label.matchConfidence > 80 ? 'text-indigo-600' : 'text-orange-600';

  // Mostrar la referencia del muelle si hay match, si no la extraída
  const displayRef = label.matchedAmazonRef || label.extractedAmazonRef || 'SIN LECTURA';
  const isFromMuelle = !!label.matchedAmazonRef;

  return (
    <div className={`bg-white rounded-xl border-2 overflow-hidden shadow-sm flex flex-col group transition-all ${label.status === 'ambiguous' ? 'border-orange-400 animate-pulse-slow' : 'border-slate-200 hover:border-indigo-400'}`}>
      <div className="relative aspect-[3/4] bg-slate-100 overflow-hidden border-b border-slate-100">
        <img src={label.imageUrl} alt="Label" className="object-cover w-full h-full opacity-90 group-hover:opacity-100 transition-opacity" />
        
        {label.status === 'processing' && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center backdrop-blur-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        )}
        
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {label.matchedOrderNumber && (
            <div className="bg-indigo-600 text-white text-[10px] font-black px-2 py-1 rounded shadow-lg uppercase tracking-wider">
              #{label.matchedOrderNumber}
            </div>
          )}
          {label.packageInfo && (
            <div className="bg-orange-500 text-white text-[9px] font-black px-2 py-1 rounded shadow-lg uppercase tracking-wider flex items-center gap-1">
              Bulto {label.packageInfo}
            </div>
          )}
        </div>

        {label.matchConfidence !== undefined && label.matchConfidence > 0 && (
           <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded shadow text-[9px] font-black uppercase">
              <span className={confidenceColor}>{label.matchConfidence}%</span> Efectividad
           </div>
        )}
      </div>
      
      <div className="p-3 bg-white flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase truncate max-w-[100px]">{label.originalFileName}</span>
            <span className="text-[8px] text-slate-300 font-bold uppercase">Pág. {label.pageNumber}</span>
          </div>
          <StatusBadge status={label.status} />
        </div>
        
        <div className="mt-auto space-y-2">
          {label.status === 'ambiguous' ? (
            <button 
              onClick={onResolve}
              className="w-full py-2 bg-orange-500 text-white text-[9px] font-black uppercase rounded-lg hover:bg-orange-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
            >
              RESOLVER CONFLICTO
            </button>
          ) : (
            <div className={`p-2 rounded-lg border ${isFromMuelle ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-200'}`}>
               <span className="text-[8px] font-black text-indigo-400 uppercase block mb-1">
                {isFromMuelle ? 'Ref. Muelle vinculada:' : 'Referencia detectada:'}
               </span>
               <span className="font-mono text-[10px] text-indigo-700 font-black block break-all">
                {displayRef}
              </span>
            </div>
          )}

          <button 
            onClick={() => { setShowModal(true); }}
            className="w-full py-2 bg-slate-900 text-white text-[9px] font-black uppercase rounded-lg hover:bg-indigo-600 transition-all flex items-center justify-center gap-2"
          >
            INSPECCIONAR
          </button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[500] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-slate-50 border-b p-6 flex justify-between items-center">
              <div>
                <h2 className="font-black text-xl text-slate-900 flex items-center gap-2 uppercase">
                  <span className="bg-indigo-600 text-white p-1 rounded">DEBUG</span>
                  Inspector de Visión
                </h2>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex border-b bg-slate-50/50">
              <TabButton active={modalTab === 'ocr-debug'} onClick={() => setModalTab('ocr-debug')} label="Visión OCR" />
              <TabButton active={modalTab === 'barcode'} onClick={() => setModalTab('barcode')} label="Datamatrix" />
              <TabButton active={modalTab === 'text'} onClick={() => setModalTab('text')} label="Texto Nativo" />
              <TabButton active={modalTab === 'hex'} onClick={() => setModalTab('hex')} label="Caracteres" />
            </div>

            <div className="flex-1 overflow-auto p-8 bg-slate-100 custom-scrollbar">
              {modalTab === 'ocr-debug' && (
                <div className="space-y-6">
                  <div className="bg-white border p-8 rounded-2xl shadow-sm">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4">Lo que el OCR leyó:</h4>
                    <div className="bg-slate-200 p-8 rounded-xl flex items-center justify-center overflow-x-auto min-h-[300px]">
                      {label._debugOcrImg ? (
                        <div className="flex flex-col items-center gap-4">
                            <img 
                                src={label._debugOcrImg} 
                                className="max-h-[150px] w-auto border-4 border-white shadow-2xl image-pixelated bg-white" 
                                alt="OCR Input" 
                            />
                        </div>
                      ) : (
                        <p className="text-slate-500 font-bold uppercase text-[10px]">Sin imagen OCR</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 shadow-inner">
                    <h4 className="text-[10px] font-black text-indigo-400 uppercase mb-4">Texto crudo extraído:</h4>
                    <div className="text-white font-mono text-3xl font-black break-all tracking-widest text-center">
                      {label.rawOcrText || "SIN LECTURA"}
                    </div>
                  </div>
                </div>
              )}

              {modalTab === 'barcode' && (
                <div className="space-y-6">
                  <div className="bg-white border p-6 rounded-2xl shadow-sm">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4">Imagen Datamatrix:</h4>
                    <div className="bg-slate-900 p-4 rounded-xl flex items-center justify-center">
                      {label._debugBarcodeImg ? (
                        <img src={label._debugBarcodeImg} className="max-h-[250px] border-2 border-yellow-500 shadow-xl" alt="Barcode Input" />
                      ) : (
                        <p className="text-slate-500 font-bold uppercase text-[10px]">Sin imagen Datamatrix</p>
                      )}
                    </div>
                  </div>
                  <div className="bg-slate-900 rounded-xl p-6 text-yellow-400 font-mono text-xl border border-slate-800 shadow-inner break-all text-center">
                    {label.rawBarcodeText || "Sin lectura."}
                  </div>
                </div>
              )}

              {modalTab === 'text' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4">Texto nativo PDF:</h4>
                  <div className="font-mono text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {label.rawOcrText || "No detectado."}
                  </div>
                </div>
              )}

              {modalTab === 'hex' && (
                <div className="flex flex-wrap gap-1.5 content-start">
                  {(label.rawOcrText || "").split('').map((char, i) => {
                    const fmt = formatChar(char);
                    return (
                      <div key={i} className={`flex flex-col items-center min-w-[32px] p-1 border rounded-md transition-all hover:scale-110 cursor-help ${fmt.class}`}>
                        <span className="text-xs font-bold h-5 flex items-center">{fmt.label}</span>
                        <span className="text-[7px] opacity-50 font-mono mt-1">{i+1}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .image-pixelated { image-rendering: pixelated; }
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        .animate-pulse-slow { animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      `}</style>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean, onClick: () => void, label: string }> = ({ active, onClick, label }) => (
  <button 
    onClick={onClick}
    className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
      active ? 'bg-white border-indigo-600 text-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'
    }`}
  >
    {label}
  </button>
);

const StatusBadge: React.FC<{ status: ProcessedLabel['status'] }> = ({ status }) => {
  const config = {
    pending: { label: 'Espera', classes: 'bg-slate-100 text-slate-500' },
    processing: { label: 'IA...', classes: 'bg-indigo-100 text-indigo-600 animate-pulse' },
    success: { label: 'OK', classes: 'bg-green-100 text-green-700' },
    ambiguous: { label: 'Conflicto', classes: 'bg-orange-100 text-orange-700 font-black ring-1 ring-orange-500' },
    error: { label: 'Sin Cruce', classes: 'bg-red-50 text-red-600' }
  };
  const { label, classes } = config[status];
  return (
    <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter ${classes}`}>
      {label}
    </span>
  );
};

export default LabelCard;
