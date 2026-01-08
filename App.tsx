
import React, { useState, useCallback, useEffect } from 'react';
import MuelleUploader from './components/MuelleUploader.tsx';
import LabelUploader from './components/LabelUploader.tsx';
import LabelCard from './components/LabelCard.tsx';
import LabelPrinter from './components/LabelPrinter.tsx';
import { MuelleData, ProcessedLabel } from './types.ts';
import { convertPdfToImages } from './services/pdfService.ts';
import { parseAmazonLabelLocal } from './services/localParser.ts';
import { performLocalOCR, OCRProgress } from './services/ocrService.ts';

const App: React.FC = () => {
  const [muelleData, setMuelleData] = useState<MuelleData[]>([]);
  const [labels, setLabels] = useState<ProcessedLabel[]>([]);
  const [isProcessingLabels, setIsProcessingLabels] = useState(false);
  const [isProcessingMuelle, setIsProcessingMuelle] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<OCRProgress | null>(null);
  const [showPrintMode, setShowPrintMode] = useState(false);
  const [summary, setSummary] = useState({ total: 0, matched: 0, pending: 0 });

  useEffect(() => {
    setSummary({
      total: labels.length,
      matched: labels.filter(l => l.matchedOrderNumber).length,
      pending: labels.filter(l => l.status === 'pending' || l.status === 'processing').length
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
        pages.forEach((page) => {
          const localExtract = parseAmazonLabelLocal(page.textContent);
          newLabels.push({
            id: Math.random().toString(36).substr(2, 9),
            originalFileName: file.name,
            pageNumber: page.pageNumber,
            imageUrl: page.imageUrl,
            extractedAmazonRef: localExtract.amazonRef,
            packageInfo: localExtract.packageInfo,
            matchedOrderNumber: null,
            status: 'pending'
          });
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

    const pendingLabels = labels.filter(l => l.status === 'pending' || l.status === 'error');
    let count = 0;

    for (const label of pendingLabels) {
      count++;
      setLabels(current => current.map(l => l.id === label.id ? { ...l, status: 'processing' } : l));

      let amazonRef = label.extractedAmazonRef;
      let packageInfo = label.packageInfo;

      // Si no tenemos texto (es una imagen/escaneo), forzamos OCR
      if (!amazonRef || amazonRef.length < 5) {
        setOcrProgress({ status: `Procesando etiqueta ${count}/${pendingLabels.length}`, progress: 0 });
        const ocrText = await performLocalOCR(label.imageUrl, (p) => setOcrProgress({ ...p, status: `Etiq. ${count}/${pendingLabels.length}: ${p.status}` }));
        const ocrExtract = parseAmazonLabelLocal(ocrText);
        amazonRef = ocrExtract.amazonRef;
        packageInfo = ocrExtract.packageInfo || packageInfo;
      }

      let matchedOrder: string | null = null;
      if (amazonRef) {
        const cleanRef = amazonRef.trim().toUpperCase();
        const match = muelleData.find(m => {
          const mRef = m.amazonRef.trim().toUpperCase();
          // Match flexible
          return cleanRef.includes(mRef) || mRef.includes(cleanRef) || (cleanRef.length > 8 && mRef.includes(cleanRef.substring(0, 8)));
        });
        matchedOrder = match ? match.orderNumber : null;
      }

      setLabels(current => current.map(l => l.id === label.id ? { 
        ...l, 
        status: matchedOrder ? 'success' : 'error',
        extractedAmazonRef: amazonRef,
        packageInfo: packageInfo,
        matchedOrderNumber: matchedOrder
      } : l));
    }

    setOcrProgress(null);
    setIsProcessingLabels(false);
  }, [labels, muelleData, isProcessingLabels]);

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
            <button onClick={() => { setLabels([]); setMuelleData([]); }} className="px-4 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700">
              Reiniciar
            </button>
            {summary.matched > 0 && (
              <button onClick={() => setShowPrintMode(true)} className="px-6 py-2 text-sm font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 shadow-lg">
                IMPRIMIR ({summary.matched})
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 no-print">
          <MuelleUploader 
            onDataLoaded={handleMuelleLoaded} 
            isLoading={isProcessingMuelle}
            onLoadingChange={setIsProcessingMuelle}
          />
          <LabelUploader 
            onFilesSelected={handleLabelsSelected} 
            disabled={muelleData.length === 0 || isProcessingMuelle} 
          />
        </div>

        {ocrProgress && (
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-2xl no-print animate-pulse">
            <div className="flex justify-between items-center mb-4">
               <span className="font-bold text-indigo-400 uppercase tracking-widest text-sm">{ocrProgress.status}</span>
               <span className="text-2xl font-black">{ocrProgress.progress}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
              <div 
                className="bg-indigo-500 h-full transition-all duration-300 ease-out"
                style={{ width: `${ocrProgress.progress}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-center uppercase">No cierres la pestaña mientras se realiza el escaneo profundo</p>
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
              {isProcessingLabels ? 'PROCESANDO...' : 'INICIAR CRUCE AUTOMÁTICO'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {labels.map((label) => (
            <LabelCard key={label.id} label={label} />
          ))}
        </div>
      </main>

      {showPrintMode && (
        <LabelPrinter labels={labels} onClose={() => setShowPrintMode(false)} />
      )}
    </div>
  );
};

export default App;
