import React, { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { generateReportPDF, ReportData } from '../utils/pdfGenerator';

interface ReportFormModalProps {
    onClose: () => void;
    onSendReport: (reportData: ReportData) => void;
    ultrasoundCanvasRef?: React.RefObject<HTMLCanvasElement>;
}

const ReportFormModal: React.FC<ReportFormModalProps> = ({ onClose, onSendReport, ultrasoundCanvasRef }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const [title, setTitle] = useState('Transthoracic Echocardiogram');
    const [findings, setFindings] = useState('');
    const [measurements, setMeasurements] = useState('');
    const [conclusion, setConclusion] = useState('');

    const date = new Date().toLocaleDateString();
    const accessionNumber = `#${Math.floor(Math.random() * 9000000) + 1000000}`;

    // Simulate AI report generation
    const generateAIReport = async () => {
        setIsGenerating(true);

        // Simulate AI processing time
        await new Promise(resolve => setTimeout(resolve, 2000));

        setFindings(
            'Left ventricle is normal in size. Wall thickness is normal. Global systolic function is preserved with estimated LVEF 60-65%. No regional wall motion abnormalities detected. Right ventricle is normal in size and function. Both atria are normal. No pericardial effusion.'
        );
        setMeasurements(
            '• LVIDd: 4.6 cm\n• LVIDs: 3.0 cm\n• IVSd: 0.9 cm\n• LVPWd: 0.9 cm\n• LA Vol Index: 28 ml/m²\n• Ao Root: 3.1 cm\n• LVEF: 62%'
        );
        setConclusion(
            'Normal LV systolic function. No significant valvular disease. Normal cardiac chamber sizes.'
        );

        setIsGenerating(false);
    };

    const captureScreenshot = async (): Promise<string | undefined> => {
        // Try to capture the ultrasound canvas
        if (ultrasoundCanvasRef?.current) {
            return ultrasoundCanvasRef.current.toDataURL('image/png');
        }

        // Fallback: try to find any ultrasound canvas on the page
        const canvas = document.querySelector('canvas');
        if (canvas) {
            return (canvas as HTMLCanvasElement).toDataURL('image/png');
        }

        return undefined;
    };

    const handleSendReport = async () => {
        if (!findings.trim() || !conclusion.trim()) {
            alert('Please fill in at least the Findings and Conclusion fields.');
            return;
        }

        setIsSending(true);

        try {
            const screenshot = await captureScreenshot();

            const reportData: ReportData = {
                title,
                date,
                accessionNumber,
                findings,
                measurements,
                conclusion,
                screenshotDataUrl: screenshot
            };

            onSendReport(reportData);
            onClose();
        } catch (error) {
            console.error('Error sending report:', error);
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white text-slate-900 w-full max-w-3xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col">

                {/* Header */}
                <div className="bg-rology-900 text-white p-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-rology-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="font-bold">Report Form</span>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Report Header Info */}
                    <div className="flex justify-between items-end border-b border-slate-200 pb-4">
                        <div>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="text-xl font-bold text-slate-800 border-none p-0 focus:ring-0 bg-transparent w-full"
                                placeholder="Report Title"
                            />
                            <p className="text-slate-500 text-sm mt-1">Date: {date} | Acc: {accessionNumber}</p>
                        </div>
                        <button
                            onClick={generateAIReport}
                            disabled={isGenerating}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 transition shadow-lg"
                        >
                            {isGenerating ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    Generate with AI
                                </>
                            )}
                        </button>
                    </div>

                    {/* Findings */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                            Findings
                        </label>
                        <textarea
                            value={findings}
                            onChange={e => setFindings(e.target.value)}
                            rows={4}
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rology-500 focus:border-rology-500 text-sm resize-none"
                            placeholder="Enter clinical findings..."
                        />
                    </div>

                    {/* Measurements */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                            Measurements
                        </label>
                        <textarea
                            value={measurements}
                            onChange={e => setMeasurements(e.target.value)}
                            rows={4}
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rology-500 focus:border-rology-500 text-sm font-mono resize-none"
                            placeholder="• LVIDd: &#10;• IVSd: &#10;• LVEF: "
                        />
                    </div>

                    {/* Conclusion */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                            Conclusion
                        </label>
                        <textarea
                            value={conclusion}
                            onChange={e => setConclusion(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rology-500 focus:border-rology-500 text-sm resize-none"
                            placeholder="Summary and final impression..."
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:text-slate-900"
                    >
                        Discard
                    </button>
                    <button
                        onClick={handleSendReport}
                        disabled={isSending || (!findings.trim() && !conclusion.trim())}
                        className="flex items-center gap-2 px-6 py-2.5 bg-rology-500 hover:bg-rology-400 disabled:bg-slate-300 text-white font-bold rounded-lg shadow-lg transition"
                    >
                        {isSending ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Sending...
                            </>
                        ) : (
                            <>
                                <span>Sign & Send to Tech</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportFormModal;
