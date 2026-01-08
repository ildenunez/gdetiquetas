
import React, { useState, useCallback, useEffect } from 'react';
import MuelleUploader from './components/MuelleUploader.tsx';
import LabelUploader from './components/LabelUploader.tsx';
import LabelCard from './components/LabelCard.tsx';
import LabelPrinter from './components/LabelPrinter.tsx';
import { MuelleData, ProcessedLabel } from './types.ts';
import { convertPdfToImages } from './services/pdfService.ts';
import { extractLabelDetails } from './services/geminiService.ts';
import { parseAmazonLabelLocal } from './services/localParser.ts';

const CONCURRENCY_LIMIT = 3; 

const App: React.FC = () => {
  const [muelleData, setMuelleData] = useState<MuelleData[]>([]);
  const [labels, setLabels] = useState<ProcessedLabel[]>([]);
  const [isProcessingLabels, setIsProcessingLabels] = useState(false);
  const [isProcessingMuelle, setIsProcessingMuelle] = useState(false);
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
          // Intentar extracción local inmediata (Gratis)
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
        console.error('Error reading PDF:', file.name, err);
      }
    }

    setLabels(prev => [...prev, ...newLabels]);
    setIsProcessingLabels(false);
  };

  const startProcessing = useCallback(async () => {
    if (labels.length === 0 || isProcessingLabels) return;
    setIsProcessingLabels(true);

    const pendingLabels = labels.filter(l => l.status === 'pending');
    
    // Primero intentamos cruzar con lo que ya tenemos de la extracción local
    const updatedWithMatches = labels.map(label => {
      if (label.matchedOrderNumber) return label;
      
      let matchedOrder: string | null = null;
      if (label.extractedAmazonRef) {
        const cleanRef = label.extractedAmazonRef.trim().toLowerCase();
        const match = muelleData.find(m => {
          const mRef = m.amazonRef.trim().toLowerCase();
          return cleanRef === mRef || cleanRef.includes(mRef) || mRef.includes(cleanRef);
        });
        matchedOrder = match ? match.orderNumber : null;
      }
      
      return matchedOrder ? { ...label, matchedOrderNumber: matchedOrder, status: 'success' as const } : label;
    });

    setLabels(updatedWithMatches);

    // Si aún hay pendientes y hay API KEY, intentamos con IA (opcional)
    const stillPending = updatedWithMatches.filter(l => l.status === 'pending' && !l.matchedOrderNumber);
    const hasApiKey = process.env.API_KEY && process.env.API_KEY.length > 10;

    if (hasApiKey && stillPending.length > 0) {
      for (let i = 0; i < stillPending.length; i += CONCURRENCY_LIMIT) {
        const batch = stillPending.slice(i, i + CONCURRENCY_LIMIT);
        
        await Promise.all(batch.map(async (label) => {
          setLabels(current => current.map(l => l.id === label.id ? { ...l, status: 'processing' } : l));

          try {
            const result = await extractLabelDetails(label.imageUrl);
            let matchedOrder: string | null = null;
            
            if (result.amazonRef) {
              const cleanRef = result.amazonRef.trim().toLowerCase();
              const match = muelleData.find(m => {
                const mRef = m.amazonRef.trim().toLowerCase();
                return cleanRef === mRef || cleanRef.includes(mRef) || mRef.includes(cleanRef);
              });
              matchedOrder = match ? match.orderNumber : null;
            }

            setLabels(current => 
              current.map(l => l.id === label.id ? { 
                ...l, 
                status: matchedOrder ? 'success' : 'pending', 
                extractedAmazonRef: result.amazonRef || l.extractedAmazonRef,
                packageInfo: result.packageInfo || l.packageInfo,
                matchedOrderNumber: matchedOrder
              } : l)
            );
          } catch (error) {
            console.error("AI Error:", error);
            setLabels(current => current.map(l => l.id === label.id ? { ...l, status: 'error' } : l));
          }
        }));
      }
    } else if (!hasApiKey && stillPending.length > 0) {
        // Si no hay IA, marcamos como error o dejamos pendiente si no hubo match
        setLabels(current => current.map(l => l.status === 'pending' ? { ...l, status: l.extractedAmazonRef ? 'success' : 'error' } : l));
    }

    setIsProcessingLabels(false);
  }, [labels, muelleData, isProcessingLabels]);

  const resetAll = () => {
    if (confirm('¿Estás seguro de que quieres borrar todos los datos actuales?')) {
      setLabels([]);
      setMuelleData([]);
    }
  };

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
          <div className="flex items-center gap-3 print:hidden">
            <button 
              onClick={resetAll}
              className="px-4 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
            >
              Reiniciar
            </button>
            {summary.matched > 0 && (
              <button 
                onClick={() => setShowPrintMode(true)}
                className="px-6 py-2 text-sm font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors shadow-lg flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2-2v4" /></svg>
                IMPRESIÓN
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
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

        {muelleData.length > 0 && !isProcessingMuelle && (
           <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm print:hidden flex justify-between items-center">
              <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                Base de datos cargada ({muelleData.length} pedidos)
              </div>
              <span className="text-[10px] text-slate-400">MODO LOCAL ACTIVO</span>
           </div>
        )}

        {labels.length > 0 && (
          <div className="flex flex-col md:flex-row items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-xl gap-4 print:hidden">
            <div className="flex gap-4">
              <div className="text-sm">
                <span className="text-slate-500">Etiquetas:</span> 
                <span className="ml-1 font-bold text-slate-900">{summary.total}</span>
              </div>
              <div className="text-sm">
                <span className="text-slate-500">Cruzadas:</span> 
                <span className="ml-1 font-bold text-green-600">{summary.matched}</span>
              </div>
              <div className="text-sm">
                <span className="text-slate-500">Pendientes:</span> 
                <span className="ml-1 font-bold text-orange-600">{summary.pending}</span>
              </div>
            </div>
            
            <button 
              onClick={startProcessing}
              disabled={summary.pending === 0 || isProcessingLabels}
              className={`flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-white shadow-lg transition-all transform active:scale-95 ${
                isProcessingLabels ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isProcessingLabels ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Cruzando datos...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  CRUZAR ETIQUETAS
                </>
              )}
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
