
import React from 'react';
import { ProcessedLabel } from '../types';

interface LabelCardProps {
  label: ProcessedLabel;
}

const LabelCard: React.FC<LabelCardProps> = ({ label }) => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm flex flex-col">
      <div className="relative aspect-[3/4] bg-slate-100 overflow-hidden">
        <img src={label.imageUrl} alt="Label Preview" className="object-cover w-full h-full" />
        {label.status === 'processing' && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        )}
        
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {label.matchedOrderNumber && (
            <div className="bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded shadow-lg uppercase tracking-wider">
              #{label.matchedOrderNumber}
            </div>
          )}
          {label.packageInfo && (
            <div className="bg-white/90 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 shadow-sm w-fit">
              Bulto: {label.packageInfo}
            </div>
          )}
        </div>
      </div>
      
      <div className="p-3">
        <div className="flex justify-between items-start mb-2">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter truncate max-w-[120px]">
            {label.originalFileName} (Pág {label.pageNumber})
          </span>
          <StatusBadge status={label.status} />
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Ref. Amazon:</span>
            <span className="font-mono text-slate-800 font-semibold truncate max-w-[100px] text-right" title={label.extractedAmazonRef || ''}>
              {label.extractedAmazonRef || '---'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: ProcessedLabel['status'] }> = ({ status }) => {
  const config = {
    pending: { label: 'Pendiente', classes: 'bg-slate-100 text-slate-600' },
    processing: { label: 'Leyendo...', classes: 'bg-blue-100 text-blue-600' },
    success: { label: 'Listo', classes: 'bg-green-100 text-green-600' },
    error: { label: 'Error', classes: 'bg-red-100 text-red-600' }
  };
  const { label, classes } = config[status];
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${classes}`}>
      {label}
    </span>
  );
};

export default LabelCard;
