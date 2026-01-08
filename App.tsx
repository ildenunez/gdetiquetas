
import React, { useState, useCallback, useEffect } from 'react';
import MuelleUploader from './components/MuelleUploader.tsx';
import LabelUploader from './components/LabelUploader.tsx';
import LabelCard from './components/LabelCard.tsx';
import LabelPrinter from './components/LabelPrinter.tsx';
import LabelConfigurator from './components/LabelConfigurator.tsx';
import { MuelleData, ProcessedLabel, LabelRules, RawToken, PdfPageResult } from './types.ts';
import { convertPdfToImages } from './services/pdfService.ts';
import { parseAmazonLabelLocal, tokenizeText } from './services/localParser.ts';
import { scanDataMatrix, extractAmazonRefFromBarcode } from './services/barcodeService.ts';
import { extractLabelDetails } from './services/geminiService.ts';

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

  useEffect(() => {
    setSummary({
      total: labels.length,
      matched: labels.filter(l => l.matchedOrderNumber).length,
      pending: labels.filter(l => l.status === 'pending' || l.status === 'processing').length
    });
  }, [labels]);

  const handleMuelleLoaded = (data: MuelleData[]) => {
    setMuelleData(data);
    setShowMuelleTable(true);
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
            packageInfo: null, // Se calculará después del cruce
            matchedOrderNumber: null,
            status: 'pending',
            rawBarcodeText: null,
            rawOcrText: fullTextContent 
          });
          
          (newLabels[newLabels.length-1] as any)._tokens = tokens;
        });
      } catch (err) {
        console.error('Error al leer PDF:', file.name, err);
      }
    }

    setLabels(prev => [...prev, ...newLabels]);
    setIsProcessingLabels(false);
  };

  /**
   * Nueva lógica de conteo automático:
   * Agrupa etiquetas por referencia de Amazon y enumera 1/X, 2/X...
   */
  const calculatePackageCounts = (currentLabels: ProcessedLabel[]) => {
    const groups: Record<string, ProcessedLabel[]> = {};
    
    // Agrupar
    currentLabels.forEach(l => {
      const ref = l.extractedAmazonRef || 'UNKNOWN';
      if (!groups[ref]) groups[ref] = [];
      groups[ref].push(l);
    });

    // Asignar numeración
    return currentLabels.map(label => {
      const ref = label.extractedAmazonRef || 'UNKNOWN';
      const group = groups[ref];
      if (ref === 'UNKNOWN') return { ...label, packageInfo: '1/1' };
      
      const index = group.findIndex(g => g.id === label.id);
      return {
        ...label,
        packageInfo: `${index + 1}/${group.length}`
      };
    });
  };

  const startProcessing = useCallback(async () => {
    if (labels.length === 0 || isProcessingLabels) return;
    setIsProcessingLabels(true);

    const pendingLabels = labels.filter(l => l.status === 'pending' || l.status === 'error' || l.status === 'processing');
    let count = 0;
    
    // Usamos una copia local para ir actualizando
    let updatedLabels = [...labels];

    for (const label of pendingLabels) {
      count++;
      setOcrProgress({ status: `Analizando ${count}/${pendingLabels.length}`, progress: Math.round((count/pendingLabels.length)*100) });

      let amazonRef = label.extractedAmazonRef;
      let rawBarcode = null;
      let debugImg = undefined;

      // 1. ESCANEO DATAMATRIX (ZONA AMARILLA)
      const barcodeResult = await scanDataMatrix(label.imageUrl, labelRules?.barcodeArea);
      if (barcodeResult) {
        rawBarcode = barcodeResult.text;
        debugImg = barcodeResult.debugImage;
        const refFromBarcode = extractAmazonRefFromBarcode(barcodeResult.text);
        if (refFromBarcode) amazonRef = refFromBarcode;
      }

      // 2. IA DE RESPALDO - Solo si falló el DataMatrix y el texto local
      if (!amazonRef) {
        try {
          const aiResult = await extractLabelDetails(label.imageUrl);
          if (aiResult.amazonRef) amazonRef = aiResult.amazonRef;
        } catch (e) {
          console.error("Gemini falló", e);
        }
      }

      // 3. CRUCE CON MUELLE
      let matchedOrder: string | null = null;
      if (amazonRef && muelleData.length > 0) {
        const cleanRef = amazonRef.trim().toUpperCase();
        const match = muelleData.find(m => {
          const mRef = m.amazonRef.trim().toUpperCase();
          return cleanRef.includes(mRef) || mRef.includes(cleanRef);
        });
        matchedOrder = match ? match.orderNumber : null;
      }

      // Actualizar estado intermedio del label
      updatedLabels = updatedLabels.map(l => l.id === label.id ? { 
        ...l, 
        status: matchedOrder ? 'success' : 'error',
        extractedAmazonRef: amazonRef,
        rawBarcodeText: rawBarcode,
        matchedOrderNumber: matchedOrder,
        _debugBarcodeImg: debugImg 
      } : l);
      
      // Actualizar UI progresivamente
      setLabels([...updatedLabels]);
    }

    // PASO FINAL: Calcular conteo de bultos automático por repetición de referencia
    const finalLabels = calculatePackageCounts(updatedLabels);
    setLabels(finalLabels);

    setOcrProgress(null);
    setIsProcessingLabels(false);
  }, [labels, muelleData, isProcessingLabels, labelRules]);

  if (showPrintMode) {
    return <LabelPrinter labels={labels} onClose={() => setShowPrintMode(false)} />;
  }

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-slate-900 text-white py-6 px-4 mb-8 shadow-xl">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <svg className="w-8 h-8 text-orange-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
              GD Etiquetas
            </h1>
            <p className="text-slate-400 text-sm mt-1">Sánchez Giner I S.A. - Shiito Logistics</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setLabels([]); setMuelleData([]); setShowMuelleTable(false); setLabelRules(null); }} className="px-4 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700">
              Reiniciar
            </button>
            {summary.matched > 0 && (
              <button onClick={() => setShowPrintMode(true)} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black shadow-lg hover:bg-indigo-500 transition-all uppercase tracking-widest text-xs">
                IMPRIMIR ({summary.matched})
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MuelleUploader onDataLoaded={handleMuelleLoaded} isLoading={isProcessingMuelle} onLoadingChange={setIsProcessingMuelle} />
          <div className="space-y-4">
            <LabelUploader onFilesSelected={handleLabelsSelected} disabled={isProcessingMuelle} />
            {labelRules && (
              <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                <span className="text-xs font-bold text-indigo-700 uppercase">Zonas activas</span>
                <button onClick={() => setShowLabelConfig(true)} className="text-[10px] font-black text-indigo-600 uppercase">Ajustar DataMatrix</button>
              </div>
            )}
          </div>
        </div>

        {muelleData.length > 0 && showMuelleTable && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
             <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                <span className="font-bold text-slate-700 uppercase text-xs">Registros de Muelle</span>
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-black">{muelleData.length}</span>
             </div>
             <div className="max-h-40 overflow-y-auto p-4 text-[11px] font-mono grid grid-cols-2 gap-2">
                {muelleData.slice(0, 50).map((m, i) => (
                  <div key={i} className="flex justify-between p-1 border-b">
                    <span className="text-indigo-600 font-bold">{m.orderNumber}</span>
                    <span className="text-slate-400">{m.amazonRef}</span>
                  </div>
                ))}
             </div>
          </div>
        )}

        {ocrProgress && (
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center mb-4">
               <span className="font-bold text-indigo-400 uppercase tracking-widest text-xs">{ocrProgress.status}</span>
               <span className="text-xl font-black">{ocrProgress.progress}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${ocrProgress.progress}%` }}></div>
            </div>
          </div>
        )}

        {labels.length > 0 && !ocrProgress && (
          <div className="flex flex-col md:flex-row items-center justify-between p-8 bg-white border border-slate-200 rounded-3xl shadow-xl gap-6">
            <div className="flex gap-10">
              <div className="text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Total</p>
                <p className="text-3xl font-black">{summary.total}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-green-500 font-bold uppercase mb-1">Cruzadas</p>
                <p className="text-3xl font-black text-green-600">{summary.matched}</p>
              </div>
            </div>
            
            <button 
              onClick={startProcessing}
              disabled={isProcessingLabels}
              className={`px-16 py-5 rounded-2xl font-black text-white shadow-2xl transition-all transform active:scale-95 uppercase tracking-widest ${
                isProcessingLabels ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isProcessingLabels ? 'Procesando...' : 'Iniciar Cruce'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-6">
          {labels.map((label) => (
            <LabelCard key={label.id} label={label} />
          ))}
        </div>
      </main>

      {showLabelConfig && samplePage && (
        <LabelConfigurator 
          pageData={samplePage} 
          onSave={(rules) => { setLabelRules(rules); setShowLabelConfig(false); }}
          onClose={() => setShowLabelConfig(false)}
        />
      )}
    </div>
  );
};

export default App;
