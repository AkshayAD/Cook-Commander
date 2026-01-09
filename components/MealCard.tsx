import React, { useState } from 'react';
import { DayPlan } from '../types';
import { RefreshCw, Sun, CloudSun, Moon, MessageSquarePlus, Pencil, Check, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Props {
  dayPlan: DayPlan;
  dayIndex: number;
  onRegenerate: (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => void;
  onSmartEdit: (dayPlan: DayPlan, dayIndex: number) => void;
  onMealUpdate?: (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner', newValue: string) => void;
  isLoading: boolean;
}

const MealCard: React.FC<Props> = ({ dayPlan, dayIndex, onRegenerate, onSmartEdit, onMealUpdate, isLoading }) => {
  const [editingMeal, setEditingMeal] = useState<'breakfast' | 'lunch' | 'dinner' | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEditing = (mealType: 'breakfast' | 'lunch' | 'dinner') => {
    setEditingMeal(mealType);
    setEditValue(dayPlan[mealType] || '');
  };

  const saveEdit = () => {
    if (editingMeal && onMealUpdate) {
      onMealUpdate(dayIndex, editingMeal, editValue);
    }
    setEditingMeal(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingMeal(null);
    setEditValue('');
  };

  const renderMealSection = (
    type: 'breakfast' | 'lunch' | 'dinner',
    Icon: React.ElementType,
    colorClass: string,
    label: string
  ) => {
    const isEditing = editingMeal === type;
    const mealContent = dayPlan[type];

    return (
      <div className={`group ${type !== 'breakfast' ? 'pt-2 border-t border-dashed border-gray-200' : ''}`}>
        <div className="flex justify-between items-start">
          <div className={`flex items-center gap-2 text-xs font-semibold ${colorClass} mb-1`}>
            <Icon className="w-3 h-3" /> {label}
          </div>
          <div className="flex items-center gap-1">
            {onMealUpdate && !isEditing && (
              <button
                onClick={() => startEditing(type)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-green-600"
                title="Edit meal"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => onRegenerate(dayIndex, type)}
              disabled={isLoading || isEditing}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-blue-600 disabled:opacity-50"
              title="Quick Regenerate"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
            />
            <div className="flex gap-1">
              <button
                onClick={saveEdit}
                className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Save
              </button>
              <button
                onClick={cancelEdit}
                className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="text-gray-700 text-sm leading-snug markdown-body">
            <ReactMarkdown>{mealContent}</ReactMarkdown>
          </div>
        )}
      </div>
    );
  };

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
        {renderMealSection('breakfast', Sun, 'text-amber-600', 'BREAKFAST')}
        {renderMealSection('lunch', CloudSun, 'text-orange-600', 'LUNCH')}
        {renderMealSection('dinner', Moon, 'text-indigo-600', 'DINNER')}
      </div>
    </div>
  );
};

export default MealCard;