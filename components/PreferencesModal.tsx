import React, { useState, useEffect } from 'react';
import { UserPreferences, PreferenceProfile, MealHistoryEntry } from '../types';
import { parsePreferencesFromText, optimizePreferencesFromHistory, getLearningSuggestions, LearningSuggestions } from '../services/geminiService';
import { useSettings } from '../contexts/SettingsContext';
import { X, Wand2, Save, History, Plus, User, Coffee, Sun, Moon, AlertCircle, Check, ThumbsUp, ThumbsDown, Trash2, ChevronDown, ChevronUp, Sparkles, Globe } from 'lucide-react';
import { QUICK_COOK_INSTRUCTION_OPTIONS } from '../constants';

interface Props {
    profiles: PreferenceProfile[];
    currentProfileId: string;
    history: MealHistoryEntry[];
    onSaveProfile: (profile: PreferenceProfile) => void;
    onSwitchProfile: (id: string) => void;
    onDeleteProfile?: (id: string) => void;
    onClose: () => void;
}

const PreferencesModal: React.FC<Props> = ({ profiles, currentProfileId, history, onSaveProfile, onSwitchProfile, onDeleteProfile, onClose }) => {
    const { apiKey, modelName } = useSettings();
    const aiConfig = { apiKey, modelName };

    const currentProfile = profiles.find(p => p.id === currentProfileId) || profiles[0];

    const [localPrefs, setLocalPrefs] = useState<UserPreferences>(currentProfile);
    const [profileName, setProfileName] = useState(currentProfile.name);
    const [rawText, setRawText] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'breakfast' | 'lunch' | 'dinner'>('general');
    const [learningSuggestions, setLearningSuggestions] = useState<LearningSuggestions | null>(null);
    const [showLearningModal, setShowLearningModal] = useState(false);
    const [mobileProfilesExpanded, setMobileProfilesExpanded] = useState(false);
    const [showAiImportPopup, setShowAiImportPopup] = useState(false);
    const [newMealItem, setNewMealItem] = useState('');

    // Lock body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    // Delete profile handler
    const handleDeleteProfile = (id: string) => {
        if (!onDeleteProfile) return;
        const profile = profiles.find(p => p.id === id);
        if (window.confirm(`Delete "${profile?.name}"? This cannot be undone.`)) {
            onDeleteProfile(id);
        }
    };

    // When switching profiles via internal dropdown
    const handleProfileSelect = (id: string) => {
        onSwitchProfile(id);
        const newProfile = profiles.find(p => p.id === id);
        if (newProfile) {
            setLocalPrefs(newProfile);
            setProfileName(newProfile.name);
        }
        setMobileProfilesExpanded(false); // Close mobile dropdown
    };

    const handleCreateNew = () => {
        // Generate proper UUID for Supabase compatibility
        const newId = crypto.randomUUID();
        // Keep General settings (dietaryType, allergies, dislikes, specialInstructions, pantryStaples)
        // BUT clear specific meal preferences so they can be fresh
        const newProfile: PreferenceProfile = {
            ...localPrefs,
            id: newId,
            name: "New Profile",
            breakfastPreferences: [],
            lunchPreferences: [],
            dinnerPreferences: []
        };

        onSaveProfile(newProfile);
        onSwitchProfile(newId);
        setProfileName("New Profile");
        setLocalPrefs(newProfile);
    };

    const handleAnalyze = async () => {
        if (!rawText.trim()) return;
        setIsAnalyzing(true);
        try {
            const newPrefs = await parsePreferencesFromText(rawText, aiConfig);

            setLocalPrefs(prev => {
                const updated = { ...prev };

                // Helper to append unique items to array
                const appendUnique = (current: string[], incoming: string[]) => {
                    return Array.from(new Set([...current, ...incoming]));
                };

                // Helper to append text with deduplication logic (simple includes check)
                const appendText = (current: string, incoming: string, separator: string = '\n') => {
                    if (!incoming || incoming === 'null' || incoming.trim() === '') return current;
                    if (!current) return incoming;
                    if (current.toLowerCase().includes(incoming.toLowerCase())) return current;
                    return `${current}${separator}${incoming}`;
                };

                // Merge Dietary Type
                if (newPrefs.dietaryType && newPrefs.dietaryType !== 'null') {
                    updated.dietaryType = appendText(prev.dietaryType, newPrefs.dietaryType, ', ');
                }

                // Merge Lists
                if (newPrefs.dislikes?.length) updated.dislikes = appendUnique(prev.dislikes, newPrefs.dislikes);
                if (newPrefs.allergies?.length) updated.allergies = appendUnique(prev.allergies, newPrefs.allergies);
                if (newPrefs.pantryStaples?.length) updated.pantryStaples = appendUnique(prev.pantryStaples, newPrefs.pantryStaples);

                // Merge Special Instructions (Crucial requirement: Append, don't replace)
                if (newPrefs.specialInstructions) {
                    updated.specialInstructions = appendText(prev.specialInstructions, newPrefs.specialInstructions, '\n\n');
                }

                // Merge Meal Preferences
                if (newPrefs.breakfastPreferences?.length) updated.breakfastPreferences = appendUnique(prev.breakfastPreferences, newPrefs.breakfastPreferences);
                if (newPrefs.lunchPreferences?.length) updated.lunchPreferences = appendUnique(prev.lunchPreferences, newPrefs.lunchPreferences);
                if (newPrefs.dinnerPreferences?.length) updated.dinnerPreferences = appendUnique(prev.dinnerPreferences, newPrefs.dinnerPreferences);

                return updated;
            });

            // Move to the relevant tab if specific meals were imported, else general
            if (newPrefs.breakfastPreferences?.length > 0) setActiveTab('breakfast');
            else if (newPrefs.lunchPreferences?.length > 0) setActiveTab('lunch');
            else if (newPrefs.dinnerPreferences?.length > 0) setActiveTab('dinner');
            else setActiveTab('general');

            setRawText(''); // Clear input after successful extract

        } catch (e: any) {
            const errorMessage = e?.message || 'Unknown error';
            if (errorMessage.includes('API Key') || errorMessage.includes('API key')) {
                alert(`API Key Error: ${errorMessage}`);
            } else {
                alert(`Failed to analyze text: ${errorMessage}`);
            }
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleOptimizeFromHistory = async () => {
        if (history.length === 0) {
            alert("No meal history available to learn from yet.");
            return;
        }
        setIsOptimizing(true);
        try {
            const suggestions = await getLearningSuggestions(localPrefs, history, aiConfig);
            setLearningSuggestions(suggestions);
            setShowLearningModal(true);
        } catch (e) {
            alert("Failed to analyze history.");
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleApplyLearning = async () => {
        if (!learningSuggestions) return;
        setIsOptimizing(true);
        try {
            const optimized = await optimizePreferencesFromHistory(localPrefs, history, aiConfig);
            setLocalPrefs(optimized);
            setShowLearningModal(false);
            setLearningSuggestions(null);
        } catch (e) {
            alert("Failed to apply learning.");
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleChange = (field: keyof UserPreferences, value: string) => {
        if (Array.isArray(localPrefs[field])) {
            setLocalPrefs({ ...localPrefs, [field]: value.split(',').map(s => s.trim()) });
        } else {
            setLocalPrefs({ ...localPrefs, [field]: value });
        }
    };

    const handleSave = () => {
        onSaveProfile({
            ...localPrefs,
            id: currentProfileId,
            name: profileName
        });
        onClose();
    }

    const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === id ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'
                }`}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );

    return (
        <div className="fixed inset-0 bg-black/50 md:bg-black/50 flex md:items-center md:justify-center z-50" style={{ minHeight: '100dvh' }}>
            <div className="bg-white w-full h-full md:rounded-2xl md:shadow-xl md:max-w-5xl md:h-[85vh] md:m-4 overflow-hidden flex flex-col">

                {/* Mobile Header with Profile Selector - Two Sections */}
                <div className="md:hidden shrink-0 bg-white border-b border-gray-200 p-3 flex items-center justify-between gap-3">
                    {/* Profile Dropdown */}
                    <div className="flex-1 flex items-center gap-2">
                        <User className="w-4 h-4 text-indigo-600 shrink-0" />
                        <select
                            value={currentProfileId}
                            onChange={(e) => handleProfileSelect(e.target.value)}
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            {profiles.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={handleCreateNew}
                            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                            title="New Profile"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                        {/* AI Import Icon */}
                        <button
                            onClick={() => setShowAiImportPopup(!showAiImportPopup)}
                            className="p-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-lg hover:opacity-90"
                            title="AI Import"
                        >
                            <Sparkles className="w-4 h-4" />
                        </button>
                    </div>
                    {/* Save/Cancel Icons on Mobile */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleSave}
                            className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                            title="Save Profile"
                        >
                            <Check className="w-5 h-5" />
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" title="Cancel">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Mobile AI Import Popup */}
                {showAiImportPopup && (
                    <div className="md:hidden shrink-0 border-b border-gray-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 p-3">
                        <div className="flex items-center gap-2 text-violet-800 mb-2">
                            <Sparkles className="w-4 h-4" />
                            <span className="text-sm font-bold">AI Quick Import</span>
                            <button onClick={() => setShowAiImportPopup(false)} className="ml-auto p-1 hover:bg-violet-100 rounded">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <textarea
                            className="w-full px-3 py-2 bg-white border border-violet-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none text-gray-900 resize-none"
                            placeholder="Paste meal ideas, dietary needs..."
                            rows={2}
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                        />
                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={handleAnalyze}
                                disabled={isAnalyzing || !rawText}
                                className="flex-1 px-3 py-2 bg-violet-600 text-white text-xs rounded-lg font-bold hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-1"
                            >
                                {isAnalyzing ? 'Extracting...' : <><Wand2 className="w-3 h-3" /> Append to List</>}
                            </button>
                        </div>
                    </div>
                )}

                {/* Desktop + Mobile Content Wrapper */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

                    {/* Desktop Sidebar - Hidden on Mobile */}
                    <div className="hidden md:flex w-64 bg-gray-50 border-r border-gray-200 p-4 flex-shrink-0 overflow-y-auto flex-col">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Saved Profiles</h3>
                        <div className="space-y-1 flex-1">
                            {profiles.map(p => (
                                <div key={p.id} className={`flex items-center rounded-lg transition-colors ${currentProfileId === p.id ? 'bg-white shadow-sm border border-gray-200' : 'hover:bg-gray-100'}`}>
                                    <button
                                        onClick={() => handleProfileSelect(p.id)}
                                        className="flex-1 text-left px-3 py-2 flex items-center gap-2"
                                    >
                                        <User className="w-4 h-4 opacity-70" />
                                        <span className={`truncate text-sm font-medium ${currentProfileId === p.id ? 'text-indigo-600' : 'text-gray-600'}`}>{p.name}</span>
                                    </button>
                                    {profiles.length > 1 && onDeleteProfile && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteProfile(p.id); }}
                                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            style={{ opacity: 1 }}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleCreateNew}
                            className="mt-4 w-full py-3 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                        >
                            <Plus className="w-4 h-4" /> New Profile
                        </button>

                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Smart Learning</h3>
                            <p className="text-[10px] text-gray-500 mb-3 leading-tight">Refine this profile based on meals you've accepted in the past.</p>
                            <button
                                onClick={handleOptimizeFromHistory}
                                disabled={isOptimizing || history.length === 0}
                                className="w-full py-2 bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white rounded-lg text-xs font-bold hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                            >
                                {isOptimizing ? <Wand2 className="w-3 h-3 animate-spin" /> : <History className="w-3 h-3" />}
                                Learn from History
                            </button>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                        {/* Header - Hidden on mobile (already in profile bar) */}
                        <div className="hidden md:flex bg-white p-6 border-b justify-between items-center z-10 shrink-0">
                            <div className="flex-1 mr-8">
                                <input
                                    type="text"
                                    value={profileName}
                                    onChange={(e) => setProfileName(e.target.value)}
                                    className="text-2xl font-bold text-gray-900 border-none focus:ring-0 p-0 w-full placeholder-gray-300 focus:outline-none"
                                    placeholder="Profile Name"
                                />
                                <p className="text-sm text-gray-400">Manage detailed dietary preferences for the AI.</p>
                            </div>
                            <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                                <X className="w-6 h-6 text-gray-500" />
                            </button>
                        </div>

                        {/* AI Import Box - Hidden on mobile for compact layout */}
                        <div className="hidden md:block px-6 pt-6 shrink-0">
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col gap-3">
                                <div className="flex items-center gap-2 text-blue-900">
                                    <Wand2 className="w-5 h-5" />
                                    <h3 className="text-sm font-bold">Quick Import / Fill</h3>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-start">
                                    <textarea
                                        className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 resize-none min-h-[80px]"
                                        placeholder="Paste specific meal ideas, dietary needs, or notes here..."
                                        rows={3}
                                        value={rawText}
                                        onChange={(e) => setRawText(e.target.value)}
                                    />
                                    <button
                                        onClick={handleAnalyze}
                                        disabled={isAnalyzing || !rawText}
                                        className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-blue-600 text-white text-sm rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap flex items-center justify-center min-h-[44px] sm:min-h-[86px]"
                                    >
                                        {isAnalyzing ? 'Extracting...' : 'Extract'}
                                    </button>
                                </div>
                                <p className="text-xs text-blue-600/80">
                                    Extracted preferences will be appended to your current settings. Existing general instructions are preserved.
                                </p>
                            </div>
                        </div>

                        {/* Tab Navigation */}
                        <div className="px-3 pt-3 sm:px-6 sm:pt-6 flex gap-2 overflow-x-auto shrink-0 border-b border-gray-100 pb-1">
                            <TabButton id="general" label="General" icon={AlertCircle} />
                            <TabButton id="breakfast" label="Breakfast" icon={Coffee} />
                            <TabButton id="lunch" label="Lunch" icon={Sun} />
                            <TabButton id="dinner" label="Dinner" icon={Moon} />
                        </div>

                        {/* Tab Content */}
                        <div className="p-3 sm:p-6 overflow-y-auto flex-1 bg-white overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                            <div className="max-w-3xl">
                                {activeTab === 'general' && (
                                    <div className="space-y-5 animate-in fade-in duration-200">
                                        {/* Language Toggle */}
                                        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
                                            <div className="flex items-center gap-2">
                                                <Globe className="w-4 h-4 text-blue-600" />
                                                <span className="text-sm font-bold text-blue-800">Menu & Grocery Language</span>
                                            </div>
                                            <div className="flex gap-1">
                                                {(['English', 'Hindi'] as const).map((lang) => (
                                                    <button
                                                        key={lang}
                                                        type="button"
                                                        onClick={() => setLocalPrefs(prev => ({ ...prev, language: lang }))}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${(localPrefs.language ?? 'English') === lang
                                                                ? 'bg-blue-600 text-white'
                                                                : 'bg-white text-blue-700 hover:bg-blue-100'
                                                            }`}
                                                    >
                                                        {lang === 'Hindi' ? 'हिंदी' : lang}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Meals to Prepare */}
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Meals to Prepare</label>
                                            <div className="flex flex-wrap gap-2">
                                                {(['breakfast', 'lunch', 'dinner'] as const).map((meal) => (
                                                    <label key={meal} className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={localPrefs.mealsToPrepare?.includes(meal) ?? true}
                                                            onChange={(e) => {
                                                                const current = localPrefs.mealsToPrepare ?? ['breakfast', 'lunch', 'dinner'];
                                                                if (e.target.checked) {
                                                                    setLocalPrefs(prev => ({ ...prev, mealsToPrepare: [...current, meal] }));
                                                                } else {
                                                                    setLocalPrefs(prev => ({ ...prev, mealsToPrepare: current.filter(m => m !== meal) }));
                                                                }
                                                            }}
                                                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                                        />
                                                        <span className="text-sm font-medium capitalize text-gray-700">{meal}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Food Preference - Multi-select */}
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Food Preference (Multi-select)</label>
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {[
                                                    { value: 'Vegetarian', label: 'Veg' },
                                                    { value: 'Vegetarian (with Eggs)', label: 'Veg + Eggs' },
                                                    { value: 'Non-Vegetarian', label: 'Non-Veg' }
                                                ].map((opt) => {
                                                    const selected = localPrefs.dietaryTypes?.includes(opt.value) ?? (opt.value === 'Vegetarian');
                                                    return (
                                                        <button
                                                            key={opt.value}
                                                            type="button"
                                                            onClick={() => {
                                                                const current = localPrefs.dietaryTypes ?? ['Vegetarian'];
                                                                if (selected) {
                                                                    if (current.length > 1) {
                                                                        setLocalPrefs(prev => ({ ...prev, dietaryTypes: current.filter(v => v !== opt.value), dietaryType: current.filter(v => v !== opt.value)[0] || 'Vegetarian' }));
                                                                    }
                                                                } else {
                                                                    setLocalPrefs(prev => ({ ...prev, dietaryTypes: [...current, opt.value], dietaryType: opt.value }));
                                                                }
                                                            }}
                                                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${selected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                                }`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <input
                                                type="text"
                                                value={localPrefs.dietaryDetails ?? ''}
                                                onChange={(e) => setLocalPrefs(prev => ({ ...prev, dietaryDetails: e.target.value }))}
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                placeholder="More details (e.g., Jain, No onion/garlic)..."
                                            />
                                        </div>

                                        {/* Non-Veg Preferences (conditional) */}
                                        {(localPrefs.dietaryTypes?.includes('Non-Vegetarian') || localPrefs.dietaryType === 'Non-Vegetarian') && (
                                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                                <label className="block text-sm font-bold text-amber-800 mb-2">Non-Veg Options</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {['Chicken', 'Mutton', 'Fish', 'Prawns', 'Crabs', 'Eggs'].map((item) => (
                                                        <label key={item} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-amber-200 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors">
                                                            <input
                                                                type="checkbox"
                                                                checked={localPrefs.nonVegPreferences?.includes(item) ?? false}
                                                                onChange={(e) => {
                                                                    const current = localPrefs.nonVegPreferences ?? [];
                                                                    if (e.target.checked) {
                                                                        setLocalPrefs(prev => ({ ...prev, nonVegPreferences: [...current, item] }));
                                                                    } else {
                                                                        setLocalPrefs(prev => ({ ...prev, nonVegPreferences: current.filter(i => i !== item) }));
                                                                    }
                                                                }}
                                                                className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                                                            />
                                                            <span className="text-sm font-medium text-amber-900">{item}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Dislikes - Editable Checkbox List */}
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Dislikes / Restrictions ({localPrefs.dislikes.length})</label>
                                            <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-200 rounded-xl p-2 bg-gray-50 mb-2">
                                                {localPrefs.dislikes.map((item, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-gray-100 group">
                                                        <input type="checkbox" checked={true} onChange={() => {
                                                            setLocalPrefs(prev => ({ ...prev, dislikes: prev.dislikes.filter((_, i) => i !== idx) }));
                                                        }} className="w-4 h-4 text-red-600 rounded focus:ring-red-500" />
                                                        <span className="flex-1 text-sm text-gray-800">{item}</span>
                                                        <button onClick={() => setLocalPrefs(prev => ({ ...prev, dislikes: prev.dislikes.filter((_, i) => i !== idx) }))} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                                    </div>
                                                ))}
                                                {localPrefs.dislikes.length === 0 && <p className="text-center text-gray-400 text-xs py-2">No dislikes added</p>}
                                            </div>
                                            <div className="flex gap-2">
                                                <input type="text" id="newDislike" className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Add dislike..." onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                                                        setLocalPrefs(prev => ({ ...prev, dislikes: [...prev.dislikes, (e.target as HTMLInputElement).value.trim()] }));
                                                        (e.target as HTMLInputElement).value = '';
                                                    }
                                                }} />
                                                <button onClick={() => {
                                                    const input = document.getElementById('newDislike') as HTMLInputElement;
                                                    if (input.value.trim()) {
                                                        setLocalPrefs(prev => ({ ...prev, dislikes: [...prev.dislikes, input.value.trim()] }));
                                                        input.value = '';
                                                    }
                                                }} className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><Plus className="w-4 h-4" /></button>
                                            </div>
                                        </div>

                                        {/* Quick Cook Instructions (Toggles - Unticked by default) */}
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Quick Cook Guidelines</label>
                                            <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-2 bg-gray-50">
                                                {QUICK_COOK_INSTRUCTION_OPTIONS.map((instruction) => (
                                                    <label key={instruction} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-50">
                                                        <input
                                                            type="checkbox"
                                                            checked={localPrefs.quickCookInstructions?.includes(instruction) ?? false}
                                                            onChange={(e) => {
                                                                const current = localPrefs.quickCookInstructions ?? [];
                                                                if (e.target.checked) {
                                                                    setLocalPrefs(prev => ({ ...prev, quickCookInstructions: [...current, instruction] }));
                                                                } else {
                                                                    setLocalPrefs(prev => ({ ...prev, quickCookInstructions: current.filter(i => i !== instruction) }));
                                                                }
                                                            }}
                                                            className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                                                        />
                                                        <span className="text-sm text-gray-700">{instruction}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Special Instructions - Editable Checkbox List */}
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Custom Instructions for Cook</label>
                                            <div className="space-y-1 max-h-28 overflow-y-auto border border-gray-200 rounded-xl p-2 bg-gray-50 mb-2">
                                                {localPrefs.specialInstructions.split('\n').filter(Boolean).map((item, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-gray-100 group">
                                                        <input type="checkbox" checked={true} onChange={() => {
                                                            const lines = localPrefs.specialInstructions.split('\n').filter(Boolean);
                                                            lines.splice(idx, 1);
                                                            setLocalPrefs(prev => ({ ...prev, specialInstructions: lines.join('\n') }));
                                                        }} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                                                        <span className="flex-1 text-sm text-gray-800">{item}</span>
                                                        <button onClick={() => {
                                                            const lines = localPrefs.specialInstructions.split('\n').filter(Boolean);
                                                            lines.splice(idx, 1);
                                                            setLocalPrefs(prev => ({ ...prev, specialInstructions: lines.join('\n') }));
                                                        }} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                                    </div>
                                                ))}
                                                {!localPrefs.specialInstructions.trim() && <p className="text-center text-gray-400 text-xs py-2">No custom instructions</p>}
                                            </div>
                                            <div className="flex gap-2">
                                                <input type="text" id="newInstruction" className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Add custom instruction..." onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                                                        const newLine = (e.target as HTMLInputElement).value.trim();
                                                        setLocalPrefs(prev => ({ ...prev, specialInstructions: prev.specialInstructions ? prev.specialInstructions + '\n' + newLine : newLine }));
                                                        (e.target as HTMLInputElement).value = '';
                                                    }
                                                }} />
                                                <button onClick={() => {
                                                    const input = document.getElementById('newInstruction') as HTMLInputElement;
                                                    if (input.value.trim()) {
                                                        const newLine = input.value.trim();
                                                        setLocalPrefs(prev => ({ ...prev, specialInstructions: prev.specialInstructions ? prev.specialInstructions + '\n' + newLine : newLine }));
                                                        input.value = '';
                                                    }
                                                }} className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><Plus className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {(activeTab === 'breakfast' || activeTab === 'lunch' || activeTab === 'dinner') && (
                                    <div className="space-y-3 animate-in fade-in duration-200">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-sm font-bold text-gray-700 capitalize">{activeTab} Preferences</label>
                                            <span className="text-xs text-gray-400">{localPrefs[`${activeTab}Preferences`].length} items</span>
                                        </div>

                                        {/* Checkbox List */}
                                        <div className="space-y-1 max-h-[45vh] overflow-y-auto border border-gray-200 rounded-xl p-2 bg-gray-50">
                                            {localPrefs[`${activeTab}Preferences`].map((item, idx) => (
                                                <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-100 hover:border-indigo-200 group">
                                                    <input
                                                        type="checkbox"
                                                        checked={true}
                                                        onChange={() => {
                                                            const key = `${activeTab}Preferences` as keyof UserPreferences;
                                                            const current = [...(localPrefs[key] as string[])];
                                                            current.splice(idx, 1);
                                                            setLocalPrefs(prev => ({ ...prev, [key]: current }));
                                                        }}
                                                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                                    />
                                                    <span className="flex-1 text-sm text-gray-800">{item}</span>
                                                    <button
                                                        onClick={() => {
                                                            const key = `${activeTab}Preferences` as keyof UserPreferences;
                                                            const current = [...(localPrefs[key] as string[])];
                                                            current.splice(idx, 1);
                                                            setLocalPrefs(prev => ({ ...prev, [key]: current }));
                                                        }}
                                                        className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity sm:opacity-100"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            {localPrefs[`${activeTab}Preferences`].length === 0 && (
                                                <p className="text-center text-gray-400 text-sm py-4">No {activeTab} preferences yet. Add some below!</p>
                                            )}
                                        </div>

                                        {/* Add New Item */}
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={newMealItem}
                                                onChange={(e) => setNewMealItem(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && newMealItem.trim()) {
                                                        const key = `${activeTab}Preferences` as keyof UserPreferences;
                                                        setLocalPrefs(prev => ({
                                                            ...prev,
                                                            [key]: [...(prev[key] as string[]), newMealItem.trim()]
                                                        }));
                                                        setNewMealItem('');
                                                    }
                                                }}
                                                className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                placeholder={`Add new ${activeTab} item...`}
                                            />
                                            <button
                                                onClick={() => {
                                                    if (newMealItem.trim()) {
                                                        const key = `${activeTab}Preferences` as keyof UserPreferences;
                                                        setLocalPrefs(prev => ({
                                                            ...prev,
                                                            [key]: [...(prev[key] as string[]), newMealItem.trim()]
                                                        }));
                                                        setNewMealItem('');
                                                    }
                                                }}
                                                disabled={!newMealItem.trim()}
                                                className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer - Hidden on mobile (icons in header) */}
                        <div className="hidden sm:flex p-6 border-t justify-end gap-3 shrink-0 bg-white z-20">
                            <button onClick={onClose} className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                            <button
                                onClick={handleSave}
                                className="px-8 py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
                            >
                                <Save className="w-4 h-4" /> Save Profile
                            </button>
                        </div>
                    </div>
                </div>

                {/* Learning Insights Modal */}
                {showLearningModal && learningSuggestions && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-2 sm:p-4" style={{ minHeight: '100dvh' }}>
                        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[95vh] sm:max-h-[90vh] flex flex-col">
                            <div className="p-5 border-b bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white">
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    <History className="w-5 h-5" />
                                    What I Learned from Your History
                                </h3>
                                <p className="text-sm text-white/80 mt-1">
                                    Analyzed {learningSuggestions.totalMealsAnalyzed} rated meals
                                </p>
                            </div>

                            <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
                                <div className="bg-violet-50 p-4 rounded-xl border border-violet-100">
                                    <p className="text-gray-800 font-medium">{learningSuggestions.summary}</p>
                                </div>

                                {learningSuggestions.likedPatterns.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-2">
                                            <ThumbsUp className="w-4 h-4 text-green-600" /> Patterns You Like
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {learningSuggestions.likedPatterns.map((p, i) => (
                                                <span key={i} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">{p}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {learningSuggestions.dislikedPatterns.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-2">
                                            <ThumbsDown className="w-4 h-4 text-red-500" /> Patterns to Avoid
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {learningSuggestions.dislikedPatterns.map((p, i) => (
                                                <span key={i} className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">{p}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <h4 className="text-sm font-bold text-gray-700 mb-2">Suggested Changes</h4>
                                    <div className="space-y-2 text-sm">
                                        {learningSuggestions.suggestedAdditions.breakfastPreferences.length > 0 && (
                                            <div className="flex items-start gap-2">
                                                <Coffee className="w-4 h-4 text-amber-600 mt-0.5" />
                                                <span className="text-gray-600"><strong>Breakfast:</strong> {learningSuggestions.suggestedAdditions.breakfastPreferences.join(', ')}</span>
                                            </div>
                                        )}
                                        {learningSuggestions.suggestedAdditions.lunchPreferences.length > 0 && (
                                            <div className="flex items-start gap-2">
                                                <Sun className="w-4 h-4 text-orange-600 mt-0.5" />
                                                <span className="text-gray-600"><strong>Lunch:</strong> {learningSuggestions.suggestedAdditions.lunchPreferences.join(', ')}</span>
                                            </div>
                                        )}
                                        {learningSuggestions.suggestedAdditions.dinnerPreferences.length > 0 && (
                                            <div className="flex items-start gap-2">
                                                <Moon className="w-4 h-4 text-indigo-600 mt-0.5" />
                                                <span className="text-gray-600"><strong>Dinner:</strong> {learningSuggestions.suggestedAdditions.dinnerPreferences.join(', ')}</span>
                                            </div>
                                        )}
                                        {learningSuggestions.suggestedAdditions.dislikes.length > 0 && (
                                            <div className="flex items-start gap-2">
                                                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                                                <span className="text-gray-600"><strong>Add to Dislikes:</strong> {learningSuggestions.suggestedAdditions.dislikes.join(', ')}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 border-t bg-gray-50 flex justify-end gap-3">
                                <button onClick={() => { setShowLearningModal(false); setLearningSuggestions(null); }} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                                <button onClick={handleApplyLearning} disabled={isOptimizing} className="px-6 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white rounded-lg font-bold hover:shadow-lg disabled:opacity-50 flex items-center gap-2 transition-all">
                                    {isOptimizing ? <Wand2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    Apply to Profile
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PreferencesModal;