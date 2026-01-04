import React, { useState, useRef } from 'react';
import { ReportData } from '../utils/pdfGenerator';

interface ReportSidebarProps {
    onClose: () => void;
    onSendReport: (reportData: ReportData) => void;
}

interface AdvancedTextAreaProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    mono?: boolean;
}

const AdvancedTextArea: React.FC<AdvancedTextAreaProps> = ({ label, value, onChange, placeholder, mono }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const insertFormat = (prefix: string, suffix: string = '') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = value.substring(start, end);
        const newText = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end);
        onChange(newText);

        // Restore cursor position
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + prefix.length, end + prefix.length);
        }, 0);
    };

    const addBullet = () => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const beforeCursor = value.substring(0, start);
        const afterCursor = value.substring(start);

        // Check if we're at the start of a line
        const lastNewline = beforeCursor.lastIndexOf('\n');
        const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
        const currentLineStart = value.substring(lineStart, start);

        if (currentLineStart.trim() === '') {
            // Empty line, add bullet
            const newText = beforeCursor + '• ' + afterCursor;
            onChange(newText);
        } else {
            // Add bullet on new line
            const newText = beforeCursor + '\n• ' + afterCursor;
            onChange(newText);
        }
    };

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-400 uppercase">{label}</label>
                <div className="flex items-center gap-1">
                    {/* Format buttons */}
                    <button
                        type="button"
                        onClick={() => insertFormat('**', '**')}
                        className="p-1 text-slate-500 hover:text-white hover:bg-slate-600 rounded text-xs font-bold"
                        title="Bold"
                    >
                        B
                    </button>
                    <button
                        type="button"
                        onClick={() => insertFormat('_', '_')}
                        className="p-1 text-slate-500 hover:text-white hover:bg-slate-600 rounded text-xs italic"
                        title="Italic"
                    >
                        I
                    </button>
                    <button
                        type="button"
                        onClick={addBullet}
                        className="p-1 text-slate-500 hover:text-white hover:bg-slate-600 rounded text-xs"
                        title="Add bullet"
                    >
                        •
                    </button>
                    <div className="w-px h-3 bg-slate-600 mx-1"></div>
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1 text-slate-500 hover:text-white hover:bg-slate-600 rounded"
                        title={isExpanded ? 'Shrink' : 'Expand'}
                    >
                        {isExpanded ? (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
            <textarea
                ref={textareaRef}
                value={value}
                onChange={e => onChange(e.target.value)}
                rows={isExpanded ? 8 : 3}
                className={`w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white placeholder-slate-500 resize-none transition-all duration-200 focus:ring-1 focus:ring-rology-accent focus:border-rology-accent ${mono ? 'font-mono' : ''}`}
                placeholder={placeholder}
            />
        </div>
    );
};

const ReportSidebar: React.FC<ReportSidebarProps> = ({ onClose, onSendReport }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const [title, setTitle] = useState('Transthoracic Echocardiogram');
    const [findings, setFindings] = useState('');
    const [measurements, setMeasurements] = useState('');
    const [conclusion, setConclusion] = useState('');

    const date = new Date().toLocaleDateString();
    const accessionNumber = `#${Math.floor(Math.random() * 9000000) + 1000000}`;

    const generateAIReport = async () => {
        setIsGenerating(true);
        await new Promise(resolve => setTimeout(resolve, 1500));

        setFindings(
            'Left ventricle is normal in size. Wall thickness is normal. Global systolic function is preserved with estimated LVEF 60-65%. No regional wall motion abnormalities. Right ventricle normal. No pericardial effusion.'
        );
        setMeasurements(
            '• LVIDd: 4.6 cm\n• LVIDs: 3.0 cm\n• IVSd: 0.9 cm\n• LVPWd: 0.9 cm\n• LA Vol Index: 28 ml/m²\n• LVEF: 62%'
        );
        setConclusion('Normal LV systolic function. No significant valvular disease.');
        setIsGenerating(false);
    };

    const captureScreenshot = (): string | undefined => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
            return (canvas as HTMLCanvasElement).toDataURL('image/png');
        }
        return undefined;
    };

    const handleSendReport = async () => {
        if (!findings.trim() || !conclusion.trim()) {
            alert('Please fill in Findings and Conclusion.');
            return;
        }

        setIsSending(true);
        const screenshot = captureScreenshot();

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
    };

    return (
        <div className="w-96 bg-slate-800 border-r border-slate-700 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="bg-slate-900 p-3 border-b border-slate-700 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">Report</span>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Title & AI Button */}
                <div className="flex justify-between items-start gap-2">
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="flex-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white font-semibold focus:ring-1 focus:ring-rology-accent"
                    />
                    <button
                        onClick={generateAIReport}
                        disabled={isGenerating}
                        className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded shadow"
                    >
                        {isGenerating ? (
                            <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        )}
                        AI Fill
                    </button>
                </div>

                <p className="text-slate-500 text-xs">{date} | Acc: {accessionNumber}</p>

                {/* Advanced Text Areas */}
                <AdvancedTextArea
                    label="Findings"
                    value={findings}
                    onChange={setFindings}
                    placeholder="Clinical findings..."
                />

                <AdvancedTextArea
                    label="Measurements"
                    value={measurements}
                    onChange={setMeasurements}
                    placeholder="• LVIDd:&#10;• LVEF:"
                    mono
                />

                <AdvancedTextArea
                    label="Conclusion"
                    value={conclusion}
                    onChange={setConclusion}
                    placeholder="Summary and impression..."
                />
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-700 shrink-0 flex gap-2">
                <button
                    onClick={onClose}
                    className="flex-1 px-3 py-2 text-slate-400 hover:text-white text-sm border border-slate-600 rounded hover:border-slate-500 transition"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSendReport}
                    disabled={isSending || (!findings.trim() && !conclusion.trim())}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-rology-accent hover:bg-cyan-400 disabled:bg-slate-600 text-slate-900 font-bold text-sm rounded transition"
                >
                    {isSending ? (
                        <div className="w-3 h-3 border border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></div>
                    ) : (
                        <>
                            Send
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default ReportSidebar;

