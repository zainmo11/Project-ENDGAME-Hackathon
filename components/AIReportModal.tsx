import React, { useState, useEffect } from 'react';

const AIReportModal: React.FC<{ onClose: () => void; onSendReport?: (report: string) => void }> = ({ onClose, onSendReport }) => {
  const [step, setStep] = useState<'analyzing' | 'generating' | 'done'>('analyzing');

  useEffect(() => {
    const t1 = setTimeout(() => setStep('generating'), 2000);
    const t2 = setTimeout(() => setStep('done'), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white text-slate-900 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">

        {step !== 'done' ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-rology-500 border-t-transparent rounded-full animate-spin"></div>
              <svg className="absolute inset-0 m-auto w-8 h-8 text-rology-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">
                {step === 'analyzing' ? 'Rology AI: Analyzing Stream...' : 'Generating Structured Report...'}
              </h3>
              <p className="text-slate-500 mt-2">Extracting measurements and detecting anomalies.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-rology-900 text-white p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-rology-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className="font-bold">Preliminary Report (AI Generated)</span>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-8 font-serif">
              <div className="border-b-2 border-slate-100 pb-4 mb-6 flex justify-between items-end">
                <div>
                  <h1 className="text-2xl font-bold text-slate-800">Transthoracic Echocardiogram</h1>
                  <p className="text-slate-500 text-sm">Date: {new Date().toLocaleDateString()} | Acc: #8829391</p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-rology-500 uppercase tracking-wider">Status</div>
                  <div className="text-green-600 font-bold">Approved</div>
                </div>
              </div>

              <div className="space-y-6 text-sm">
                <section>
                  <h4 className="font-bold text-slate-700 uppercase text-xs mb-2 border-b border-slate-100">Findings</h4>
                  <p className="leading-relaxed text-slate-600">
                    Left ventricle is normal in size. Wall thickness is normal.
                    Global systolic function is preserved with estimated <strong className="text-slate-900 bg-yellow-100 px-1">LVEF 60-65%</strong>.
                    No regional wall motion abnormalities detected.
                  </p>
                </section>

                <section>
                  <h4 className="font-bold text-slate-700 uppercase text-xs mb-2 border-b border-slate-100">Measurements</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex justify-between border-b border-dotted border-slate-200 py-1"><span>LVIDd</span> <span>4.6 cm</span></div>
                    <div className="flex justify-between border-b border-dotted border-slate-200 py-1"><span>IVSd</span> <span>0.9 cm</span></div>
                    <div className="flex justify-between border-b border-dotted border-slate-200 py-1"><span>LA Vol Index</span> <span>28 ml/m²</span></div>
                    <div className="flex justify-between border-b border-dotted border-slate-200 py-1"><span>Ao Root</span> <span>3.1 cm</span></div>
                  </div>
                </section>

                <section>
                  <h4 className="font-bold text-slate-700 uppercase text-xs mb-2 border-b border-slate-100">AI Conclusion</h4>
                  <p className="leading-relaxed font-medium text-slate-800">
                    Normal LV systolic function. No significant valvular disease.
                  </p>
                </section>
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:text-slate-900">Discard</button>
              <button onClick={() => {
                const reportText = `TRANSTHORACIC ECHOCARDIOGRAM\nDate: ${new Date().toLocaleDateString()}\n\nFINDINGS:\nLeft ventricle normal in size. Wall thickness normal. Global systolic function preserved with LVEF 60-65%. No regional wall motion abnormalities.\n\nMEASUREMENTS:\n• LVIDd: 4.6 cm\n• IVSd: 0.9 cm\n• LA Vol Index: 28 ml/m²\n• Ao Root: 3.1 cm\n\nCONCLUSION:\nNormal LV systolic function. No significant valvular disease.`;
                onSendReport?.(reportText);
                onClose();
              }} className="px-6 py-2 bg-rology-500 hover:bg-rology-400 text-white font-bold rounded shadow-lg shadow-blue-500/20 flex items-center gap-2">
                <span>Sign & Send to Tech</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AIReportModal;