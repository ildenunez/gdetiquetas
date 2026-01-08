
import React, { useState, useRef } from 'react';
import { ProcessedLabel, OverlayConfig } from '../types';

interface LabelPrinterProps {
  labels: ProcessedLabel[];
  onClose: () => void;
}

const LabelPrinter: React.FC<LabelPrinterProps> = ({ labels, onClose }) => {
  const [config, setConfig] = useState<OverlayConfig>({
    x: 50,
    y: 85,
    fontSize: 32,
    color: '#000000',
    cropTop: 0,
    cropBottom: 0,
    cropLeft: 0,
    cropRight: 0,
    rotation: 0
  });

  const matchedLabels = labels.filter(l => l.matchedOrderNumber);

  const handlePrint = () => {
    window.print();
  };

  const rotations = [0, 90, 180, 270];

  return (
    <div className="fixed inset-0 bg-slate-900 z-[100] overflow-y-auto p-4 md:p-8 flex flex-col print:p-0 print:bg-white print:static print:inset-auto">
      <div className="max-w-7xl mx-auto w-full flex flex-col h-full print:max-w-none print:w-full">
        {/* Header - Hidden on Print */}
        <div className="flex justify-between items-center mb-6 text-white shrink-0 print:hidden">
          <div>
            <h2 className="text-2xl font-bold">Configuración de Impresión</h2>
            <p className="text-slate-400 text-sm">Ajusta el recorte y la posición del número de pedido.</p>
          </div>
          <div className="flex gap-3">
             <button 
              onClick={handlePrint}
              className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-xl font-bold shadow-xl transition-all transform active:scale-95 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2-2v4" /></svg>
              IMPRIMIR {matchedLabels.length}
            </button>
            <button 
              onClick={onClose}
              className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-xl font-bold transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 flex-1 min-h-0 print:block">
          {/* Controls Panel - Hidden on Print */}
          <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 space-y-8 text-white shrink-0 print:hidden overflow-y-auto max-h-[calc(100vh-200px)]">
            <section className="space-y-4">
              <h3 className="font-bold text-indigo-400 uppercase text-xs tracking-widest border-b border-slate-700 pb-2">Posición del Bloque</h3>
              <div className="space-y-4">
                <div>
                  <label className="flex justify-between text-xs mb-1">X: <span>{config.x}%</span></label>
                  <input type="range" min="0" max="100" value={config.x} onChange={(e) => setConfig({...config, x: Number(e.target.value)})} className="w-full accent-indigo-500" />
                </div>
                <div>
                  <label className="flex justify-between text-xs mb-1">Y: <span>{config.y}%</span></label>
                  <input type="range" min="0" max="100" value={config.y} onChange={(e) => setConfig({...config, y: Number(e.target.value)})} className="w-full accent-indigo-500" />
                </div>
                <div>
                  <label className="flex justify-between text-xs mb-1">Tamaño Fuente: <span>{config.fontSize}px</span></label>
                  <input type="range" min="8" max="120" value={config.fontSize} onChange={(e) => setConfig({...config, fontSize: Number(e.target.value)})} className="w-full accent-indigo-500" />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-bold text-teal-400 uppercase text-xs tracking-widest border-b border-slate-700 pb-2">Rotación</h3>
              <div className="grid grid-cols-4 gap-2">
                {rotations.map((deg) => (
                  <button
                    key={deg}
                    onClick={() => setConfig({ ...config, rotation: deg })}
                    className={`py-2 text-xs font-bold rounded-lg transition-colors ${
                      config.rotation === deg 
                        ? 'bg-teal-500 text-white' 
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    }`}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-bold text-orange-400 uppercase text-xs tracking-widest border-b border-slate-700 pb-2">Recorte (Crop)</h3>
              <div className="space-y-4 text-[10px]">
                <div>
                  <label className="block mb-1">Arriba: {config.cropTop}%</label>
                  <input type="range" min="0" max="50" value={config.cropTop} onChange={(e) => setConfig({...config, cropTop: Number(e.target.value)})} className="w-full accent-orange-500" />
                </div>
                <div>
                  <label className="block mb-1">Abajo: {config.cropBottom}%</label>
                  <input type="range" min="0" max="50" value={config.cropBottom} onChange={(e) => setConfig({...config, cropBottom: Number(e.target.value)})} className="w-full accent-orange-500" />
                </div>
                <div>
                  <label className="block mb-1">Izquierda: {config.cropLeft}%</label>
                  <input type="range" min="0" max="50" value={config.cropLeft} onChange={(e) => setConfig({...config, cropLeft: Number(e.target.value)})} className="w-full accent-orange-500" />
                </div>
                <div>
                  <label className="block mb-1">Derecha: {config.cropRight}%</label>
                  <input type="range" min="0" max="50" value={config.cropRight} onChange={(e) => setConfig({...config, cropRight: Number(e.target.value)})} className="w-full accent-orange-500" />
                </div>
              </div>
            </section>
          </div>

          {/* Preview Area - Printable */}
          <div className="lg:col-span-3 space-y-6 print:space-y-0 print:block overflow-y-auto print:overflow-visible pr-2 print:pr-0">
            {matchedLabels.map((label) => (
              <div key={label.id} className="label-container relative bg-white border border-slate-200 shadow-sm print:shadow-none print:border-none overflow-hidden print:page-break-after-always">
                {/* Cropped Image View */}
                <div 
                  className="relative overflow-hidden w-full h-full flex items-center justify-center"
                  style={{
                    padding: '0',
                    margin: '0',
                    boxSizing: 'border-box'
                  }}
                >
                  <img 
                    src={label.imageUrl} 
                    className="max-w-none transition-none"
                    style={{
                      width: `${100 / (1 - (config.cropLeft + config.cropRight) / 100)}%`,
                      marginLeft: `-${config.cropLeft / (1 - (config.cropLeft + config.cropRight) / 100)}%`,
                      marginTop: `-${config.cropTop / (1 - (config.cropTop + config.cropBottom) / 100)}%`,
                      clipPath: `inset(${config.cropTop}% ${config.cropRight}% ${config.cropBottom}% ${config.cropLeft}%)`,
                      transform: `scale(${1 / (1 - (config.cropTop + config.cropBottom) / 100)})`,
                      transformOrigin: 'top left',
                      display: 'block'
                    }} 
                    alt="Label" 
                  />
                  
                  {/* Overlay Group: Order Number + Package Info */}
                  <div 
                    className="absolute z-10 font-bold select-none pointer-events-none text-center"
                    style={{
                      left: `${config.x}%`,
                      top: `${config.y}%`,
                      fontSize: `${config.fontSize}px`,
                      color: config.color,
                      transform: `translate(-50%, -50%) rotate(${config.rotation}deg)`,
                      lineHeight: '1.1',
                      textShadow: '0px 0px 1.5px white, 0px 0px 1.5px white'
                    }}
                  >
                    <div>{label.matchedOrderNumber}</div>
                    {label.packageInfo && (
                      <div style={{ fontSize: '0.75em', marginTop: '2px' }}>
                        {label.packageInfo}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status indicator - Hidden on Print */}
                <div className="absolute top-2 right-2 bg-slate-900/60 text-white text-[10px] px-2 py-1 rounded print:hidden backdrop-blur-sm">
                  {label.originalFileName} - {label.packageInfo || '1/1'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <style>{`
        @media print {
          body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: visible;
          }
          #root { padding: 0 !important; margin: 0 !important; }
          .print\\:hidden { display: none !important; }
          .fixed { position: relative !important; }
          .label-container {
            width: 100vw !important;
            height: 100vh !important;
            page-break-after: always;
            display: flex !important;
            align-items: center;
            justify-content: center;
          }
          .label-container img {
            width: 100% !important;
            height: auto !important;
          }
        }
        
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 10px; }
        
        .label-container {
           min-height: 400px;
        }
      `}</style>
    </div>
  );
};

export default LabelPrinter;
