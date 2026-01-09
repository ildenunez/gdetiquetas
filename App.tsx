
import React, { useState, useCallback, useEffect } from 'react';
import MuelleUploader from './components/MuelleUploader.tsx';
import LabelUploader from './components/LabelUploader.tsx';
import LabelCard from './components/LabelCard.tsx';
import LabelPrinter from './components/LabelPrinter.tsx';
import LabelConfigurator from './components/LabelConfigurator.tsx';
import { MuelleData, ProcessedLabel, LabelRules, PdfPageResult } from './types.ts';
import { convertPdfToImages } from './services/pdfService.ts';
import { parseAmazonLabelLocal, tokenizeText, normalizeForMatch } from './services/localParser.ts';
import { scanDataMatrix, extractAmazonRefFromBarcode, cropImage } from './services/barcodeService.ts';
import { extractRefWithVision } from './services/geminiService.ts';

const App: React.FC = () => {
  const [muelleData, setMuelleData] = useState<MuelleData[]>([]);
  const [labels, setLabels] = useState<ProcessedLabel[]>([]);
  const [isProcessingLabels, setIsProcessingLabels] = useState(false);
  const [isProcessingMuelle, setIsProcessingMuelle] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<{status: string, progress: number} | null>(null);
  const [showPrintMode, setShowPrintMode] = useState(false);
  const [showMuelleTable, setShowMuelleTable] = useState(false);
  const [summary, setSummary] = useState({ total: 0, matched: 0, pending: 0 });

  const [labelRules, setLabelRules] = useState<LabelRules | null>(null);
  const [samplePage, setSamplePage] = useState<PdfPageResult | null>(null);
  const [showLabelConfig, setShowLabelConfig] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);

  // Verificar si la API Key está configurada al cargar
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected || !!process.env.API_KEY);
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    setSummary({
      total: labels.length,
      matched: labels.filter(l => l.matchedOrderNumber).length,
      pending: labels.filter(l => l.status === 'pending' || l.status === 'processing').length
    });
  }, [labels]);

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handleMuelleLoaded = (data: MuelleData[]) => {
    setMuelleData(data);
    setShowMuelleTable(true);
  };

  const calculateBultos = (allLabels: ProcessedLabel[]): ProcessedLabel[] => {
    const counts: Record<string, number> = {};
    const trackers: Record<string, number> = {};
    allLabels.forEach(l => {
      const ref = l.extractedAmazonRef || "SIN_REF";
      counts[ref] = (counts[ref] || 0) + 1;
    });
    return allLabels.map(l => {
      const ref = l.extractedAmazonRef || "SIN_REF";
      trackers[ref] = (trackers[ref] || 0) + 1;
      return { ...l, packageInfo: `${trackers[ref]}/${counts[ref]}` };
    });
  };

  const handleLabelsSelected = async (files: FileList) => {
    setIsProcessingLabels(true);
    const newLabels: ProcessedLabel[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const pages = await convertPdfToImages(file);
        if (!labelRules && pages.length > 0 && !samplePage) {
          setSamplePage(pages[0]);
          setShowLabelConfig(true);
        }
        pages.forEach((page) => {
          const tokens = tokenizeText(page.textContent);
          const fullTextContent = tokens.map(t => t.text).join(' ');
          const localExtract = parseAmazonLabelLocal(fullTextContent);
          newLabels.push({
            id: Math.random().toString(36).substr(2, 9),
            originalFileName: file.name,
            pageNumber: page.pageNumber,
            imageUrl: page.imageUrl,
            extractedAmazonRef: localExtract.amazonRef,
            packageInfo: null, 
            matchedOrderNumber: null,
            status: 'pending',
            rawBarcodeText: null,
            rawOcrText: fullTextContent 
          });
        });
      } catch (err) { console.error('Error PDF:', err); }
    }
    setLabels(prev => calculateBultos([...prev, ...newLabels]));
    setIsProcessingLabels(false);
  };

  const startProcessing = useCallback(async () => {
    if (labels.length === 0 || isProcessingLabels) return;
    
    // Si no hay API Key, solicitamos una
    if (!hasApiKey && window.aistudio) {
      await handleOpenKeySelector();
    }

    setIsProcessingLabels(true);
    const pendingLabels = labels.filter(l => l.status !== 'success');
    let count = 0;
    let updatedLabels = [...labels];

    const normalizedMuelle = muelleData.map(m => ({
      ...m,
      normRef: normalizeForMatch(m.amazonRef)
    }));

    for (const label of pendingLabels) {
      count++;
      setOcrProgress({ 
        status: `Analizando etiqueta ${count} de ${pendingLabels.length}...`, 
        progress: Math.round((count/pendingLabels.length)*100) 
      });

      let finalRef: string | null = label.extractedAmazonRef;
      let matchedOrder: string | null = null;
      let debugImg: string | undefined = undefined;

      const barcodeResult = await scanDataMatrix(label.imageUrl, labelRules?.barcodeArea, labelRules?.imageRotation || 0);
      if (barcodeResult) {
        finalRef = extractAmazonRefFromBarcode(barcodeResult.text);
        debugImg = barcodeResult.debugImage;
      }

      if (!matchedOrder && (!finalRef || finalRef.length < 5)) {
        const imageToAnalyze = labelRules?.ocrArea 
          ? await cropImage(label.imageUrl, labelRules.ocrArea, labelRules.imageRotation || 0, 'ultra-sharp')
          : label.imageUrl;
          
        try {
          const visionRef = await extractRefWithVision(imageToAnalyze);
          if (visionRef) {
            finalRef = visionRef;
            debugImg = labelRules?.ocrArea ? imageToAnalyze : undefined;
          }
        } catch (e: any) {
          if (e.message?.includes("entity was not found") || e.message?.includes("API Key")) {
            setHasApiKey(false);
            break; 
          }
        }
      }

      if (finalRef) {
        const refNorm = normalizeForMatch(finalRef);
        const match = normalizedMuelle.find(m => {
          if (refNorm === m.normRef) return true;
          if (refNorm.length > 6 && m.normRef.includes(refNorm)) return true;
          if (m.normRef.length > 6 && refNorm.includes(m.normRef)) return true;
          return false;
        });
        matchedOrder = match ? match.orderNumber : null;
      }

      updatedLabels = updatedLabels.map(l => l.id === label.id ? { 
        ...l, 
        status: matchedOrder ? 'success' : 'error',
        extractedAmazonRef: finalRef,
        matchedOrderNumber: matchedOrder,
        _debugBarcodeImg: debugImg
      } : l);
      
      setLabels(calculateBultos([...updatedLabels]));
    }

    setOcrProgress(null);
    setIsProcessingLabels(false);
  }, [labels, muelleData, isProcessingLabels, labelRules, hasApiKey]);

  if (showPrintMode) return <LabelPrinter labels={labels} onClose={() => setShowPrintMode(false)} />;

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-slate-900 text-white py-6 px-4 mb-8 shadow-xl">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter">GD Etiquetas</h1>
              <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest">Sánchez Giner I S.A.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!hasApiKey && (
              <button 
                onClick={handleOpenKeySelector}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg text-xs font-black uppercase shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-all animate-pulse"
              >
                Configurar API Key
              </button>
            )}
            <button onClick={() => { if(confirm("¿Borrar todo?")) { setLabels([]); setMuelleData([]); setLabelRules(null); } }} className="px-4 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700">Reiniciar</button>
            {summary.matched > 0 && <button onClick={() => setShowPrintMode(true)} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black shadow-lg hover:bg-indigo-500 transition-all uppercase tracking-widest text-xs">IMPRIMIR ({summary.matched})</button>}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 space-y-8">
        {!hasApiKey && (
          <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-4">
              <div className="bg-amber-100 p-3 rounded-full text-amber-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div>
                <h3 className="font-black text-amber-900 uppercase text-sm">Configuración Requerida</h3>
                <p className="text-amber-700 text-xs">Para usar la Visión Artificial (cruces automáticos) debes seleccionar una clave de API pagada.</p>
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-amber-600 text-[10px] font-bold underline uppercase mt-1 block">Saber más sobre facturación</a>
              </div>
            </div>
            <button onClick={handleOpenKeySelector} className="px-8 py-4 bg-amber-600 text-white rounded-xl font-black shadow-lg hover:bg-amber-700 transition-all text-xs uppercase tracking-widest">Seleccionar Clave</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MuelleUploader onDataLoaded={handleMuelleLoaded} isLoading={isProcessingMuelle} onLoadingChange={setIsProcessingMuelle} />
          <div className="space-y-4">
            <LabelUploader onFilesSelected={handleLabelsSelected} disabled={isProcessingMuelle} />
            {labelRules && (
              <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-black text-indigo-700 uppercase">IA Vision y Bultos Activos</span>
                </div>
                <button onClick={() => setShowLabelConfig(true)} className="text-[10px] font-black text-indigo-600 uppercase hover:underline">Reajustar Zonas</button>
              </div>
            )}
          </div>
        </div>

        {muelleData.length > 0 && showMuelleTable && (
          <div className="bg-white border-2 border-indigo-100 rounded-2xl overflow-hidden shadow-xl">
             <div className="p-4 bg-indigo-600 flex justify-between items-center text-white">
                <div className="flex items-center gap-3">
                  <span className="font-black uppercase text-sm tracking-tight">Muelle Detectado</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="bg-white text-indigo-700 px-3 py-1 rounded-full text-xs font-black shadow-sm">
                    {muelleData.length} FILAS
                  </span>
                  <button onClick={() => setShowMuelleTable(!showMuelleTable)} className="text-white/60 hover:text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>
             </div>
             
             <div className="p-6 bg-slate-50">
               <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {muelleData.map((m, i) => (
                    <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col hover:border-indigo-300 transition-all group">
                      <span className="text-[10px] font-black text-slate-400 uppercase mb-1">Pedido</span>
                      <span className="text-sm font-mono font-black text-indigo-600">#{m.orderNumber}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase mt-2">Ref Amazon</span>
                      <span className="text-[11px] font-mono text-slate-700 truncate" title={m.amazonRef}>{m.amazonRef}</span>
                    </div>
                  ))}
               </div>
             </div>
          </div>
        )}

        {ocrProgress && (
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center mb-4">
               <div className="flex flex-col">
                 <span className="font-bold text-indigo-400 uppercase tracking-widest text-[10px]">Visión Inteligente</span>
                 <span className="text-sm font-medium text-slate-300">{ocrProgress.status}</span>
               </div>
               <span className="text-2xl font-black text-indigo-500">{ocrProgress.progress}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
              <div className="bg-gradient-to-r from-indigo-600 to-blue-500 h-full transition-all duration-500" style={{ width: `${ocrProgress.progress}%` }}></div>
            </div>
          </div>
        )}

        {labels.length > 0 && !ocrProgress && (
          <div className="flex flex-col md:flex-row items-center justify-between p-8 bg-white border border-slate-200 rounded-3xl shadow-xl gap-6">
            <div className="flex gap-10">
              <div className="text-center"><p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Total</p><p className="text-3xl font-black">{summary.total}</p></div>
              <div className="text-center"><p className="text-[10px] text-green-500 font-bold uppercase mb-1">Listos</p><p className="text-3xl font-black text-green-600">{summary.matched}</p></div>
            </div>
            <button onClick={startProcessing} className="px-16 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black shadow-2xl transition-all uppercase tracking-widest transform hover:scale-105 active:scale-95">Numerar Etiquetas</button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-6">
          {labels.map((label) => <LabelCard key={label.id} label={label} />)}
        </div>
      </main>

      {showLabelConfig && samplePage && <LabelConfigurator pageData={samplePage} onSave={(rules) => { setLabelRules(rules); setShowLabelConfig(false); }} onClose={() => setShowLabelConfig(false)} />}
    </div>
  );
};

export default App;
