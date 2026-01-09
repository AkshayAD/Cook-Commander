import React from 'react';
import { GroceryItem } from '../types';
import { CheckSquare, Share2 } from 'lucide-react';

interface Props {
  items: GroceryItem[];
  onToggle: (index: number) => void;
}

const GroceryList: React.FC<Props> = ({ items, onToggle }) => {
  const categories = Array.from(new Set(items.map(i => i.category)));

  const handleShare = () => {
    const text = items.map(i => `${i.checked ? '[x]' : '[ ]'} ${i.item} (${i.quantity})`).join('\n');
    if (navigator.share) {
      navigator.share({
        title: 'CookCommander Grocery List',
        text: text,
      });
    } else {
      navigator.clipboard.writeText(text);
      alert('List copied to clipboard!');
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
        <p>No grocery list generated yet.</p>
        <p className="text-sm">Create a meal plan first.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="p-4 bg-orange-50 border-b border-orange-100 flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-orange-600" /> Grocery List
        </h2>
        <button onClick={handleShare} className="text-orange-600 hover:text-orange-700">
          <Share2 className="w-5 h-5" />
        </button>
      </div>
      
      <div className="p-4 space-y-6 max-h-[600px] overflow-y-auto">
        {categories.map(category => (
          <div key={category}>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{category}</h3>
            <ul className="space-y-2">
              {items.map((item, idx) => {
                if (item.category !== category) return null;
                return (
                  <li key={idx} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer" onClick={() => onToggle(idx)}>
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${item.checked ? 'bg-orange-500 border-orange-500' : 'border-gray-300'}`}>
                      {item.checked && <span className="text-white text-xs">✓</span>}
                    </div>
                    <div className={item.checked ? 'opacity-50 line-through' : ''}>
                      <span className="font-medium text-gray-800">{item.item}</span>
                      <span className="text-gray-500 text-sm ml-2">- {item.quantity}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GroceryList;