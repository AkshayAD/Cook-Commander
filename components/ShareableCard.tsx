import React from 'react';
import { ChefHat } from 'lucide-react';
import { WeeklyPlan, GroceryItem } from '../types';

interface ShareableCardProps {
    type: 'plan' | 'grocery';
    data: WeeklyPlan | GroceryItem[];
    dateRange: string;
    id?: string;
}

const ShareableCard: React.FC<ShareableCardProps> = ({ type, data, dateRange, id = 'share-card' }) => {
    return (
        <div
            id={id}
            className="bg-white p-6 rounded-none w-[600px] text-gray-800 font-sans"
            style={{
                background: 'linear-gradient(to bottom, #ffffff 0%, #fff7ed 100%)',
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6 border-b border-orange-200 pb-4">
                <div className="flex items-center gap-3">
                    <div className="bg-orange-500 p-2 rounded-lg text-white">
                        <ChefHat size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 leading-tight">Cook Commander</h1>
                        <p className="text-xs text-orange-600 font-medium tracking-wide uppercase">
                            {type === 'plan' ? 'Weekly Meal Plan' : 'Grocery Shopping List'}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <span className="block text-sm font-semibold text-gray-500">Dates</span>
                    <span className="block text-lg font-bold text-gray-800">{dateRange}</span>
                </div>
            </div>

            {/* Content */}
            <div className="space-y-4">
                {type === 'plan' ? (
                    // MEAL PLAN VIEW
                    <div className="grid grid-cols-1 gap-3">
                        {(data as WeeklyPlan).days.map((day, idx) => (
                            <div key={idx} className="bg-white/80 border border-orange-100 rounded-lg p-3 shadow-sm">
                                <h3 className="text-sm font-bold text-orange-800 mb-2 uppercase border-b border-orange-50 pb-1">
                                    {day.day}
                                </h3>
                                <div className="space-y-1.5">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-xs font-bold text-gray-400 w-16 uppercase">Breakfast</span>
                                        <span className="text-sm text-gray-700 flex-1">{day.breakfast || '-'}</span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-xs font-bold text-gray-400 w-16 uppercase">Lunch</span>
                                        <span className="text-sm text-gray-700 flex-1">{day.lunch || '-'}</span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-xs font-bold text-gray-400 w-16 uppercase">Dinner</span>
                                        <span className="text-sm text-gray-700 flex-1">{day.dinner || '-'}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    // GROCERY LIST VIEW
                    <div className="columns-2 gap-4 space-y-4">
                        {Array.from(new Set((data as GroceryItem[]).map((i) => i.category))).map((cat) => (
                            <div key={cat} className="break-inside-avoid bg-white/60 rounded-lg p-3 border border-orange-100">
                                <h3 className="text-xs font-bold text-orange-800 uppercase mb-2 border-b border-orange-100 pb-1">
                                    {cat || 'Other'}
                                </h3>
                                <ul className="space-y-1">
                                    {(data as GroceryItem[])
                                        .filter((i) => i.category === cat)
                                        .map((item, i) => (
                                            <li key={i} className="text-sm text-gray-700 flex justify-between items-start gap-2">
                                                <span>{item.item}</span>
                                                <span className="text-gray-400 text-xs whitespace-nowrap">{item.quantity}</span>
                                            </li>
                                        ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-orange-100 flex justify-between items-center text-xs text-gray-400">
                <span>Generated by AI</span>
                <span>cookcommander.app</span>
            </div>
        </div>
    );
};

export default ShareableCard;
