
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { LabelRules, PdfPageResult, RawToken } from '../types.ts';
import { cropImage, scanDataMatrix, detectContentArea } from '../services/barcodeService.ts';
import { performLocalOCR, performFullPageOCR, OCRToken } from '../services/ocrService.ts';
import { cleanAmazonRef, tokenizeText } from '../services/localParser.ts';

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
  const [barcodeArea, setBarcodeArea] = useState<Area>({ x: 60, y: 10, w: 20, h: 20 });
  const [ocrArea, setOcrArea] = useState<Area>({ x: 75, y: 80, w: 20, h: 8 }); 
  const [useOcr, setUseOcr] = useState(true);
  const [imageRotation, setImageRotation] = useState(0); 
  const [originalAspect, setOriginalAspect] = useState(1.5);
  const [testResult, setTestResult] = useState<{ text: string, type: 'barcode' | 'ocr', debugImg?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [workspaceZoom, setWorkspaceZoom] = useState(1.1); 
  const [showTokens, setShowTokens] = useState(true);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [ocrTokens, setOcrTokens] = useState<OCRToken[]>([]);
  const [imageDims, setImageDims] = useState({ w: 0, h: 0 });
  const [contentCrop, setContentCrop] = useState<Area | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = async () => { 
      setOriginalAspect(img.height / img.width);
      setImageDims({ w: img.width, h: img.height });

      // 1. Detección de márgenes (Auto-Crop)
      const crop = await detectContentArea(pageData.imageUrl);
      setContentCrop(crop);

      // 2. OCR de visión si es necesario
      if (!pageData.textContent || pageData.textContent.length === 0) {
        setIsAnalyzingImage(true);
        const tokens = await performFullPageOCR(pageData.imageUrl);
        setOcrTokens(tokens);
        setIsAnalyzingImage(false);
      }
    };
    img.src = pageData.imageUrl;
  }, [pageData.imageUrl, pageData.textContent]);

  const activeTokens = useMemo(() => {
    if (pageData.textContent && pageData.textContent.length > 0) {
      return tokenizeText(pageData.textContent);
    }
    return ocrTokens.map((t, i) => ({
      text: t.text,
      lineIndex: 0,
      tokenIndex: i,
      x: (t.x / imageDims.w) * pageData.width,
      y: pageData.height - ((t.y / imageDims.h) * pageData.height),
      width: (t.width / imageDims.w) * pageData.width,
      height: (t.height / imageDims.h) * pageData.height
    }));
  }, [pageData.textContent, ocrTokens, imageDims, pageData.width, pageData.height]);

  const handleTestRead = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const activeArea = useOcr ? ocrArea : barcodeArea;
      const cropped = await cropImage(pageData.imageUrl, { x: activeArea.x / 100, y: activeArea.y / 100, w: activeArea.w / 100, h: activeArea.h / 100 }, imageRotation);
      if (useOcr) {
        const text = await performLocalOCR(cropped);
        const cleaned = cleanAmazonRef(text, true);
        setTestResult({ text: cleaned || `Bruto: ${text}`, type: 'ocr', debugImg: cropped });
      } else {
        const res = await scanDataMatrix(pageData.imageUrl, { x: activeArea.x / 100, y: activeArea.y / 100, w: activeArea.w / 100, h: activeArea.h / 100 }, imageRotation);
        setTestResult({ text: res ? res.text : 'No detectado', type: 'barcode', debugImg: cropped });
      }
    } catch (e) { setTestResult({ text: 'Error', type: 'ocr' }); }
    setIsTesting(false);
  };

  const handleTokenClick = (token: RawToken) => {
    const px = 5, py = 3;
    const x = (token.x / pageData.width) * 100 - (px / 2);
    const b = (token.y / pageData.height) * 100;
    const y = 100 - b - 4 - (py / 2); 
    setOcrArea({ 
      x: Math.max(0, Math.min(x, 100 - ( (token.width/pageData.width)*100 + px ))), 
      y: Math.max(0, Math.min(y, 100 - (5 + py))), 
      w: Math.min(100, (token.width/pageData.width)*100 + px), 
      h: 5 + py 
    });
    setUseOcr(true);
  };

  const startDragging = (e: React.MouseEvent, type: 'barcode' | 'ocr') => {
    if (!containerRef.current) return;
    const startX = e.clientX, startY = e.clientY;
    const initialArea = type === 'barcode' ? { ...barcodeArea } : { ...ocrArea };
    const rect = containerRef.current.getBoundingClientRect();
    const onMouseMove = (m: MouseEvent) => {
      const deltaX = ((m.clientX - startX) / rect.width) * 100, deltaY = ((m.clientY - startY) / rect.height) * 100;
      const newArea = { ...initialArea, x: Math.max(0, Math.min(initialArea.x + deltaX, 100 - initialArea.w)), y: Math.max(0, Math.min(initialArea.y + deltaY, 100 - initialArea.h)) };
      type === 'barcode' ? setBarcodeArea(newArea) : setOcrArea(newArea);
    };
    const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
    document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
  };

  const startResizing = (e: React.MouseEvent, type: 'barcode' | 'ocr') => {
    e.stopPropagation(); if (!containerRef.current) return;
    const startX = e.clientX, startY = e.clientY;
    const initialArea = type === 'barcode' ? { ...barcodeArea } : { ...ocrArea };
    const rect = containerRef.current.getBoundingClientRect();
    const onMouseMove = (m: MouseEvent) => {
      const deltaX = ((m.clientX - startX) / rect.width) * 100, deltaY = ((m.clientY - startY) / rect.height) * 100;
      const newArea = { ...initialArea, w: Math.max(2, Math.min(initialArea.w + deltaX, 100 - initialArea.x)), h: Math.max(2, Math.min(initialArea.h + deltaY, 100 - initialArea.y)) };
      type === 'barcode' ? setBarcodeArea(newArea) : setOcrArea(newArea);
    };
    const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
    document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
  };

  const is90Or270 = imageRotation === 90 || imageRotation === 270;
  const displayAspect = is90Or270 ? (1 / originalAspect) : originalAspect;
  const baseWidth = 600 * workspaceZoom;

  return (
    <div className="fixed inset-0 bg-slate-900 z-[300] flex flex-col md:flex-row">
      <aside className="w-full md:w-80 bg-slate-900 border-r border-slate-800 p-8 flex flex-col justify-between shrink-0 overflow-y-auto">
        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
               <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-1 rounded uppercase">Paso 2</span>
               <h4 className="font-black text-xl text-white uppercase tracking-tighter">CONFIGURADOR</h4>
            </div>
            {isAnalyzingImage && (
               <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] font-bold text-indigo-400 uppercase">Visión Artificial activa</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 animate-progress" style={{ width: '100%' }} />
                  </div>
               </div>
            )}
            {!isAnalyzingImage && <p className="text-slate-500 text-[10px] italic">Haz clic en la Referencia Amazon de la etiqueta para centrar la lectura.</p>}
          </div>
          
          <section className="space-y-6">
             <div>
                <label className="flex justify-between text-[10px] font-black text-slate-500 uppercase mb-2"><span>Zoom de Trabajo</span><span>{Math.round(workspaceZoom * 100)}%</span></label>
                <input type="range" min="0.5" max="2.5" step="0.1" value={workspaceZoom} onChange={(e) => setWorkspaceZoom(parseFloat(e.target.value))} className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
             </div>

             <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resaltar Texto</span>
                <button onClick={() => setShowTokens(!showTokens)} className={`w-10 h-5 rounded-full transition-all relative ${showTokens ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${showTokens ? 'left-6' : 'left-1'}`} />
                </button>
             </div>
             
             <button onClick={() => setImageRotation(r => (r + 90) % 360)} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold border border-slate-700 transition-all text-xs">Rotar Imagen 90°</button>
             
             <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="block text-xs font-black text-white uppercase tracking-tight">Usar OCR de Texto</span>
                    <span className="text-[10px] text-slate-500">Para códigos no legibles por barra</span>
                  </div>
                  <input type="checkbox" checked={useOcr} onChange={(e) => setUseOcr(e.target.checked)} className="w-5 h-5 accent-indigo-500 rounded" />
                </label>
             </div>

             <button onClick={handleTestRead} disabled={isTesting || isAnalyzingImage} className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${isTesting ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500'}`}>{isTesting ? 'PROBANDO...' : 'TEST DE LECTURA'}</button>
             
             {testResult && (
               <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-4">
                 <p className="text-[9px] font-black text-indigo-400 uppercase">Resultado:</p>
                 <p className="text-white font-mono font-bold text-sm bg-indigo-950/50 p-2 rounded break-all">{testResult.text}</p>
                 {testResult.debugImg && <div className="bg-white p-2 rounded shadow-inner"><img src={testResult.debugImg} className="w-full h-auto" alt="Debug" /></div>}
               </div>
             )}
          </section>
        </div>

        <div className="flex flex-col gap-3 pt-8">
          <button onClick={onClose} className="w-full py-3 text-slate-500 font-black uppercase text-[10px] hover:text-white transition-colors">Cancelar</button>
          <button onClick={() => onSave({ pkgArea: { x: 0, y: 0, w: 0, h: 0 }, barcodeArea: { x: barcodeArea.x / 100, y: barcodeArea.y / 100, w: barcodeArea.w / 100, h: barcodeArea.h / 100 }, ocrArea: { x: ocrArea.x / 100, y: ocrArea.y / 100, w: ocrArea.w / 100, h: ocrArea.h / 100 }, useOcr, imageRotation })} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black shadow-xl hover:bg-indigo-500 transition-all uppercase tracking-widest text-[10px]">Guardar Cambios</button>
        </div>
      </aside>

      <div className="flex-1 bg-black overflow-auto flex justify-center items-center p-10 custom-scrollbar relative">
        {/* LÁSER DE ESCANEO (SÓLO CUANDO ANALIZA) */}
        {isAnalyzingImage && <div className="absolute left-0 right-0 h-1 bg-indigo-500/50 shadow-[0_0_15px_#6366f1] z-[100] animate-scan-line pointer-events-none" />}

        <div 
          ref={containerRef} 
          className="relative bg-white shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden transition-all duration-700" 
          style={{ 
            width: `${baseWidth}px`, 
            height: `${baseWidth * displayAspect}px`,
          }}
        >
          {/* Imagen de la Etiqueta con Auto-Zoom dinámico */}
          <div 
            className="absolute transition-all duration-700 origin-center" 
            style={{ 
              transform: `rotate(${imageRotation}deg) scale(${contentCrop ? (1 / Math.max(contentCrop.w, contentCrop.h)) * 0.9 : 1})`,
              width: is90Or270 ? `${100 * displayAspect}%` : '100%', 
              height: is90Or270 ? `${100 / displayAspect}%` : '100%', 
              top: contentCrop ? `${50 - (contentCrop.y + contentCrop.h/2 - 0.5)*100}%` : '50%',
              left: contentCrop ? `${50 - (contentCrop.x + contentCrop.w/2 - 0.5)*100}%` : '50%',
              translate: '-50% -50%' 
            }}
          >
            <img src={pageData.imageUrl} className="w-full h-full block object-fill opacity-95" alt="Label" />
          </div>

          {/* Tokens Interactivos (Aparecen tras el escaneo) */}
          <div className={`absolute inset-0 z-10 transition-opacity duration-500 ${showTokens && !isAnalyzingImage ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {activeTokens.map((token, idx) => {
              const left = (token.x / pageData.width) * 100;
              const bottom = (token.y / pageData.height) * 100;
              const top = 100 - bottom;
              const width = (token.width / pageData.width) * 100;

              return (
                <button
                  key={idx}
                  onClick={() => handleTokenClick(token)}
                  className="absolute bg-indigo-500/10 hover:bg-indigo-500/40 border border-indigo-500/10 hover:border-indigo-500/50 transition-all group"
                  style={{ left: `${left}%`, top: `${top - 2}%`, width: `${width}%`, height: '3.5%', zIndex: 20 }}
                >
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-[100] shadow-xl uppercase">{token.text}</span>
                </button>
              );
            })}
          </div>

          {/* Áreas de Lectura */}
          <div className={`absolute border-2 border-yellow-500 bg-yellow-400/10 cursor-move z-50 ${!useOcr ? 'block' : 'hidden'}`} style={{ left: `${barcodeArea.x}%`, top: `${barcodeArea.y}%`, width: `${barcodeArea.w}%`, height: `${barcodeArea.h}%` }} onMouseDown={(e) => startDragging(e, 'barcode')}>
            <div className="absolute -top-5 left-0 bg-yellow-500 text-white text-[8px] px-2 py-0.5 font-black uppercase rounded shadow-lg">DataMatrix</div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-500 cursor-nwse-resize rounded-full border-2 border-white shadow-xl" onMouseDown={(e) => startResizing(e, 'barcode')} />
          </div>

          <div className={`absolute border-2 border-blue-500 bg-blue-400/10 cursor-move z-50 ${useOcr ? 'block' : 'hidden'} transition-all`} style={{ left: `${ocrArea.x}%`, top: `${ocrArea.y}%`, width: `${ocrArea.w}%`, height: `${ocrArea.h}%` }} onMouseDown={(e) => startDragging(e, 'ocr')}>
            <div className="absolute -top-5 left-0 bg-blue-500 text-white text-[8px] px-2 py-0.5 font-black uppercase rounded shadow-lg">Zona Amazon</div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 cursor-nwse-resize rounded-full border-2 border-white shadow-xl" onMouseDown={(e) => startResizing(e, 'ocr')} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scan-line {
          0% { top: 10%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
        .animate-scan-line { animation: scan-line 2s ease-in-out infinite; }
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-progress { animation: progress 1.5s linear infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>
  );
};
export default LabelConfigurator;
