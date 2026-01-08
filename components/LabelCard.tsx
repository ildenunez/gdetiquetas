
import React, { useState } from 'react';
import { ProcessedLabel } from '../types';

interface LabelCardProps {
  label: ProcessedLabel;
}

const LabelCard: React.FC<LabelCardProps> = ({ label }) => {
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<'text' | 'hex' | 'structure'>('text');

  const formatChar = (char: string) => {
    const code = char.charCodeAt(0);
    if (code === 29) return { label: 'GS', class: 'bg-amber-500 text-white' };
    if (code === 30) return { label: 'RS', class: 'bg-purple-500 text-white' };
    if (code === 4) return { label: 'EOT', class: 'bg-red-500 text-white' };
    if (code <= 31 || code === 127) return { label: `0x${code.toString(16)}`, class: 'bg-slate-700 text-slate-300' };
    return { label: char, class: 'bg-slate-100 text-slate-800 border-slate-200' };
  };

  // Obtenemos la imagen de debug si existe (la que el escáner procesó)
  const debugImage = (label as any)._debugBarcodeImg;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col group transition-all hover:border-indigo-400">
      {/* Miniatura */}
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
        </div>
      </div>
      
      {/* Información Resumida */}
      <div className="p-3 bg-white flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase truncate max-w-[100px]">{label.originalFileName}</span>
            <span className="text-[8px] text-slate-300 font-bold uppercase">Página {label.pageNumber}</span>
          </div>
          <StatusBadge status={label.status} />
        </div>
        
        <div className="mt-auto space-y-2">
          <div className="bg-indigo-50 border border-indigo-100 p-2 rounded-lg">
             <span className="text-[8px] font-black text-indigo-400 uppercase block mb-1">Referencia Cruzada:</span>
             <span className="font-mono text-[10px] text-indigo-700 font-black block break-all">
              {label.extractedAmazonRef || '---'}
            </span>
          </div>

          <button 
            onClick={() => setShowModal(true)}
            className="w-full py-2 bg-slate-900 text-white text-[9px] font-black uppercase rounded-lg hover:bg-indigo-600 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            INSPECCIONAR TODO
          </button>
        </div>
      </div>

      {/* MODAL DE INSPECCIÓN PROFUNDA */}
      {showModal && (
        <div className="fixed inset-0 z-[500] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header del Modal */}
            <div className="bg-slate-50 border-b p-6 flex justify-between items-center">
              <div>
                <h2 className="font-black text-xl text-slate-900 flex items-center gap-2 uppercase">
                  <span className="bg-indigo-600 text-white p-1 rounded">DEBUG</span>
                  Inspector de Datos Brutos
                </h2>
                <p className="text-xs text-slate-500 mt-1">Viendo todo lo leído en la página {label.pageNumber} de {label.originalFileName}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Selector de Pestañas */}
            <div className="flex border-b bg-slate-50/50">
              <TabButton active={modalTab === 'text'} onClick={() => setModalTab('text')} label="Contenido Texto" />
              <TabButton active={modalTab === 'hex'} onClick={() => setModalTab('hex')} label="Mapa de Caracteres" />
              <TabButton active={modalTab === 'structure'} onClick={() => setModalTab('structure')} label="Estructura DataMatrix" />
            </div>

            {/* Contenido del Modal */}
            <div className="flex-1 overflow-auto p-8 bg-slate-100 custom-scrollbar">
              {modalTab === 'text' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">Todo el texto detectado (OCR/PDF):</h3>
                  <div className="font-mono text-sm text-slate-800 whitespace-pre-wrap leading-relaxed selection:bg-indigo-100">
                    {label.rawOcrText || "No hay texto detectado."}
                  </div>
                </div>
              )}

              {modalTab === 'hex' && (
                <div className="flex flex-wrap gap-1.5 content-start">
                  {(label.rawOcrText || "").split('').map((char, i) => {
                    const fmt = formatChar(char);
                    return (
                      <div key={i} className={`flex flex-col items-center min-w-[32px] p-1 border rounded-md transition-all hover:scale-110 cursor-help ${fmt.class}`} title={`Posición: ${i+1}`}>
                        <span className="text-xs font-bold h-5 flex items-center">{fmt.label}</span>
                        <span className="text-[7px] opacity-50 font-mono mt-1">{i+1}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {modalTab === 'structure' && (
                <div className="space-y-6">
                  {/* Visualización del código procesado */}
                  {debugImage && (
                    <div className="bg-white border p-4 rounded-xl shadow-sm">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase mb-2">Imagen que ha permitido la lectura:</h4>
                      <img src={debugImage} className="max-h-[200px] border border-slate-200" alt="Processed Barcode" />
                      <p className="text-[9px] text-slate-400 mt-2 italic">Esta es la versión limpia y contrastada que el lector ha analizado.</p>
                    </div>
                  )}

                  <div className="bg-slate-900 rounded-2xl p-8 text-green-400 font-mono text-lg border border-slate-800 shadow-2xl min-h-full">
                    <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-4">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="ml-4 text-xs text-slate-500 uppercase font-black">Lectura Directa DataMatrix</span>
                    </div>
                    {label.rawBarcodeText ? (
                      <div className="break-all leading-tight">
                        {label.rawBarcodeText}
                      </div>
                    ) : (
                      <div className="text-slate-600 italic">No se pudo leer el código DataMatrix ni con filtros avanzados.</div>
                    )}
                    
                    {label.rawBarcodeText && (
                      <div className="mt-12 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                        <h4 className="text-[10px] text-slate-500 uppercase mb-3">Análisis de Caracteres de Control:</h4>
                        <div className="flex flex-wrap gap-2">
                          {label.rawBarcodeText.split('').map((c, i) => {
                            const code = c.charCodeAt(0);
                            if (code <= 31) return (
                              <span key={i} className="bg-indigo-900/50 text-indigo-300 text-[10px] px-2 py-1 rounded border border-indigo-700">
                                [{c.charCodeAt(0) === 29 ? 'GS' : c.charCodeAt(0) === 30 ? 'RS' : '0x' + code.toString(16)}]
                              </span>
                            );
                            return null;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t bg-slate-50 flex justify-between items-center">
              <div className="flex gap-4 text-[10px] font-bold text-slate-400 uppercase">
                <span>Total caracteres: {(label.rawOcrText || "").length}</span>
                <span>•</span>
                <span>Referencia extraída: {label.extractedAmazonRef || "N/A"}</span>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black shadow-lg hover:bg-indigo-700 transition-all uppercase text-xs"
              >
                Cerrar Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
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
    processing: { label: 'Analizando', classes: 'bg-indigo-100 text-indigo-600 animate-pulse' },
    success: { label: 'Cruce OK', classes: 'bg-green-100 text-green-700' },
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
