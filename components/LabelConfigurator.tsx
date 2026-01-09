
import React, { useState, useRef, useEffect } from 'react';
import { LabelRules, PdfPageResult, RawToken } from '../types.ts';
import { cropImage, scanDataMatrix } from '../services/barcodeService.ts';
import { performCharacterOCR } from '../services/ocrService.ts';
import { cleanAmazonRef, parsePackageQty } from '../services/localParser.ts';

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
  const [barcodeArea, setBarcodeArea] = useState<Area>({ x: 10, y: 10, w: 20, h: 20 });
  const [ocrArea, setOcrArea] = useState<Area>({ x: 10, y: 75, w: 30, h: 10 }); 
  const [qtyArea, setQtyArea] = useState<Area>({ x: 70, y: 5, w: 25, h: 8 }); 
  const [activeZone, setActiveZone] = useState<'ocr' | 'barcode' | 'qty'>('ocr');
  const [imageRotation, setImageRotation] = useState(0); 
  const [originalSize, setOriginalSize] = useState({ w: 1, h: 1 }); 
  const [testResult, setTestResult] = useState<{ text: string, type: string, debugImg?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [workspaceZoom, setWorkspaceZoom] = useState(1.0); 
  const [cropPreview, setCropPreview] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => { 
      setOriginalSize({ w: img.width, h: img.height });
    };
    img.src = pageData.imageUrl;
  }, [pageData.imageUrl]);

  const is90Or270 = imageRotation === 90 || imageRotation === 270;
  
  // Base del visor: calculamos dimensiones reales del contenedor rotado
  const baseW = 450 * workspaceZoom;
  const nativeAspect = originalSize.h / originalSize.w;
  
  let visualW, visualH;
  if (is90Or270) {
    visualW = baseW;
    visualH = baseW / nativeAspect; 
  } else {
    visualW = baseW;
    visualH = baseW * nativeAspect;
  }

  useEffect(() => {
    const updatePreview = async () => {
        let area;
        if (activeZone === 'ocr') area = ocrArea;
        else if (activeZone === 'qty') area = qtyArea;
        else area = barcodeArea;

        const res = await cropImage(pageData.imageUrl, 
            { x: area.x / 100, y: area.y / 100, w: area.w / 100, h: area.h / 100 }, 
            imageRotation, 'ultra-sharp');
        
        const sourceUrl = typeof res === 'string' ? res : res.strip;
        setCropPreview(sourceUrl);
    };
    const timer = setTimeout(updatePreview, 150);
    return () => clearTimeout(timer);
  }, [ocrArea, barcodeArea, qtyArea, activeZone, imageRotation, pageData.imageUrl]);

  const handleTestRead = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      let area, mode;
      if (activeZone === 'ocr') { area = ocrArea; mode = 'ocr'; }
      else if (activeZone === 'qty') { area = qtyArea; mode = 'qty'; }
      else { area = barcodeArea; mode = 'barcode'; }

      if (mode === 'ocr' || mode === 'qty') {
        const res = await cropImage(pageData.imageUrl, { x: area.x / 100, y: area.y / 100, w: area.w / 100, h: area.h / 100 }, imageRotation, 'ultra-sharp');
        const sourceUrl = typeof res === 'string' ? res : res.strip;
        const charImages = typeof res === 'string' ? [] : res.chars;
        const text = await performCharacterOCR(charImages);
        
        if (mode === 'qty') {
          const qty = parsePackageQty(text);
          setTestResult({ text: qty ? `Bulto ${qty[0]} de ${qty[1]}` : `Leído: ${text}`, type: 'qty', debugImg: sourceUrl });
        } else {
          const cleaned = cleanAmazonRef(text, true);
          setTestResult({ text: cleaned || `Bruto: ${text}`, type: 'ocr', debugImg: sourceUrl });
        }
      } else {
        const resBC = await scanDataMatrix(pageData.imageUrl, { x: area.x / 100, y: area.y / 100, w: area.w / 100, h: area.h / 100 }, imageRotation);
        setTestResult({ text: resBC ? resBC.text : 'No detectado', type: 'barcode', debugImg: resBC?.debugImage });
      }
    } catch (e) { setTestResult({ text: 'Error de lectura', type: 'ocr' }); }
    setIsTesting(false);
  };

  const startDragging = (e: React.MouseEvent, type: 'barcode' | 'ocr' | 'qty') => {
    if (!containerRef.current) return;
    const startX = e.clientX, startY = e.clientY;
    const initialArea = type === 'barcode' ? { ...barcodeArea } : type === 'ocr' ? { ...ocrArea } : { ...qtyArea };
    const rect = containerRef.current.getBoundingClientRect();
    const onMouseMove = (m: MouseEvent) => {
      const deltaX = ((m.clientX - startX) / rect.width) * 100, deltaY = ((m.clientY - startY) / rect.height) * 100;
      const newArea = { 
        ...initialArea, 
        x: Math.max(0, Math.min(initialArea.x + deltaX, 100 - initialArea.w)), 
        y: Math.max(0, Math.min(initialArea.y + deltaY, 100 - initialArea.h)) 
      };
      if (type === 'barcode') setBarcodeArea(newArea);
      else if (type === 'ocr') setOcrArea(newArea);
      else setQtyArea(newArea);
    };
    const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
    document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
  };

  const startResizing = (e: React.MouseEvent, type: 'barcode' | 'ocr' | 'qty') => {
    e.stopPropagation(); if (!containerRef.current) return;
    const startX = e.clientX, startY = e.clientY;
    const initialArea = type === 'barcode' ? { ...barcodeArea } : type === 'ocr' ? { ...ocrArea } : { ...qtyArea };
    const rect = containerRef.current.getBoundingClientRect();
    const onMouseMove = (m: MouseEvent) => {
      const deltaX = ((m.clientX - startX) / rect.width) * 100, deltaY = ((m.clientY - startY) / rect.height) * 100;
      const newArea = { 
        ...initialArea, 
        w: Math.max(2, Math.min(initialArea.w + deltaX, 100 - initialArea.x)), 
        h: Math.max(2, Math.min(initialArea.h + deltaY, 100 - initialArea.y)) 
      };
      if (type === 'barcode') setBarcodeArea(newArea);
      else if (type === 'ocr') setOcrArea(newArea);
      else setQtyArea(newArea);
    };
    const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
    document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-[300] flex flex-col md:flex-row">
      <aside className="w-full md:w-80 bg-slate-900 border-r border-slate-800 p-6 flex flex-col justify-between shrink-0 overflow-y-auto">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
             <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-tighter">Amazon Automator</span>
             <h4 className="font-black text-lg text-white uppercase tracking-tighter">Ajuste de Visión</h4>
          </div>

          <section className="space-y-4">
             <div className="bg-black rounded-xl border border-slate-700 overflow-hidden shadow-inner">
                <div className="flex justify-between items-center px-3 py-1.5 bg-slate-800/50">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lo que ve el ojo:</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                </div>
                <div className="aspect-video bg-white flex items-center justify-center p-2">
                    {cropPreview ? <img src={cropPreview} className="max-h-full max-w-full object-contain" /> : <div className="text-[10px] text-slate-600 font-bold uppercase animate-pulse">Enfocando...</div>}
                </div>
             </div>

             <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setImageRotation(r => (r + 90) % 360); setTestResult(null); }} className="py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold border border-slate-700 transition-all text-[10px] uppercase">Rotar 90°</button>
                <button onClick={() => setWorkspaceZoom(z => z === 1 ? 1.5 : 1)} className="py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold border border-slate-700 transition-all text-[10px] uppercase">{workspaceZoom > 1 ? 'Zoom: OFF' : 'Zoom: ON'}</button>
             </div>

             <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Zonas de Lectura:</p>
                <button onClick={() => setActiveZone('ocr')} className={`w-full p-3 rounded-xl border-2 flex items-center justify-between transition-all ${activeZone === 'ocr' ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                   <span className="text-[10px] font-black uppercase">Ref. Amazon (OCR)</span>
                   <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                </button>
                <button onClick={() => setActiveZone('qty')} className={`w-full p-3 rounded-xl border-2 flex items-center justify-between transition-all ${activeZone === 'qty' ? 'bg-green-600/20 border-green-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                   <span className="text-[10px] font-black uppercase">Bultos (1 of X)</span>
                   <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </button>
                <button onClick={() => setActiveZone('barcode')} className={`w-full p-3 rounded-xl border-2 flex items-center justify-between transition-all ${activeZone === 'barcode' ? 'bg-yellow-600/20 border-yellow-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                   <span className="text-[10px] font-black uppercase">Datamatrix (BC)</span>
                   <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                </button>
             </div>

             <button onClick={handleTestRead} disabled={isTesting} className="w-full py-4 bg-indigo-600 text-white border-2 border-indigo-500 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-400 shadow-lg shadow-indigo-600/20 transition-all">
                {isTesting ? 'Probando...' : 'Test Zona Activa'}
             </button>
             
             {testResult && (
               <div className="p-4 bg-indigo-600/10 rounded-xl border border-indigo-500/30 animate-in slide-in-from-bottom-2 duration-300">
                 <p className="text-[8px] font-black text-indigo-400 uppercase mb-2">Resultado Test:</p>
                 <p className="text-white font-mono font-black text-sm break-all">{testResult.text}</p>
               </div>
             )}
          </section>
        </div>

        <div className="flex flex-col gap-2 pt-6">
          <button onClick={onClose} className="w-full py-3 text-slate-500 font-black uppercase text-[10px] hover:text-white">Cancelar</button>
          <button onClick={() => onSave({ 
            pkgArea: { x: 0, y: 0, w: 0, h: 0 }, 
            barcodeArea: { x: barcodeArea.x / 100, y: barcodeArea.y / 100, w: barcodeArea.w / 100, h: barcodeArea.h / 100 }, 
            ocrArea: { x: ocrArea.x / 100, y: ocrArea.y / 100, w: ocrArea.w / 100, h: ocrArea.h / 100 },
            pkgQtyArea: { x: qtyArea.x / 100, y: qtyArea.y / 100, w: qtyArea.w / 100, h: qtyArea.h / 100 },
            useOcr: true, 
            imageRotation 
          })} className="w-full py-4 bg-white text-slate-900 rounded-xl font-black shadow-xl hover:bg-slate-100 transition-all uppercase tracking-widest text-[11px]">Guardar Configuración</button>
        </div>
      </aside>

      <div className="flex-1 bg-black overflow-hidden flex justify-center items-center p-8 relative">
        {/* Contenedor principal con relación de aspecto EXACTA */}
        <div 
          ref={containerRef} 
          className="relative bg-white shadow-[0_0_80px_rgba(0,0,0,0.9)] overflow-hidden transition-all duration-300" 
          style={{ 
            width: `${visualW}px`, 
            height: `${visualH}px`,
          }}
        >
          {/* Imagen fondo con transformación limpia */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <img 
               src={pageData.imageUrl} 
               alt="Label" 
               className="max-w-none block select-none"
               style={{
                 width: `${is90Or270 ? visualH : visualW}px`,
                 height: `${is90Or270 ? visualW : visualH}px`,
                 transform: `rotate(${imageRotation}deg)`,
                 imageRendering: 'crisp-edges'
               }}
             />
          </div>

          {/* Capa de interacción 1:1 con el contenedor visual. Aquí las coordenadas % son infalibles. */}
          <div className="absolute inset-0 z-50">
             <div className={`absolute border-2 border-yellow-500 bg-yellow-400/10 cursor-move ${activeZone === 'barcode' ? 'block' : 'opacity-40'}`} style={{ left: `${barcodeArea.x}%`, top: `${barcodeArea.y}%`, width: `${barcodeArea.w}%`, height: `${barcodeArea.h}%` }} onMouseDown={(e) => startDragging(e, 'barcode')}>
                <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-yellow-500 cursor-nwse-resize rounded-full border-2 border-white shadow-lg" onMouseDown={(e) => startResizing(e, 'barcode')} />
             </div>
             <div className={`absolute border-2 border-blue-500 bg-blue-400/10 cursor-move ${activeZone === 'ocr' ? 'block' : 'opacity-40'}`} style={{ left: `${ocrArea.x}%`, top: `${ocrArea.y}%`, width: `${ocrArea.w}%`, height: `${ocrArea.h}%` }} onMouseDown={(e) => startDragging(e, 'ocr')}>
                <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-blue-500 cursor-nwse-resize rounded-full border-2 border-white shadow-lg" onMouseDown={(e) => startResizing(e, 'ocr')} />
             </div>
             <div className={`absolute border-2 border-green-500 bg-green-400/10 cursor-move ${activeZone === 'qty' ? 'block' : 'opacity-40'}`} style={{ left: `${qtyArea.x}%`, top: `${qtyArea.y}%`, width: `${qtyArea.w}%`, height: `${qtyArea.h}%` }} onMouseDown={(e) => startDragging(e, 'qty')}>
                <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-green-500 cursor-nwse-resize rounded-full border-2 border-white shadow-lg" onMouseDown={(e) => startResizing(e, 'qty')} />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default LabelConfigurator;
