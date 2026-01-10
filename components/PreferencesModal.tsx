import React, { useState, useEffect } from 'react';
import { UserPreferences, PreferenceProfile, MealHistoryEntry } from '../types';
import { parsePreferencesFromText, optimizePreferencesFromHistory, getLearningSuggestions, LearningSuggestions } from '../services/geminiService';
import { useSettings } from '../contexts/SettingsContext';
import { X, Wand2, Save, History, Plus, User, Coffee, Sun, Moon, AlertCircle, Check, ThumbsUp, ThumbsDown, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

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
                    </div>
                    {/* Close Button */}
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

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
                                    <div className="space-y-6 animate-in fade-in duration-200">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Dietary Type</label>
                                            <input
                                                type="text"
                                                value={localPrefs.dietaryType}
                                                onChange={(e) => handleChange('dietaryType', e.target.value)}
                                                className="w-full p-3 bg-gray-50 border-gray-200 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-black font-medium"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Dislikes / Restrictions</label>
                                            <textarea
                                                value={localPrefs.dislikes.join(', ')}
                                                onChange={(e) => handleChange('dislikes', e.target.value)}
                                                className="w-full p-3 bg-gray-50 border-gray-200 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-black font-medium"
                                                rows={3}
                                                placeholder="Comma separated values e.g., Mushrooms, Brinjal"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Special Instructions for Cook</label>
                                            <textarea
                                                value={localPrefs.specialInstructions}
                                                onChange={(e) => handleChange('specialInstructions', e.target.value)}
                                                className="w-full p-3 bg-gray-50 border-gray-200 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-black font-medium"
                                                rows={4}
                                            />
                                        </div>
                                    </div>
                                )}

                                {(activeTab === 'breakfast' || activeTab === 'lunch' || activeTab === 'dinner') && (
                                    <div className="space-y-4 animate-in fade-in duration-200">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-sm font-bold text-gray-700 capitalize">{activeTab} Preferences</label>
                                            <span className="text-xs text-gray-400">One option per line or comma separated</span>
                                        </div>
                                        <textarea
                                            value={localPrefs[`${activeTab}Preferences`].join(', ')}
                                            onChange={(e) => handleChange(`${activeTab}Preferences` as any, e.target.value)}
                                            className="w-full p-4 bg-gray-50 border-gray-200 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 leading-relaxed font-medium"
                                            rows={12}
                                            placeholder={`Enter your preferred ${activeTab} options here...`}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-3 sm:p-6 border-t flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 shrink-0 bg-white z-20">
                            <button onClick={onClose} className="px-4 sm:px-6 py-2 sm:py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors order-2 sm:order-1">Cancel</button>
                            <button
                                onClick={handleSave}
                                className="px-6 sm:px-8 py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all order-1 sm:order-2"
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