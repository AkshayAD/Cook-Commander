import React, { useState } from 'react';
import { Schedule, MealTransfer } from '../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Sun, Moon, CloudSun, ArrowRightLeft } from 'lucide-react';

interface Props {
  schedule: Schedule;
  onInitiateTransfer: (transfer: MealTransfer) => void;
}

const CalendarView: React.FC<Props> = ({ schedule, onInitiateTransfer }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getDayPlan = (date: Date) => {
      const dateKey = format(date, 'yyyy-MM-dd');
      return schedule[dateKey];
  };

  const handleDayClick = (date: Date) => {
      setSelectedDate(date);
  };

  const selectedPlan = selectedDate ? getDayPlan(selectedDate) : null;

  return (
    <div className="grid lg:grid-cols-3 gap-6 h-full">
      {/* Calendar Grid */}
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <div className="p-4 flex justify-between items-center border-b">
            <h2 className="font-bold text-lg text-gray-800">{format(currentMonth, 'MMMM yyyy')}</h2>
            <div className="flex gap-2">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-gray-100 rounded-full"><ChevronLeft className="w-5 h-5"/></button>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-gray-100 rounded-full"><ChevronRight className="w-5 h-5"/></button>
            </div>
        </div>
        
        <div className="grid grid-cols-7 text-center py-2 bg-gray-50 border-b text-xs font-semibold text-gray-400">
            {['S','M','T','W','T','F','S'].map((d,i) => <div key={i}>{d}</div>)}
        </div>

        <div className="grid grid-cols-7 flex-1 auto-rows-fr">
            {days.map((day) => {
                const plan = getDayPlan(day);
                // Check specifically if string is not empty
                const hasBreakfast = plan?.breakfast && plan.breakfast.trim() !== '';
                const hasLunch = plan?.lunch && plan.lunch.trim() !== '';
                const hasDinner = plan?.dinner && plan.dinner.trim() !== '';
                
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isCurrent = isToday(day);

                return (
                    <button
                        key={day.toISOString()}
                        onClick={() => handleDayClick(day)}
                        className={`min-h-[80px] p-2 border-b border-r border-gray-100 flex flex-col items-start gap-1 transition-colors hover:bg-gray-50 ${
                            isSelected ? 'bg-indigo-50 ring-inset ring-2 ring-indigo-500 z-10' : ''
                        }`}
                    >
                        <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isCurrent ? 'bg-indigo-600 text-white' : 'text-gray-700'}`}>
                            {format(day, 'd')}
                        </span>
                        
                        <div className="flex flex-wrap gap-1 mt-auto w-full">
                            {hasBreakfast && (
                                <div className="h-2 w-2 rounded-full bg-amber-400" title={`Breakfast: ${plan.breakfast}`} />
                            )}
                            {hasLunch && (
                                <div className="h-2 w-2 rounded-full bg-orange-500" title={`Lunch: ${plan.lunch}`} />
                            )}
                            {hasDinner && (
                                <div className="h-2 w-2 rounded-full bg-indigo-600" title={`Dinner: ${plan.dinner}`} />
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
        
        {/* Legend */}
        <div className="p-3 bg-gray-50 border-t flex gap-4 text-xs text-gray-500 justify-center">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400"/> Breakfast</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500"/> Lunch</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-600"/> Dinner</div>
        </div>
      </div>

      {/* Day Detail Sidebar */}
      <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col">
         <div className="p-4 border-b bg-gray-50">
            <h3 className="font-bold text-gray-800">
                {selectedDate ? format(selectedDate, 'EEEE, MMM d') : 'Select a Day'}
            </h3>
         </div>
         
         <div className="p-4 flex-1 overflow-y-auto space-y-4">
            {!selectedDate ? (
                <p className="text-gray-400 text-sm text-center mt-10">Tap a date to view meals</p>
            ) : !selectedPlan ? (
                <div className="text-center mt-10">
                    <p className="text-gray-400 text-sm mb-4">No meals planned for this day.</p>
                </div>
            ) : (
                <>
                    {(['Breakfast', 'Lunch', 'Dinner'] as const).map(type => {
                        const meal = selectedPlan[type.toLowerCase()];
                        if(!meal) return null;
                        
                        const Icon = type === 'Breakfast' ? Sun : type === 'Lunch' ? CloudSun : Moon;
                        const colorClass = type === 'Breakfast' ? 'text-amber-600' : type === 'Lunch' ? 'text-orange-600' : 'text-indigo-600';
                        
                        return (
                            <div key={type} className="group relative bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-2">
                                    <div className={`flex items-center gap-2 text-xs font-bold uppercase ${colorClass}`}>
                                        <Icon className="w-4 h-4" /> {type}
                                    </div>
                                    <button 
                                        onClick={() => onInitiateTransfer({
                                            sourceDate: format(selectedDate, 'yyyy-MM-dd'),
                                            sourceMealType: type,
                                            sourceMealName: meal
                                        })}
                                        className="text-gray-300 hover:text-indigo-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Move or Copy"
                                    >
                                        <ArrowRightLeft className="w-4 h-4" />
                                    </button>
                                </div>
                                <p className="text-gray-800 text-sm">{meal}</p>
                            </div>
                        )
                    })}
                </>
            )}
         </div>
      </div>
    </div>
  );
};

export default CalendarView;