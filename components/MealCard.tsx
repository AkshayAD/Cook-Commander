import React from 'react';
import { DayPlan } from '../types';
import { RefreshCw, Sun, CloudSun, Moon, MessageSquarePlus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Props {
  dayPlan: DayPlan;
  dayIndex: number;
  onRegenerate: (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => void;
  onSmartEdit: (dayPlan: DayPlan, dayIndex: number) => void;
  isLoading: boolean;
}

const MealCard: React.FC<Props> = ({ dayPlan, dayIndex, onRegenerate, onSmartEdit, isLoading }) => {
  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden hover:shadow-lg transition-all relative group/card">
      <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
        <h3 className="font-bold text-gray-800">{dayPlan.day}</h3>
        <button
            onClick={() => onSmartEdit(dayPlan, dayIndex)}
            className="text-xs flex items-center gap-1 text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-indigo-100"
        >
            <MessageSquarePlus className="w-3 h-3" /> Edit with AI
        </button>
      </div>
      
      <div className="p-4 space-y-4">
        {/* Breakfast */}
        <div className="group">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 mb-1">
              <Sun className="w-3 h-3" /> BREAKFAST
            </div>
            <button 
              onClick={() => onRegenerate(dayIndex, 'breakfast')}
              disabled={isLoading}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-blue-600"
              title="Quick Regenerate"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="text-gray-700 text-sm leading-snug markdown-body">
            <ReactMarkdown>{dayPlan.breakfast}</ReactMarkdown>
          </div>
        </div>

        {/* Lunch */}
        <div className="group pt-2 border-t border-dashed border-gray-200">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 mb-1">
              <CloudSun className="w-3 h-3" /> LUNCH
            </div>
             <button 
              onClick={() => onRegenerate(dayIndex, 'lunch')}
              disabled={isLoading}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-blue-600"
              title="Quick Regenerate"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="text-gray-700 text-sm leading-snug markdown-body">
            <ReactMarkdown>{dayPlan.lunch}</ReactMarkdown>
          </div>
        </div>

        {/* Dinner */}
        <div className="group pt-2 border-t border-dashed border-gray-200">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 mb-1">
              <Moon className="w-3 h-3" /> DINNER
            </div>
             <button 
              onClick={() => onRegenerate(dayIndex, 'dinner')}
              disabled={isLoading}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-blue-600"
              title="Quick Regenerate"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="text-gray-700 text-sm leading-snug markdown-body">
            <ReactMarkdown>{dayPlan.dinner}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MealCard;