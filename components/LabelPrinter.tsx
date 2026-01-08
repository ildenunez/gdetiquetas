
import React, { useState } from 'react';
import { ProcessedLabel, OverlayConfig } from '../types';

interface LabelPrinterProps {
  labels: ProcessedLabel[];
  onClose: () => void;
}

const LabelPrinter: React.FC<LabelPrinterProps> = ({ labels, onClose }) => {
  const [config, setConfig] = useState<OverlayConfig>({
    x: 50,
    y: 88,
    fontSize: 55,
    rotation: 0,
    zoom: 1.8,    // Empezamos con un zoom para saltar márgenes de PDF
    panX: -50,    // Centrado X
    panY: -10,    // Desplazamiento Y para ver la parte superior usualmente
    imageRotation: 0,
    color: '#000000'
  });

  const matchedLabels = labels.filter(l => l.matchedOrderNumber);

  const handlePrint = () => {
    window.print();
  };

  const rotations = [0, 90, 180, 270];

  return (
    <div className="fixed inset-0 bg-[#0f172a] z-[100] flex flex-col print:p-0 print:bg-white print:static">
      
      {/* HEADER CONTROL PANEL - HIDDEN ON PRINT */}
      <header className="h-20 bg-[#1e293b] border-b border-slate-700 flex items-center justify-between px-8 shrink-0 print:hidden shadow-2xl z-50">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-500 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2-2v4" /></svg>
          </div>
          <div>
            <h2 className="text-white font-black uppercase text-sm tracking-widest">Encuadre Profesional</h2>
            <p className="text-slate-400 text-[10px] font-bold uppercase">Ajusta zoom y posición para papel 10x15cm</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={onClose} className="px-6 py-3 text-slate-400 font-bold hover:text-white transition-colors uppercase text-xs">Cancelar</button>
          <button 
            onClick={handlePrint}
            className="bg-emerald-500 hover:bg-emerald-400 text-white px-10 py-3.5 rounded-xl font-black shadow-xl shadow-emerald-500/20 transition-all transform active:scale-95 flex items-center gap-3 uppercase tracking-tighter text-sm"
          >
            Lanzar a Impresora ({matchedLabels.length})
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden print:block">
        
        {/* SIDEBAR CONTROLS - HIDDEN ON PRINT */}
        <aside className="w-80 bg-[#1e293b] border-r border-slate-700 p-6 overflow-y-auto custom-scrollbar print:hidden flex flex-col gap-8 shadow-inner">
          
          {/* SECCIÓN 1: CÁMARA */}
          <section className="space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
              <h3 className="font-black text-slate-200 uppercase text-[10px] tracking-widest">Ajuste de Cámara</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] font-black mb-2 text-slate-400 uppercase">Zoom: <span>{config.zoom.toFixed(1)}x</span></div>
                <input type="range" min="1" max="4" step="0.05" value={config.zoom} onChange={(e) => setConfig({...config, zoom: parseFloat(e.target.value)})} className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-black mb-2 text-slate-400 uppercase">Eje X: <span>{config.panX}%</span></div>
                <input type="range" min="-100" max="0" value={config.panX} onChange={(e) => setConfig({...config, panX: parseInt(e.target.value)})} className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-black mb-2 text-slate-400 uppercase">Eje Y: <span>{config.panY}%</span></div>
                <input type="range" min="-100" max="0" value={config.panY} onChange={(e) => setConfig({...config, panY: parseInt(e.target.value)})} className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {rotations.map(deg => (
                <button 
                  key={deg} 
                  onClick={() => setConfig({...config, imageRotation: deg})}
                  className={`py-2 text-[9px] font-black rounded-lg border transition-all ${config.imageRotation === deg ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}
                >
                  {deg}°
                </button>
              ))}
            </div>
          </section>

          {/* SECCIÓN 2: TEXTO PEDIDO */}
          <section className="space-y-5 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              <h3 className="font-black text-slate-200 uppercase text-[10px] tracking-widest">Pedido (Superposición)</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] font-black mb-2 text-slate-400 uppercase">Posición X: <span>{config.x}%</span></div>
                <input type="range" min="0" max="100" value={config.x} onChange={(e) => setConfig({...config, x: parseInt(e.target.value)})} className="w-full accent-emerald-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-black mb-2 text-slate-400 uppercase">Posición Y: <span>{config.y}%</span></div>
                <input type="range" min="0" max="100" value={config.y} onChange={(e) => setConfig({...config, y: parseInt(e.target.value)})} className="w-full accent-emerald-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-black mb-2 text-slate-400 uppercase">Tamaño: <span>{config.fontSize}px</span></div>
                <input type="range" min="20" max="120" value={config.fontSize} onChange={(e) => setConfig({...config, fontSize: parseInt(e.target.value)})} className="w-full accent-emerald-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
          </section>

          <div className="mt-auto pt-4 border-t border-slate-700 italic text-[9px] text-slate-500 font-bold uppercase text-center">
            Consejo: Amplía con zoom hasta que <br/> desaparezcan los márgenes blancos.
          </div>
        </aside>

        {/* WORK AREA - PREVIEW / PRINT */}
        <main className="flex-1 overflow-y-auto p-12 bg-[#0f172a] print:p-0 print:bg-white print:overflow-visible">
          <div className="flex flex-col gap-16 items-center print:gap-0">
            {matchedLabels.map((label) => (
              <div 
                key={label.id} 
                className="label-item group relative bg-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] print:shadow-none print:m-0 overflow-hidden border border-white/10 print:border-none"
                style={{
                  width: '400px', // Tamaño visual en pantalla (se escala en impresión)
                  height: '600px', // Proporción 10:15 exacta
                }}
              >
                {/* CAMA DE LA IMAGEN (ENMARCADO) */}
                <div 
                  className="absolute inset-0 pointer-events-none origin-center"
                  style={{
                    transform: `scale(${config.zoom}) translate(${config.panX + 50}%, ${config.panY + 50}%)`,
                    transition: 'transform 0.1s ease-out'
                  }}
                >
                  <img 
                    src={label.imageUrl} 
                    className="w-full h-auto block"
                    style={{
                      transform: `rotate(${config.imageRotation}deg)`,
                      transformOrigin: 'center center'
                    }} 
                    alt="Amazon Label" 
                  />
                </div>

                {/* OVERLAY DEL NÚMERO DE PEDIDO (CAPA SUPERIOR FIJA AL PAPEL) */}
                <div 
                  className="absolute z-50 font-black select-none pointer-events-none text-center flex flex-col items-center justify-center leading-none"
                  style={{
                    left: `${config.x}%`,
                    top: `${config.y}%`,
                    fontSize: `${config.fontSize}px`,
                    color: config.color,
                    transform: `translate(-50%, -50%) rotate(${config.rotation}deg)`,
                    textShadow: '3px 3px 0 white, -3px -3px 0 white, 3px -3px 0 white, -3px 3px 0 white'
                  }}
                >
                  <div className="tracking-tight">{label.matchedOrderNumber}</div>
                  {label.packageInfo && (
                    <div className="bg-white/90 px-3 py-1 rounded-lg mt-1.5 border border-slate-200" style={{ fontSize: '0.45em' }}>
                      Bulto: {label.packageInfo}
                    </div>
                  )}
                </div>

                {/* INDICADOR DE PÁGINA - HIDDEN ON PRINT */}
                <div className="absolute top-4 left-4 print:hidden opacity-0 group-hover:opacity-100 transition-opacity">
                   <div className="bg-black/60 backdrop-blur-md text-white text-[9px] font-black px-3 py-1.5 rounded-full flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                      {label.originalFileName} (PÁG {label.pageNumber})
                   </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      <style>{`
        @media print {
          @page {
            margin: 0;
            size: 100mm 150mm; /* Forzamos tamaño de etiqueta estándar */
          }
          body { 
            margin: 0; 
            padding: 0; 
            background: white !important; 
          }
          #root { 
            display: none !important; 
          }
          .label-item {
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            display: block !important;
            border: none !important;
            border-radius: 0 !important;
          }
          .label-item img {
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
          }
          .print\\:hidden { display: none !important; }
        }

        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 10px; }
        
        /* Estilos de los sliders para que se vean modernos */
        input[type=range]::-webkit-scrollbar { display: none; }
        input[type=range] { -webkit-appearance: none; }
        input[type=range]:focus { outline: none; }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 16px; width: 16px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          margin-top: -6px;
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
          border: 2px solid #6366f1;
        }
      `}</style>
    </div>
  );
};

export default LabelPrinter;
