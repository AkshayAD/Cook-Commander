import React, { useState, useEffect, useCallback } from 'react';
import { X, Share2, Download, Copy, Phone, Loader2, Globe, AlertCircle } from 'lucide-react';
import html2canvas from 'html2canvas';
import { WeeklyPlan, GroceryItem } from '../types';
import ShareableCard from './ShareableCard';
import { translateMealPlanToHindi, translateGroceryListToHindi, AIConfig } from '../services/geminiService';
import { useSettings } from '../contexts/SettingsContext';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'plan' | 'grocery';
    data: WeeklyPlan | GroceryItem[];
    dateRange: string;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, type, data, dateRange }) => {
    const [loading, setLoading] = useState(false);
    const [translating, setTranslating] = useState(false);
    const [language, setLanguage] = useState<'en' | 'hi'>('en');
    const [translatedData, setTranslatedData] = useState<WeeklyPlan | GroceryItem[] | null>(null);
    const [translationError, setTranslationError] = useState<string | null>(null);

    const { apiKey, modelName } = useSettings();
    const config: AIConfig = { apiKey, modelName };

    const cookName = localStorage.getItem('cook_name');
    const cookNumber = localStorage.getItem('cook_number');

    // Reset translation when modal opens/closes or data changes
    useEffect(() => {
        setTranslatedData(null);
        setLanguage('en');
        setTranslationError(null);
    }, [isOpen, data]);

    // Handle language toggle with AI translation
    const handleLanguageToggle = useCallback(async () => {
        if (language === 'hi') {
            // Switch back to English - use original data
            setLanguage('en');
            setTranslatedData(null);
            setTranslationError(null);
            return;
        }

        // Check for API key before translating
        if (!apiKey) {
            setTranslationError('API key required for Hindi translation. Please add it in Settings.');
            return;
        }

        // Switch to Hindi - translate
        setTranslating(true);
        setTranslationError(null);

        try {
            if (type === 'plan') {
                const planData = data as WeeklyPlan;
                const translated = await translateMealPlanToHindi(planData, config);
                setTranslatedData({ days: translated.days });
            } else {
                const groceryData = data as GroceryItem[];
                const itemsForTranslation = groceryData.map(item => ({
                    item: item.item,
                    quantity: item.quantity,
                    category: item.category,
                    checked: item.checked
                }));
                const translated = await translateGroceryListToHindi(itemsForTranslation, config);
                setTranslatedData(translated.map((t, i) => ({
                    ...groceryData[i],
                    item: t.item,
                    quantity: t.quantity,
                    category: t.category
                })));
            }
            setLanguage('hi');
        } catch (error: any) {
            console.error('Translation failed:', error);
            setTranslationError(error.message || 'Translation failed. Please try again.');
        } finally {
            setTranslating(false);
        }
    }, [language, apiKey, type, data, config]);

    if (!isOpen) return null;

    // Use translated data if available, otherwise original
    const displayData = language === 'hi' && translatedData ? translatedData : data;

    const generateImage = async (): Promise<Blob | null> => {
        const element = document.getElementById('share-capture-container');
        if (!element) return null;

        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
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

        const file = new File([blob], `qookcommander-${type}-${dateRange.replace(/\s/g, '-')}.png`, { type: 'image/png' });

        if (navigator.share && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'QookCommander Plan',
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
        link.download = `qookcommander-${type}-${dateRange.replace(/\s/g, '-')}.png`;
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

        setLoading(true);
        const blob = await generateImage();
        if (!blob) {
            setLoading(false);
            return;
        }

        const file = new File([blob], `plan.png`, { type: 'image/png' });

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

        try {
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);

            const text = encodeURIComponent(`Hi ${cookName || 'Chef'}, here is the plan for ${dateRange}. (Image copied to clipboard, please paste it here)`);
            window.open(`https://wa.me/${cookNumber}?text=${text}`, '_blank');
        } catch (err) {
            handleDownload();
            const text = encodeURIComponent(`Hi ${cookName || 'Chef'}, here is the plan for ${dateRange}. (Please attach the downloaded image)`);
            window.open(`https://wa.me/${cookNumber}?text=${text}`, '_blank');
        }
        setLoading(false);
    };

    return (
        <>
            {/* Hidden Capture Element */}
            <div
                className="fixed -left-[9999px] top-0 pointer-events-none"
                aria-hidden="true"
            >
                <div id="share-capture-container">
                    <ShareableCard type={type} data={displayData} dateRange={dateRange} forCapture={true} language={language} />
                </div>
            </div>

            {/* Visible Modal */}
            <div
                className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm"
                style={{ minHeight: '100dvh' }}
            >
                <div className="bg-white rounded-2xl w-full max-w-lg sm:max-w-2xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[90vh]">

                    {/* Header with Close Button */}
                    <div className="p-3 sm:p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl shrink-0">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                            <Share2 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                            Share {type === 'plan' ? 'Meal Plan' : 'Grocery List'}
                        </h3>

                        {/* Language Toggle + Close Button */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleLanguageToggle}
                                disabled={translating}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${translating
                                        ? 'bg-gray-100 text-gray-400 cursor-wait'
                                        : language === 'hi'
                                            ? 'bg-orange-100 text-orange-700 border border-orange-200'
                                            : !apiKey
                                                ? 'bg-red-50 text-red-500 border border-red-200'
                                                : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                                    }`}
                                title={!apiKey ? 'API key required for Hindi translation' : ''}
                            >
                                {translating ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : !apiKey ? (
                                    <AlertCircle className="w-3.5 h-3.5" />
                                ) : (
                                    <Globe className="w-3.5 h-3.5" />
                                )}
                                {translating ? 'Translating...' : language === 'en' ? 'हिंदी में' : 'हिंदी ✓'}
                            </button>

                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                className="p-1.5 sm:p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                                title="Close"
                            >
                                <X className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Translation Error */}
                    {translationError && (
                        <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2 text-red-600 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{translationError}</span>
                        </div>
                    )}

                    {/* Scrollable Content Area */}
                    <div
                        className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 bg-gray-100 overscroll-contain"
                        style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                        <div className="shadow-2xl rounded-sm overflow-visible mx-auto max-w-[500px]">
                            <ShareableCard type={type} data={displayData} dateRange={dateRange} forCapture={false} language={language} />
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-3 sm:p-6 border-t border-gray-100 bg-white rounded-b-2xl space-y-3 shrink-0 safe-area-inset-bottom">

                        {cookNumber && (
                            <button
                                onClick={handleSendToCook}
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-md mb-2 text-sm sm:text-base min-h-[48px]"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Phone className="w-5 h-5" />}
                                Send to {cookName || "Cook"} (WhatsApp)
                            </button>
                        )}

                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                            <button
                                onClick={handleNativeShare}
                                disabled={loading}
                                className="flex flex-col items-center justify-center p-2.5 sm:p-3 gap-1.5 sm:gap-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-700 transition-colors border border-gray-200 min-h-[60px] sm:min-h-[72px]"
                            >
                                <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="text-[10px] sm:text-xs font-medium">Share</span>
                            </button>

                            <button
                                onClick={handleCopy}
                                disabled={loading}
                                className="flex flex-col items-center justify-center p-2.5 sm:p-3 gap-1.5 sm:gap-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-700 transition-colors border border-gray-200 min-h-[60px] sm:min-h-[72px]"
                            >
                                <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="text-[10px] sm:text-xs font-medium">Copy</span>
                            </button>

                            <button
                                onClick={handleDownload}
                                disabled={loading}
                                className="flex flex-col items-center justify-center p-2.5 sm:p-3 gap-1.5 sm:gap-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-700 transition-colors border border-gray-200 min-h-[60px] sm:min-h-[72px]"
                            >
                                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="text-[10px] sm:text-xs font-medium">Download</span>
                            </button>
                        </div>

                        {!cookNumber && (
                            <p className="text-center text-[10px] sm:text-xs text-gray-400">
                                Tip: Add your Cook's number in Settings for quick sharing!
                            </p>
                        )}

                    </div>
                </div>
            </div>
        </>
    );
};

export default ShareModal;
