
import React, { useState, useCallback, useEffect } from 'react';
import MuelleUploader from './components/MuelleUploader.tsx';
import LabelUploader from './components/LabelUploader.tsx';
import LabelCard from './components/LabelCard.tsx';
import LabelPrinter from './components/LabelPrinter.tsx';
import LabelConfigurator from './components/LabelConfigurator.tsx';
import { MuelleData, ProcessedLabel, LabelRules, PdfPageResult } from './types.ts';
import { convertPdfToImages } from './services/pdfService.ts';
import { parseAmazonLabelLocal, tokenizeText, normalizeForMatch, cleanAmazonRef, isSeurOrOntime } from './services/localParser.ts';
import { cropImage, scanDataMatrix } from './services/barcodeService.ts';
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
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    setSummary({
      total: labels.length,
      matched: labels.filter(l => l.matchedOrderNumber).length,
      pending: labels.filter(l => l.status === 'pending' || l.status === 'processing' || l.status === 'error').length
    });
  }, [labels]);

  const handleMuelleLoaded = (data: MuelleData[]) => setMuelleData(data);

  const handleLabelsSelected = async (files: FileList) => {
    setIsProcessingLabels(true);
    const newLabels: ProcessedLabel[] = [];
    let firstSampleSet = false;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const pages = await convertPdfToImages(file);
        if (!labelRules && !samplePage && !firstSampleSet && pages.length > 0) {
          setSamplePage(pages[0]);
          setShowLabelConfig(true);
          firstSampleSet = true;
        }
        pages.forEach((page) => {
          const fullTextContent = tokenizeText(page.textContent).map(t => t.text).join(' ');
          newLabels.push({
            id: Math.random().toString(36).substr(2, 9),
            originalFileName: file.name,
            pageNumber: page.pageNumber,
            imageUrl: page.imageUrl,
            extractedAmazonRef: cleanAmazonRef(fullTextContent),
            packageInfo: null, 
            matchedOrderNumber: null,
            status: 'pending',
            rawOcrText: fullTextContent 
          });
        });
      } catch (err) { console.error(err); }
    }
    setLabels(prev => [...prev, ...newLabels]);
    setIsProcessingLabels(false);
  };

  const startProcessing = useCallback(async () => {
    if (labels.length === 0 || muelleData.length === 0) return;
    setIsProcessingLabels(true);
    const updatedLabels = [...labels];
    const muelleMap = new Map<string, MuelleData>();
    muelleData.forEach(m => muelleMap.set(normalizeForMatch(m.amazonRef), m));

    // Primera pasada: Cruce y extracción de secuencia
    const labelResults: any[] = [];
    for (let i = 0; i < updatedLabels.length; i++) {
      const currentLabel = updatedLabels[i];
      setOcrProgress({ status: `Analizando ${currentLabel.originalFileName}...`, progress: Math.round(((i + 1)/updatedLabels.length)*100) });
      
      let foundRef: string | null = null;
      let barcodeSeq: number = 1;

      const bcArea = labelRules?.barcodeArea || { x: 0, y: 0, w: 1, h: 1 };
      const bc = await scanDataMatrix(currentLabel.imageUrl, bcArea, labelRules?.imageRotation || 0);
      if (bc) {
        updatedLabels[i]._debugBarcodeImg = bc.debugImage;
        updatedLabels[i].rawBarcodeText = bc.text;
        if (bc.parsedData) {
          foundRef = bc.parsedData.ref;
          barcodeSeq = bc.parsedData.seq;
        }
      }

      if (!foundRef && labelRules?.ocrArea) {
         const ocrRes = await cropImage(currentLabel.imageUrl, labelRules.ocrArea, labelRules.imageRotation || 0, 'ultra-sharp');
         if (typeof ocrRes !== 'string') {
            updatedLabels[i]._debugOcrImg = ocrRes.strip;
            foundRef = cleanAmazonRef(await performCharacterOCR(ocrRes.chars));
         }
      }
      if (!foundRef) foundRef = currentLabel.extractedAmazonRef;

      if (foundRef) {
        const match = muelleMap.get(normalizeForMatch(foundRef));
        if (match) {
          updatedLabels[i].matchedOrderNumber = match.orderNumber;
          updatedLabels[i].matchedAmazonRef = match.amazonRef;
          updatedLabels[i].status = 'success';
          updatedLabels[i].extractedAmazonRef = foundRef;
          // Guardamos temporalmente la secuencia encontrada en el barcode
          (updatedLabels[i] as any)._barcodeSeq = barcodeSeq;
        } else {
          updatedLabels[i].status = 'error';
          updatedLabels[i].error = 'No en muelle';
          updatedLabels[i].extractedAmazonRef = foundRef;
        }
      } else {
        updatedLabels[i].status = 'error';
        updatedLabels[i].error = 'Sin referencia';
      }
      if (i % 2 === 0) setLabels([...updatedLabels]);
    }

    // Segunda pasada: Recalcular totales por pedido
    const orderGroups = new Map<string, ProcessedLabel[]>();
    updatedLabels.forEach(l => {
      if (l.matchedOrderNumber) {
        const group = orderGroups.get(l.matchedOrderNumber) || [];
        group.push(l);
        orderGroups.set(l.matchedOrderNumber, group);
      }
    });

    orderGroups.forEach((group, orderId) => {
      const total = group.length;
      // Ordenamos por la secuencia detectada en el barcode para asignar el X de Y correcto
      group.sort((a, b) => ((a as any)._barcodeSeq || 0) - ((b as any)._barcodeSeq || 0));
      group.forEach((label, idx) => {
        label.packageInfo = `${idx + 1}/${total}`;
      });
    });

    setLabels([...updatedLabels]);
    setOcrProgress(null);
    setIsProcessingLabels(false);
  }, [labels, muelleData, labelRules]);

  const resetAll = () => { if (confirm("¿Reiniciar?")) { setLabels([]); setMuelleData([]); setLabelRules(null); setSamplePage(null); setResetKey(prev => prev + 1); } };

  if (showPrintMode) return <LabelPrinter labels={labels} onClose={() => setShowPrintMode(false)} />;

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-slate-950 text-white py-8 px-6 mb-10 shadow-2xl relative">
        <div className="max-w-7xl mx-auto flex justify-between items-center relative z-10">
          <div className="flex items-center gap-6">
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-xl transform hover:scale-105 transition-transform"><svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg></div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">GD <span className="text-indigo-500">Etiquetas</span></h1>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-2">Logística Automatizada v2.9</p>
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={resetAll} className="px-6 py-3 bg-red-600/5 hover:bg-red-600 text-red-500 hover:text-white rounded-xl font-black uppercase text-[10px] border border-red-600/10 transition-all">Limpiar</button>
            {summary.matched > 0 && <button onClick={() => setShowPrintMode(true)} className="px-10 py-3 bg-green-500 hover:bg-green-400 text-white rounded-xl font-black uppercase text-xs shadow-xl transition-all flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>Imprimir ({summary.matched})</button>}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <MuelleUploader key={`muelle-${resetKey}`} onDataLoaded={handleMuelleLoaded} isLoading={isProcessingMuelle} onLoadingChange={setIsProcessingMuelle} loadedCount={muelleData.length} muelleData={muelleData} />
          <LabelUploader key={`labels-${resetKey}`} onFilesSelected={handleLabelsSelected} disabled={isProcessingMuelle} />
        </div>
        {ocrProgress && <div className="bg-slate-900 text-white p-10 rounded-3xl shadow-2xl border border-white/5"><div className="flex justify-between items-end mb-6"><div className="space-y-2"><p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Motor de Visión Activo</p><h4 className="text-lg font-black uppercase truncate max-w-xl">{ocrProgress.status}</h4></div><span className="text-5xl font-black italic text-indigo-500">{ocrProgress.progress}%</span></div><div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden"><div className="bg-indigo-500 h-full rounded-full transition-all duration-500 shadow-[0_0_20px_rgba(99,102,241,0.5)]" style={{ width: `${ocrProgress.progress}%` }}></div></div></div>}
        {labels.length > 0 && !ocrProgress && <div className="bg-white border-2 border-slate-100 p-12 rounded-3xl shadow-xl flex flex-col lg:flex-row items-center justify-between gap-12"><div className="flex gap-20"><StatsBox label="Total" value={summary.total} /><StatsBox label="Listas" value={summary.matched} color="green" /><StatsBox label="Sin Cruce" value={summary.pending} color="red" /></div><button onClick={startProcessing} disabled={isProcessingLabels || muelleData.length === 0} className={`px-20 py-7 rounded-2xl font-black shadow-2xl transform transition-all uppercase tracking-widest text-sm ${muelleData.length === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-105'}`}>Cruzar Etiquetas</button></div>}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">{labels.map(l => <LabelCard key={l.id} label={l} />)}</div>
      </main>
      {showLabelConfig && samplePage && <LabelConfigurator pageData={samplePage} onSave={(rules) => { setLabelRules(rules); setShowLabelConfig(false); }} onClose={() => setShowLabelConfig(false)} />}
    </div>
  );
};

const StatsBox = ({ label, value, color }: { label: string, value: number, color?: string }) => (
  <div className="text-center">
    <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${color === 'green' ? 'text-green-500' : color === 'red' ? 'text-red-400' : 'text-slate-400'}`}>{label}</p>
    <p className={`text-6xl font-black tracking-tighter ${color === 'green' ? 'text-green-600' : color === 'red' ? 'text-red-500' : 'text-slate-900'}`}>{value}</p>
  </div>
);

export default App;
