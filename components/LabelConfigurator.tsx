
import React, { useState, useRef } from 'react';
import { LabelRules, PdfPageResult } from '../types.ts';

interface LabelConfiguratorProps {
  pageData: PdfPageResult;
  onSave: (rules: LabelRules) => void;
  onClose: () => void;
}

interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

const LabelConfigurator: React.FC<LabelConfiguratorProps> = ({ pageData, onSave, onClose }) => {
  const [pkgArea, setPkgArea] = useState<Area>({ x: 10, y: 10, w: 20, h: 8 });
  const [barcodeArea, setBarcodeArea] = useState<Area>({ x: 60, y: 10, w: 20, h: 20 });
  const containerRef = useRef<HTMLDivElement>(null);

  const startDragging = (e: React.MouseEvent, type: 'pkg' | 'barcode') => {
    e.preventDefault();
    if (!containerRef.current) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initialArea = type === 'pkg' ? { ...pkgArea } : { ...barcodeArea };
    const rect = containerRef.current.getBoundingClientRect();

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = ((moveEvent.clientX - startX) / rect.width) * 100;
      const deltaY = ((moveEvent.clientY - startY) / rect.height) * 100;

      const newArea = {
        ...initialArea,
        x: Math.max(0, Math.min(initialArea.x + deltaX, 100 - initialArea.w)),
        y: Math.max(0, Math.min(initialArea.y + deltaY, 100 - initialArea.h)),
      };

      if (type === 'pkg') setPkgArea(newArea);
      else setBarcodeArea(newArea);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const startResizing = (e: React.MouseEvent, type: 'pkg' | 'barcode') => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initialArea = type === 'pkg' ? { ...pkgArea } : { ...barcodeArea };
    const rect = containerRef.current.getBoundingClientRect();

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = ((moveEvent.clientX - startX) / rect.width) * 100;
      const deltaY = ((moveEvent.clientY - startY) / rect.height) * 100;

      const newArea = {
        ...initialArea,
        w: Math.max(2, Math.min(initialArea.w + deltaX, 100 - initialArea.x)),
        h: Math.max(2, Math.min(initialArea.h + deltaY, 100 - initialArea.y)),
      };

      if (type === 'pkg') setPkgArea(newArea);
      else setBarcodeArea(newArea);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const saveRules = () => {
    onSave({
      pkgArea: { x: pkgArea.x / 100, y: pkgArea.y / 100, w: pkgArea.w / 100, h: pkgArea.h / 100 },
      barcodeArea: { x: barcodeArea.x / 100, y: barcodeArea.y / 100, w: barcodeArea.w / 100, h: barcodeArea.h / 100 }
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 z-[300] flex items-center justify-center p-4 md:p-10 backdrop-blur-md">
      <div className="bg-white rounded-3xl w-full max-w-5xl h-full flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
        
        <div className="p-6 bg-slate-50 border-b flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-orange-500 text-white p-2 rounded-xl shadow-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" /></svg>
            </div>
            <div>
              <h4 className="font-black text-xl text-slate-900 uppercase">Configurador de Zonas</h4>
              <p className="text-sm text-slate-500">Ajusta los 2 recuadros necesarios: Bultos y DataMatrix.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-slate-300 flex justify-center p-8 md:p-12 custom-scrollbar">
          <div 
            ref={containerRef}
            className="relative shadow-2xl bg-white border border-slate-400 select-none"
            style={{ width: 'fit-content', height: 'fit-content' }}
          >
            <img src={pageData.imageUrl} className="max-w-none block pointer-events-none" alt="Label Preview" style={{ width: '480px' }} />
            
            {/* Bultos (NARANJA) */}
            <div 
              className="absolute border-2 border-orange-600 bg-orange-500/20 cursor-move"
              style={{ left: `${pkgArea.x}%`, top: `${pkgArea.y}%`, width: `${pkgArea.w}%`, height: `${pkgArea.h}%` }}
              onMouseDown={(e) => startDragging(e, 'pkg')}
            >
              <div className="absolute -top-6 left-0 bg-orange-600 text-white text-[9px] px-2 py-0.5 font-bold uppercase rounded-t">Bultos (Texto)</div>
              <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-orange-600 cursor-nwse-resize rounded-full border-2 border-white shadow-lg" onMouseDown={(e) => startResizing(e, 'pkg')} />
            </div>

            {/* DataMatrix (AMARILLO) */}
            <div 
              className="absolute border-2 border-yellow-500 bg-yellow-400/20 cursor-move"
              style={{ left: `${barcodeArea.x}%`, top: `${barcodeArea.y}%`, width: `${barcodeArea.w}%`, height: `${barcodeArea.h}%` }}
              onMouseDown={(e) => startDragging(e, 'barcode')}
            >
              <div className="absolute -top-6 left-0 bg-yellow-500 text-white text-[9px] px-2 py-0.5 font-bold uppercase rounded-t">DataMatrix (Código)</div>
              <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-yellow-500 cursor-nwse-resize rounded-full border-2 border-white shadow-lg" onMouseDown={(e) => startResizing(e, 'barcode')} />
            </div>
          </div>
        </div>

        <div className="p-8 border-t bg-white flex justify-between items-center shrink-0">
          <div className="text-slate-500 text-xs font-medium space-y-1">
            <p>• El recuadro <span className="text-yellow-600 font-bold">Amarillo</span> es para el DataMatrix (Referencia de Amazon).</p>
            <p>• El recuadro <span className="text-orange-600 font-bold">Naranja</span> es para extraer el número de bulto (ej: 1/1).</p>
          </div>
          <div className="flex gap-4">
            <button onClick={onClose} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
            <button 
              onClick={saveRules}
              className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all transform active:scale-95 uppercase tracking-widest"
            >
              Guardar Configuración
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LabelConfigurator;
