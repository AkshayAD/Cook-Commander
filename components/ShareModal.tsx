import React, { useState, useRef } from 'react';
import { X, Share2, Download, Copy, Phone, Loader2, Image as ImageIcon } from 'lucide-react';
import html2canvas from 'html2canvas';
import { WeeklyPlan, GroceryItem } from '../types';
import ShareableCard from './ShareableCard';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'plan' | 'grocery';
    data: WeeklyPlan | GroceryItem[];
    dateRange: string;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, type, data, dateRange }) => {
    const [loading, setLoading] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    const cookName = localStorage.getItem('cook_name');
    const cookNumber = localStorage.getItem('cook_number');

    if (!isOpen) return null;

    const generateImage = async (): Promise<Blob | null> => {
        // Find the element by ID rendered inside the modal
        const element = document.getElementById('share-card-container');
        if (!element) return null;

        try {
            const canvas = await html2canvas(element, {
                scale: 2, // Retína quality
                backgroundColor: '#ffffff',
                useCORS: true
            });
            return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        } catch (err) {
            console.error('Image generation failed', err);
            return null;
        }
    };

    const handleNativeShare = async () => {
        setLoading(true);
        const blob = await generateImage();
        if (!blob) {
            setLoading(false);
            return;
        }

        const file = new File([blob], `cook-commander-${type}-${dateRange}.png`, { type: 'image/png' });

        if (navigator.share && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'Cook Commander Plan',
                    text: `Here is the ${type === 'plan' ? 'Meal Plan' : 'Grocery List'} for ${dateRange}.`
                });
            } catch (err) {
                console.log('Share cancelled or failed', err);
            }
        } else {
            alert('Native sharing not supported on this device. Please use Download or Copy.');
        }
        setLoading(false);
    };

    const handleDownload = async () => {
        setLoading(true);
        const blob = await generateImage();
        if (!blob) {
            setLoading(false);
            return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `cook-commander-${type}-${dateRange}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setLoading(false);
    };

    const handleCopy = async () => {
        setLoading(true);
        const blob = await generateImage();
        if (!blob) {
            setLoading(false);
            return;
        }

        try {
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            alert('Image copied to clipboard!');
        } catch (err) {
            alert('Failed to copy image. Browser may not support it.');
        }
        setLoading(false);
    };

    const handleSendToCook = async () => {
        if (!cookNumber) {
            alert("Please set Cook's number in Settings first.");
            return;
        }

        // Since we can't attach image programmatically to WhatsApp Web link,
        // we guide the user to Share (mobile) or Copy/Download (desktop).

        // Better UX: Try native share first. If fails (desktop), open WA and tell user to paste.

        setLoading(true);
        const blob = await generateImage();
        if (!blob) {
            setLoading(false);
            return;
        }

        const file = new File([blob], `plan.png`, { type: 'image/png' });

        // Try native share (works on mobile with WhatsApp installed)
        if (navigator.share && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'For Cook',
                    text: `Hi ${cookName || 'Chef'}, here is the plan for ${dateRange}.`
                });
                setLoading(false);
                return;
            } catch (e) {
                // Fallthrough if cancelled or failed
            }
        }

        // Fallback logic for Desktop/No-Share support
        // 1. Copy image to clipboard automatically
        try {
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);

            // 2. Open WhatsApp Web info
            const text = encodeURIComponent(`Hi ${cookName || 'Chef'}, here is the plan for ${dateRange}. (Image copied to clipboard, please paste it here)`);
            window.open(`https://wa.me/${cookNumber}?text=${text}`, '_blank');

            // 3. Inform user
            // alert("Opening WhatsApp... The plan image has been copied to your clipboard. Just paste (Ctrl+V) it into the chat!");
        } catch (err) {
            // If copy fails
            handleDownload();
            const text = encodeURIComponent(`Hi ${cookName || 'Chef'}, here is the plan for ${dateRange}. (Please attach the downloaded image)`);
            window.open(`https://wa.me/${cookNumber}?text=${text}`, '_blank');
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Share2 className="w-5 h-5 text-purple-600" />
                        Share {type === 'plan' ? 'Meal Plan' : 'Grocery List'}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full text-gray-500">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-100 flex justify-center">
                    {/* Wrapper to center and shadow the preview */}
                    <div className="shadow-2xl rounded-sm overflow-hidden transform scale-90 sm:scale-100 origin-top">
                        <div id="share-card-container">
                            <ShareableCard type={type} data={data} dateRange={dateRange} />
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-gray-100 bg-white rounded-b-2xl space-y-3">

                    {cookNumber && (
                        <button
                            onClick={handleSendToCook}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-md mb-2"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Phone className="w-5 h-5" />}
                            Send to {cookName || "Cook"} (WhatsApp)
                        </button>
                    )}

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <button
                            onClick={handleNativeShare}
                            className="flex flex-col items-center justify-center p-3 gap-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-700 transition-colors border border-gray-200"
                        >
                            <Share2 className="w-5 h-5" />
                            <span className="text-xs font-medium">Share App</span>
                        </button>

                        <button
                            onClick={handleCopy}
                            className="flex flex-col items-center justify-center p-3 gap-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-700 transition-colors border border-gray-200"
                        >
                            <Copy className="w-5 h-5" />
                            <span className="text-xs font-medium">Copy Image</span>
                        </button>

                        <button
                            onClick={handleDownload}
                            className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center p-3 gap-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-700 transition-colors border border-gray-200"
                        >
                            <Download className="w-5 h-5" />
                            <span className="text-xs font-medium">Download</span>
                        </button>
                    </div>

                    {!cookNumber && (
                        <p className="text-center text-xs text-gray-400">
                            Tip: Add your Cook's number in Settings for quick sharing!
                        </p>
                    )}

                </div>
            </div>
        </div>
    );
};

export default ShareModal;
