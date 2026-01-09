import React, { useState, useEffect } from 'react';
import { X, Key, Save, Phone } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

interface SettingsModalProps {
    onClose: () => void;
    canClose: boolean;
}

export default function SettingsModal({ onClose, canClose }: SettingsModalProps) {
    const { apiKey, setApiKey, cookName, setCookName, cookNumber, setCookNumber } = useSettings();

    const [localKey, setLocalKey] = useState(apiKey);
    const [showKey, setShowKey] = useState(false);
    const [localCookName, setLocalCookName] = useState(cookName);
    const [localCookNumber, setLocalCookNumber] = useState(cookNumber);

    useEffect(() => {
        setLocalKey(apiKey);
        setLocalCookName(cookName);
        setLocalCookNumber(cookNumber);
    }, [apiKey, cookName, cookNumber]);

    const handleSave = () => {
        setApiKey(localKey);
        setCookName(localCookName);
        setCookNumber(localCookNumber);
        if (canClose) onClose();
    };

    // Lock body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4" style={{ minHeight: '100dvh' }}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden max-h-[95vh] sm:max-h-[90vh] flex flex-col">
                <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Key className="w-5 h-5 text-purple-600" />
                        Settings
                    </h3>
                    {canClose && (
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    )}
                </div>

                <div className="p-4 sm:p-6 space-y-6 flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {!canClose && (
                        <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm border border-amber-200">
                            Please configure your Gemini API Key to continue using Cook Commander.
                        </div>
                    )}

                    {/* API Key Section */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <Key className="w-4 h-4" /> Gemini API Key
                        </label>
                        <div className="relative">
                            <input
                                type={showKey ? "text" : "password"}
                                value={localKey}
                                onChange={(e) => setLocalKey(e.target.value)}
                                placeholder="Enter your API Key"
                                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-purple-600 font-medium px-2 py-1"
                            >
                                {showKey ? "HIDE" : "SHOW"}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">
                            Your key syncs across devices when logged in. <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-purple-600 hover:underline">Get a key here</a>.
                        </p>
                    </div>

                    <div className="border-t border-gray-100 my-4"></div>

                    {/* Cook's Contact Section */}
                    <div className="space-y-4">
                        <h4 className="font-medium text-gray-800 flex items-center gap-2">
                            <Phone className="w-4 h-4 text-green-600" />
                            Cook's Contact (for WhatsApp)
                        </h4>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-500 uppercase">Cook's Name</label>
                            <input
                                type="text"
                                value={localCookName}
                                onChange={(e) => setLocalCookName(e.target.value)}
                                placeholder="e.g. Didi"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-500 uppercase">WhatsApp Number</label>
                            <input
                                type="text"
                                value={localCookNumber}
                                onChange={(e) => setLocalCookNumber(e.target.value)}
                                placeholder="e.g. 919876543210 (with country code)"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                            />
                            <p className="text-xs text-gray-400">
                                Enter number with country code (no +). Example: 919988776655
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 safe-area-inset-bottom shrink-0">
                    <button
                        onClick={handleSave}
                        disabled={!localKey}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm min-h-[44px]"
                    >
                        <Save className="w-4 h-4" />
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );
}
