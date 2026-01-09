import React, { useState } from 'react';
import { X, Calendar as CalendarIcon, Save } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  onConfirm: (startDate: string) => void;
  onClose: () => void;
}

const ArchiveModal: React.FC<Props> = ({ onConfirm, onClose }) => {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const handleConfirm = () => {
    onConfirm(date);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-green-100 p-1.5 rounded-lg text-green-700">
                <CalendarIcon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-800">Save to Calendar</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            Select the start date (Monday) for this week's meal plan. The meals will be saved to your history starting from this date.
          </p>
          
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Start Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-medium text-gray-800"
          />
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-2.5 text-gray-600 font-semibold hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            className="flex-1 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-md hover:shadow-lg transition-all flex justify-center items-center gap-2"
          >
            <Save className="w-4 h-4" /> Save
          </button>
        </div>

      </div>
    </div>
  );
};

export default ArchiveModal;