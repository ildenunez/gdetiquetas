
import React, { useState, useCallback, useEffect } from 'react';
import MuelleUploader from './components/MuelleUploader.tsx';
import LabelUploader from './components/LabelUploader.tsx';
import LabelCard from './components/LabelCard.tsx';
import LabelPrinter from './components/LabelPrinter.tsx';
import LabelConfigurator from './components/LabelConfigurator.tsx';
import { MuelleData, ProcessedLabel, LabelRules, RawToken, PdfPageResult } from './types.ts';
import { convertPdfToImages } from './services/pdfService.ts';
import { parseAmazonLabelLocal, extractLabelBySpatialRules, tokenizeText } from './services/localParser.ts';
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
            packageInfo: localExtract.packageInfo,
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

  const startProcessing = useCallback(async () => {
    if (labels.length === 0 || isProcessingLabels) return;
    setIsProcessingLabels(true);

    const pendingLabels = labels.filter(l => l.status === 'pending' || l.status === 'error' || l.status === 'processing');
    let count = 0;

    for (const label of pendingLabels) {
      count++;
      setLabels(current => current.map(l => l.id === label.id ? { ...l, status: 'processing' } : l));
      setOcrProgress({ status: `Etiqueta ${count}/${pendingLabels.length}`, progress: 10 });

      let amazonRef = label.extractedAmazonRef;
      let packageInfo = label.packageInfo;
      let rawBarcode = null;
      let debugImg = undefined;
      const tokens: RawToken[] = (label as any)._tokens || [];

      // 1. PRIORIDAD: Escaneo de DataMatrix con recorte de zona (AMARILLO)
      setOcrProgress({ status: `Escaneando DataMatrix...`, progress: 30 });
      const barcodeResult = await scanDataMatrix(label.imageUrl, labelRules?.barcodeArea);
      
      if (barcodeResult) {
        rawBarcode = barcodeResult.text;
        debugImg = barcodeResult.debugImage;
        const refFromBarcode = extractAmazonRefFromBarcode(barcodeResult.text);
        if (refFromBarcode) amazonRef = refFromBarcode;
      }

      // 2. REGLAS ESPACIALES: Solo para bultos (NARANJA)
      if (labelRules && tokens.length > 0) {
        const spatial = extractLabelBySpatialRules(tokens, labelRules);
        if (spatial.packageInfo) packageInfo = spatial.packageInfo;
      }

      // 3. BACKUP IA: Solo si falta algo vital
      if (!amazonRef || !packageInfo) {
        setOcrProgress({ status: `Consultando IA...`, progress: 80 });
        try {
          const aiResult = await extractLabelDetails(label.imageUrl);
          if (aiResult.amazonRef && !amazonRef) amazonRef = aiResult.amazonRef;
          if (aiResult.packageInfo && !packageInfo) packageInfo = aiResult.packageInfo;
        } catch (e) {
          console.error("Gemini falló", e);
        }
      }

      // 4. CRUCE CON EL MUELLE
      let matchedOrder: string | null = null;
      if (amazonRef && muelleData.length > 0) {
        const cleanRef = amazonRef.trim().toUpperCase();
        const match = muelleData.find(m => {
          const mRef = m.amazonRef.trim().toUpperCase();
          return cleanRef.includes(mRef) || mRef.includes(cleanRef);
        });
        matchedOrder = match ? match.orderNumber : null;
      }

      setLabels(current => current.map(l => l.id === label.id ? { 
        ...l, 
        status: matchedOrder ? 'success' : 'error',
        extractedAmazonRef: amazonRef,
        rawBarcodeText: rawBarcode,
        packageInfo: packageInfo,
        matchedOrderNumber: matchedOrder,
        _debugBarcodeImg: debugImg 
      } : l));
    }

    setOcrProgress(null);
    setIsProcessingLabels(false);
  }, [labels, muelleData, isProcessingLabels, labelRules]);

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
          <div className="flex items-center gap-3 no-print">
            <button onClick={() => { setLabels([]); setMuelleData([]); setShowMuelleTable(false); setLabelRules(null); }} className="px-4 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors">
              Reiniciar Todo
            </button>
            {summary.matched > 0 && (
              <button onClick={() => setShowPrintMode(true)} className="px-6 py-2 text-sm font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 shadow-lg transition-all">
                IMPRIMIR ({summary.matched})
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 no-print">
          <MuelleUploader onDataLoaded={handleMuelleLoaded} isLoading={isProcessingMuelle} onLoadingChange={setIsProcessingMuelle} />
          <div className="space-y-4">
            <LabelUploader onFilesSelected={handleLabelsSelected} disabled={isProcessingMuelle} />
            {labelRules && (
              <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl shadow-sm">
                <span className="text-xs font-bold text-indigo-700 flex items-center gap-2 uppercase tracking-tight">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  Detección por Zonas Activa
                </span>
                <button onClick={() => setShowLabelConfig(true)} className="text-[10px] font-black text-indigo-600 hover:underline uppercase">Editar Zonas</button>
              </div>
            )}
          </div>
        </div>

        {muelleData.length > 0 && showMuelleTable && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm no-print">
            <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                Muelle Cargado ({muelleData.length} registros)
              </h3>
              <button onClick={() => setShowMuelleTable(!showMuelleTable)} className="text-xs text-indigo-600 font-bold hover:underline">
                {showMuelleTable ? 'Ocultar' : 'Ver'}
              </button>
            </div>
            {showMuelleTable && (
              <div className="max-h-60 overflow-y-auto p-4">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b">
                      <th className="pb-2 font-bold uppercase text-[10px]">Pedido</th>
                      <th className="pb-2 font-bold uppercase text-[10px]">Amazon Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {muelleData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 font-mono font-bold text-indigo-600">{item.orderNumber}</td>
                        <td className="py-2 font-mono text-slate-600">{item.amazonRef}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {ocrProgress && (
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-2xl no-print">
            <div className="flex justify-between items-center mb-4">
               <span className="font-bold text-indigo-400 uppercase tracking-widest text-sm">{ocrProgress.status}</span>
               <span className="text-2xl font-black">{ocrProgress.progress}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
              <div className="bg-indigo-500 h-full transition-all duration-300 ease-out" style={{ width: `${ocrProgress.progress}%` }}></div>
            </div>
          </div>
        )}

        {labels.length > 0 && !ocrProgress && (
          <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-white border border-slate-200 rounded-2xl shadow-lg gap-4 no-print">
            <div className="flex gap-8">
              <div className="text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Etiquetas</p>
                <p className="text-2xl font-black">{summary.total}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-green-500 font-bold uppercase">Cruzadas</p>
                <p className="text-2xl font-black text-green-600">{summary.matched}</p>
              </div>
            </div>
            
            <button 
              onClick={startProcessing}
              disabled={isProcessingLabels}
              className={`px-12 py-4 rounded-xl font-black text-white shadow-2xl transition-all transform active:scale-95 ${
                isProcessingLabels ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isProcessingLabels ? 'ANALIZANDO...' : 'INICIAR PROCESADO TÉCNICO'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
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

      {showPrintMode && (
        <LabelPrinter labels={labels} onClose={() => setShowPrintMode(false)} />
      )}
    </div>
  );
};

export default App;
