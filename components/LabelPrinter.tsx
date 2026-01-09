
import React, { useState } from 'react';
import { ProcessedLabel, OverlayConfig } from '../types';

interface LabelPrinterProps {
  labels: ProcessedLabel[];
  onClose: () => void;
}

const LabelPrinter: React.FC<LabelPrinterProps> = ({ labels, onClose }) => {
  const [config, setConfig] = useState<OverlayConfig>({
    x: 50,
    y: 90,
    fontSize: 90, 
    rotation: 0,
    zoom: 1.5,    
    panX: -50,    
    panY: -15,    
    imageRotation: 0,
    color: '#000000'
  });

  const matchedLabels = labels.filter(l => l.status === 'success' && l.matchedOrderNumber);

  const handlePrint = () => {
    window.print();
  };

  const rotations = [0, 90, 180, 270];

  return (
    <div className="fixed inset-0 bg-[#0f172a] z-[1000] flex flex-col print:relative print:bg-white print:inset-auto">
      
      {/* PANEL DE CONTROL - OCULTO AL IMPRIMIR */}
      <header className="h-20 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-8 shrink-0 print:hidden shadow-2xl">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h2 className="text-white font-black uppercase text-xs tracking-widest">Ajuste de Impresión</h2>
            <p className="text-slate-400 text-[10px] uppercase font-bold">Configurando {matchedLabels.length} etiquetas</p>
          </div>
        </div>

        <button 
          onClick={handlePrint}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-12 py-4 rounded-2xl font-black shadow-xl transition-all transform active:scale-95 flex items-center gap-3 uppercase tracking-widest text-sm"
        >
          Imprimir Ahora
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden print:block print:overflow-visible">
        
        {/* SIDEBAR - OCULTO AL IMPRIMIR */}
        <aside className="w-72 bg-slate-900 border-r border-slate-800 p-6 overflow-y-auto print:hidden space-y-8">
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ajuste de Cámara</h3>
            <div className="space-y-4">
              <RangeInput label="Zoom" min={1} max={3} step={0.1} value={config.zoom} onChange={(v) => setConfig({...config, zoom: v})} />
              <RangeInput label="Eje X" min={-100} max={0} step={1} value={config.panX} onChange={(v) => setConfig({...config, panX: v})} />
              <RangeInput label="Eje Y" min={-100} max={0} step={1} value={config.panY} onChange={(v) => setConfig({...config, panY: v})} />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Texto Pedido</h3>
            <div className="space-y-4">
              <RangeInput label="Posición Y" min={0} max={100} step={1} value={config.y} onChange={(v) => setConfig({...config, y: v})} />
              <RangeInput label="Tamaño" min={30} max={180} step={1} value={config.fontSize} onChange={(v) => setConfig({...config, fontSize: v})} />
            </div>
          </section>

          <div className="grid grid-cols-4 gap-1">
            {rotations.map(deg => (
              <button 
                key={deg} 
                onClick={() => setConfig({...config, imageRotation: deg})}
                className={`py-2 text-[9px] font-black rounded border transition-all ${config.imageRotation === deg ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
              >
                {deg}°
              </button>
            ))}
          </div>
        </aside>

        {/* ÁREA DE TRABAJO - LO QUE SE VE Y SE IMPRIME */}
        <main className="flex-1 overflow-y-auto p-12 bg-slate-950 print:p-0 print:bg-white print:overflow-visible">
          <div className="flex flex-col gap-20 items-center print:gap-0 print:block">
            {matchedLabels.map((label) => (
              <div 
                key={label.id} 
                className="label-page relative bg-white shadow-2xl print:shadow-none print:border-none overflow-hidden"
                style={{
                  width: '400px', 
                  height: '600px', 
                }}
              >
                {/* LA ETIQUETA ORIGINAL */}
                <div 
                  className="absolute inset-0 origin-center"
                  style={{
                    transform: `scale(${config.zoom}) translate(${config.panX + 50}%, ${config.panY + 50}%)`,
                  }}
                >
                  <img 
                    src={label.imageUrl} 
                    className="w-full h-auto block"
                    style={{
                      transform: `rotate(${config.imageRotation}deg)`,
                      transformOrigin: 'center center'
                    }} 
                  />
                </div>

                {/* EL NÚMERO DE PEDIDO (ZONA INFERIOR) - LIMPIO PARA TÉRMICA */}
                <div 
                  className="absolute left-0 right-0 z-50 flex flex-col items-center justify-center pointer-events-none"
                  style={{
                    top: `${config.y}%`,
                    transform: 'translateY(-50%)'
                  }}
                >
                  <div className="flex flex-col items-center">
                    <div 
                      className="font-black tracking-tighter text-black"
                      style={{ 
                        fontSize: `${config.fontSize}px`, 
                        lineHeight: '0.7',
                        background: 'white',
                        padding: '0 10px'
                      }}
                    >
                      {label.matchedOrderNumber}
                    </div>
                    {label.packageInfo && (
                      <div 
                        className="mt-2 text-black font-black uppercase tracking-widest text-center"
                        style={{ 
                          fontSize: `${Math.round(config.fontSize * 0.4)}px`,
                          background: 'white',
                          padding: '0 5px'
                        }}
                      >
                        Bulto: {label.packageInfo}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      <style>{`
        @media screen {
          .label-page { border: 1px solid rgba(255,255,255,0.1); }
        }
        @media print {
          /* Asegurar que el contenedor sea visible */
          html, body, #root {
            visibility: visible !important;
            display: block !important;
            height: auto !important;
            background: white !important;
          }
          
          /* Ocultar todo lo demás excepto el área de impresión */
          .fixed > *:not(.flex-1), header, aside {
            display: none !important;
          }

          .label-page {
            width: 100mm !important;
            height: 150mm !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            position: relative !important;
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
          }

          .label-page img {
            image-rendering: pixelated; /* Mejor para térmicas con códigos */
          }
        }
      `}</style>
    </div>
  );
};

const RangeInput: React.FC<{ label: string, min: number, max: number, step: number, value: number, onChange: (v: number) => void }> = ({ label, min, max, step, value, onChange }) => (
  <div>
    <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase mb-1">
      <span>{label}</span>
      <span>{value}</span>
    </div>
    <input 
      type="range" min={min} max={max} step={step} value={value} 
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
    />
  </div>
);

export default LabelPrinter;
