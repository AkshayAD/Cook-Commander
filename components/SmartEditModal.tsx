import React, { useState } from 'react';
import { DayPlan, UserPreferences } from '../types';
import { MessageSquare, X, Sparkles, Send, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Props {
  dayPlan: DayPlan;
  preferences: UserPreferences;
  onConfirm: (updates: Record<string, string>) => void;
  onClose: () => void;
  onAnalyze: (mealTypes: string[], instruction: string) => Promise<Record<string, string>>;
}

const SmartEditModal: React.FC<Props> = ({ dayPlan, onConfirm, onClose, onAnalyze }) => {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['Lunch']);
  const [instruction, setInstruction] = useState('');
  const [generatedOptions, setGeneratedOptions] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleType = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
    setGeneratedOptions(null);
  };

  const handleAnalyze = async () => {
    if (!instruction.trim() || selectedTypes.length === 0) return;
    setLoading(true);
    setGeneratedOptions(null);
    try {
      const result = await onAnalyze(selectedTypes, instruction);
      setGeneratedOptions(result);
    } catch (e) {
      console.error(e);
      // Fallback manual error or handle gracefully
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (generatedOptions) {
      onConfirm(generatedOptions);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <h2 className="text-xl font-bold">Smart Edit: {dayPlan.day}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {/* Meal Selector Pills */}
          <div className="mb-6">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">Select Meals to Edit</label>
            <div className="flex gap-2">
              {(['Breakfast', 'Lunch', 'Dinner'] as const).map((type) => {
                const isSelected = selectedTypes.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`flex-1 py-2 px-3 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md transform scale-105'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current Meal Display (Only selected) */}
          <div className="mb-6 space-y-2">
            {selectedTypes.map(type => (
              <div key={type} className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex justify-between items-center">
                 <div>
                    <span className="text-xs font-semibold text-gray-400 uppercase block">{type}</span>
                    <span className="text-gray-800 text-sm font-medium">{dayPlan[type.toLowerCase()]}</span>
                 </div>
              </div>
            ))}
             {selectedTypes.length === 0 && <p className="text-sm text-gray-400 italic">Select a meal type above to start.</p>}
          </div>

          {/* Chat Interface */}
          <div className="space-y-4">
             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Instructions for AI</label>
             <div className="relative">
                <textarea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder={`e.g., "Make it vegan", "Too heavy, change to soup", "No rice today"`}
                    className="w-full p-4 pr-12 bg-white border-2 border-indigo-100 rounded-xl focus:border-indigo-500 focus:ring-0 outline-none resize-none text-gray-700 placeholder-gray-400"
                    rows={3}
                />
                <button 
                    onClick={handleAnalyze}
                    disabled={loading || !instruction.trim() || selectedTypes.length === 0}
                    className="absolute bottom-3 right-3 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {loading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
             </div>
          </div>

          {/* AI Response Area */}
          {generatedOptions && (
            <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-3">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-indigo-600 uppercase flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> AI Suggestions
                    </span>
                </div>
                
                {Object.entries(generatedOptions).map(([key, value]) => (
                    value && (
                        <div key={key} className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                            <span className="text-xs font-bold text-indigo-400 uppercase mb-1 block">{key}</span>
                            <div className="markdown-body text-gray-800 text-sm font-medium">
                                <ReactMarkdown>{value}</ReactMarkdown>
                            </div>
                        </div>
                    )
                ))}

                <button
                    onClick={handleAccept}
                    className="w-full mt-4 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl"
                >
                    Update Plan
                </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartEditModal;