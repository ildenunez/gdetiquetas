
import React, { useState, useCallback, useEffect } from 'react';
import MuelleUploader from './components/MuelleUploader.tsx';
import LabelUploader from './components/LabelUploader.tsx';
import LabelCard from './components/LabelCard.tsx';
import LabelPrinter from './components/LabelPrinter.tsx';
import LabelConfigurator from './components/LabelConfigurator.tsx';
import { MuelleData, ProcessedLabel, LabelRules, PdfPageResult, MatchCandidate } from './types.ts';
import { convertPdfToImages } from './services/pdfService.ts';
import { parseAmazonLabelLocal, tokenizeText, parsePackageQty, isUpsLabel } from './services/localParser.ts';
import { cropImage } from './services/barcodeService.ts';
import { performCharacterOCR } from './services/ocrService.ts';

const App: React.FC = () => {
  const [muelleData, setMuelleData] = useState<MuelleData[]>([]);
  const [labels, setLabels] = useState<ProcessedLabel[]>([]);
  const [isProcessingLabels, setIsProcessingLabels] = useState(false);
  const [isProcessingMuelle, setIsProcessingMuelle] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<{status: string, progress: number} | null>(null);
  const [showPrintMode, setShowPrintMode] = useState(false);
  const [summary, setSummary] = useState({ total: 0, matched: 0, pending: 0 });
  const [labelRules, setLabelRules] = useState<LabelRules | null>(null);
  const [samplePage, setSamplePage] = useState<PdfPageResult | null>(null);
  const [showLabelConfig, setShowLabelConfig] = useState(false);
  const [resolvingLabel, setResolvingLabel] = useState<ProcessedLabel | null>(null);

  useEffect(() => {
    setSummary({
      total: labels.length,
      matched: labels.filter(l => l.matchedOrderNumber).length,
      pending: labels.filter(l => l.status === 'pending' || l.status === 'processing' || l.status === 'ambiguous').length
    });
  }, [labels]);

  const handleMuelleLoaded = (data: MuelleData[]) => {
    setMuelleData(data);
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
    setLabels(prev => [...prev, ...newLabels]);
    setIsProcessingLabels(false);
  };

  const resetAll = () => {
    if (confirm("¿Estás seguro de que quieres borrar todos los datos y empezar de cero?")) {
      setLabels([]);
      setMuelleData([]);
      setLabelRules(null);
      setSamplePage(null);
      setOcrProgress(null);
      setIsProcessingLabels(false);
      setIsProcessingMuelle(false);
      setShowLabelConfig(false);
      setResolvingLabel(null);
      setShowPrintMode(false);
    }
  };

  const startProcessing = useCallback(async () => {
    if (labels.length === 0 || isProcessingLabels || muelleData.length === 0) return;
    
    setIsProcessingLabels(true);
    let updatedLabels = [...labels];
    let muelleIdx = 0;
    
    // Rastreador de bultos del pedido actual
    let remainingPackagesForCurrentOrder = 0;
    let currentMuelleOrder: MuelleData | null = null;

    for (let i = 0; i < updatedLabels.length; i++) {
      const label = updatedLabels[i];
      setOcrProgress({ 
        status: `Procesando etiqueta ${i + 1} de ${updatedLabels.length}...`, 
        progress: Math.round(((i + 1)/updatedLabels.length)*100) 
      });

      // 1. Detectar si la etiqueta tiene información de bultos (X of Y)
      let qtyResult: [number, number] | null = null;
      if (labelRules?.pkgQtyArea) {
        try {
          const qtyRes = await cropImage(label.imageUrl, labelRules.pkgQtyArea, labelRules.imageRotation || 0, 'ultra-sharp');
          if (typeof qtyRes !== 'string') {
            const qtyText = await performCharacterOCR(qtyRes.chars);
            qtyResult = parsePackageQty(qtyText);
          }
        } catch (e) {
          console.warn("Fallo lectura bultos en etiqueta", i);
        }
      }

      // 2. Determinar qué pedido del muelle le toca
      
      // Si todavía nos quedan bultos del pedido anterior, se los asignamos a esta etiqueta
      if (remainingPackagesForCurrentOrder > 0 && currentMuelleOrder) {
        updatedLabels[i] = { 
          ...label, 
          status: 'success',
          matchedOrderNumber: currentMuelleOrder.orderNumber,
          extractedAmazonRef: currentMuelleOrder.amazonRef,
          packageInfo: qtyResult ? `${qtyResult[0]} de ${qtyResult[1]}` : 'Bulto siguiente'
        };
        remainingPackagesForCurrentOrder--;
      } 
      // Si no quedan bultos pendientes, saltamos al siguiente pedido del muelle
      else {
        if (muelleIdx < muelleData.length) {
          currentMuelleOrder = muelleData[muelleIdx];
          
          updatedLabels[i] = { 
            ...label, 
            status: 'success',
            matchedOrderNumber: currentMuelleOrder.orderNumber,
            extractedAmazonRef: currentMuelleOrder.amazonRef,
            packageInfo: qtyResult ? `${qtyResult[0]} de ${qtyResult[1]}` : '1 de 1'
          };

          // Si el OCR leyó que es un "1 de 3", calculamos que quedan 2 etiquetas más para este mismo pedido
          if (qtyResult && qtyResult[1] > 1 && qtyResult[0] === 1) {
            remainingPackagesForCurrentOrder = qtyResult[1] - 1;
          } else {
            remainingPackagesForCurrentOrder = 0;
          }
          
          muelleIdx++; // Avanzamos en el muelle
        } else {
          // Si se acaba el muelle antes que las etiquetas
          updatedLabels[i] = { ...label, status: 'error', error: 'Muelle agotado' };
        }
      }

      // Actualizar UI en cada paso para feedback visual
      setLabels([...updatedLabels]);
    }

    setOcrProgress(null);
    setIsProcessingLabels(false);
  }, [labels, muelleData, isProcessingLabels, labelRules]);

  const resolveManualMatch = (labelId: string, candidate: MatchCandidate) => {
    setLabels(prev => prev.map(l => l.id === labelId ? {
      ...l,
      status: 'success',
      matchedOrderNumber: candidate.orderNumber,
      extractedAmazonRef: candidate.amazonRef,
      matchConfidence: 100
    } : l));
    setResolvingLabel(null);
  };

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
              <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest">Sánchez Giner I S.A. | Cruce Secuencial</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={resetAll} className="px-4 py-2 text-sm font-black bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors uppercase tracking-widest text-[10px]">Reiniciar</button>
            {summary.matched > 0 && <button onClick={() => setShowPrintMode(true)} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black shadow-lg hover:bg-indigo-500 transition-all uppercase tracking-widest text-xs">IMPRIMIR ({summary.matched})</button>}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-6">
            <MuelleUploader onDataLoaded={handleMuelleLoaded} isLoading={isProcessingMuelle} onLoadingChange={setIsProcessingMuelle} />
            
            {muelleData.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Listado de Muelle ({muelleData.length})</h3>
                  <button onClick={() => setMuelleData([])} className="text-[10px] text-red-500 font-bold uppercase hover:underline">Limpiar</button>
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-2 custom-scrollbar pr-2">
                  {muelleData.map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg group hover:border-indigo-200 transition-all">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-slate-300 w-4">{idx + 1}</span>
                        <p className="text-sm font-black text-slate-900">#{m.orderNumber}</p>
                      </div>
                      <p className="text-[10px] font-mono text-indigo-600 font-bold bg-white px-2 py-1 rounded border border-indigo-100">{m.amazonRef}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <LabelUploader onFilesSelected={handleLabelsSelected} disabled={isProcessingMuelle} />
            {labelRules && (
              <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-black text-indigo-700 uppercase">Zonas de visión configuradas</span>
                </div>
                <button onClick={() => setShowLabelConfig(true)} className="text-[10px] font-black text-indigo-600 uppercase hover:underline">Reajustar</button>
              </div>
            )}
          </div>
        </div>

        {ocrProgress && (
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center mb-4">
               <span className="text-sm font-medium text-slate-300">{ocrProgress.status}</span>
               <span className="text-2xl font-black text-indigo-500">{ocrProgress.progress}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
              <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${ocrProgress.progress}%` }}></div>
            </div>
          </div>
        )}

        {labels.length > 0 && !ocrProgress && (
          <div className="flex flex-col md:flex-row items-center justify-between p-8 bg-white border border-slate-200 rounded-3xl shadow-xl gap-6">
            <div className="flex gap-10">
              <div className="text-center"><p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Etiquetas</p><p className="text-3xl font-black">{summary.total}</p></div>
              <div className="text-center">
                <p className="text-[10px] text-green-500 font-bold uppercase mb-1">Cruzadas</p>
                <p className="text-3xl font-black text-green-600">{summary.matched}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button 
                  onClick={startProcessing} 
                  disabled={muelleData.length === 0 || labels.length === 0}
                  className="px-16 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black shadow-2xl transition-all uppercase tracking-widest transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  Iniciar Cruce Secuencial
              </button>
              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter">Asigna el muelle por orden de aparición</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-6">
          {labels.map((label) => (
            <LabelCard 
              key={label.id} 
              label={label} 
              onResolve={() => setResolvingLabel(label)} 
            />
          ))}
        </div>
      </main>

      {resolvingLabel && (
        <div className="fixed inset-0 z-[600] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
              <div>
                <h2 className="font-black text-xl text-slate-900 uppercase">Cambiar Pedido Manual</h2>
              </div>
              <button onClick={() => setResolvingLabel(null)} className="p-2 hover:bg-slate-200 rounded-full">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6 space-y-3 custom-scrollbar">
              {muelleData.slice(0, 50).map((m, i) => (
                  <button 
                    key={i} 
                    onClick={() => resolveManualMatch(resolvingLabel.id, { orderNumber: m.orderNumber, amazonRef: m.amazonRef, confidence: 100 })}
                    className="w-full p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50 flex items-center justify-between transition-all"
                  >
                    <div className="text-left">
                      <p className="text-xl font-black text-slate-900">#{m.orderNumber}</p>
                      <p className="text-xs font-mono text-slate-500">{m.amazonRef}</p>
                    </div>
                    <span className="text-[10px] font-black text-indigo-400 uppercase">Posición {i+1}</span>
                  </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showLabelConfig && samplePage && <LabelConfigurator pageData={samplePage} onSave={(rules) => { setLabelRules(rules); setShowLabelConfig(false); }} onClose={() => setShowLabelConfig(false)} />}
    </div>
  );
};

export default App;
