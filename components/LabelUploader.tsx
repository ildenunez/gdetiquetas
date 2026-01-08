
import React from 'react';

interface LabelUploaderProps {
  onFilesSelected: (files: FileList) => void;
  disabled: boolean;
}

const LabelUploader: React.FC<LabelUploaderProps> = ({ onFilesSelected, disabled }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFilesSelected(e.target.files);
    }
  };

  return (
    <div className={`p-6 bg-white rounded-xl shadow-sm border border-slate-200 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
        2. Subir Etiquetas (PDF)
      </h3>
      <p className="text-sm text-slate-500 mb-4">
        Sube los archivos PDF que contienen las etiquetas de Amazon que quieres procesar.
      </p>
      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <svg className="w-8 h-8 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
          <p className="mb-2 text-sm text-slate-500">Sube uno o varios archivos PDF de etiquetas</p>
        </div>
        <input type="file" accept=".pdf" multiple className="hidden" onChange={handleChange} disabled={disabled} />
      </label>
    </div>
  );
};

export default LabelUploader;
