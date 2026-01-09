import React, { useState, useEffect } from 'react';
import { ChefHat, ShoppingCart, Settings, RefreshCw, CalendarDays, FileText, Archive, ChevronDown, Calendar as CalendarIcon, ClipboardList } from 'lucide-react';
import { WeeklyPlan, UserPreferences, GroceryItem, PreferenceProfile, MealHistoryEntry, DayPlan, Schedule, MealTransfer } from './types';
import { DEFAULT_PREFERENCES } from './constants';
import { generateWeeklyPlan, generateGroceryList, regenerateSingleMeal, smartEditMeals } from './services/geminiService';
import PreferencesModal from './components/PreferencesModal';
import GroceryList from './components/GroceryList';
import MealCard from './components/MealCard';
import SmartEditModal from './components/SmartEditModal';
import CalendarView from './components/CalendarView';
import MoveMealModal from './components/MoveMealModal';
import ArchiveModal from './components/ArchiveModal';
import { format, addDays, parseISO } from 'date-fns';

function App() {
  const [profiles, setProfiles] = useState<PreferenceProfile[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string>('default');
  
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [groceryList, setGroceryList] = useState<GroceryItem[]>([]);
  const [schedule, setSchedule] = useState<Schedule>({});
  
  // History is now derived from schedule for optimization, but we keep the explicit history array for simple "Accepted" tracking if needed.
  // For simplicity, we can just use the schedule as history for AI learning.
  const [mealHistory, setMealHistory] = useState<MealHistoryEntry[]>([]); 
  
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [smartEditData, setSmartEditData] = useState<{dayPlan: DayPlan, index: number} | null>(null);
  const [transferData, setTransferData] = useState<MealTransfer | null>(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [groceryLoading, setGroceryLoading] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'plan' | 'calendar' | 'grocery'>('plan');

  // Load initial data
  useEffect(() => {
    const savedPlan = localStorage.getItem('cookcommander_plan');
    const savedProfiles = localStorage.getItem('cookcommander_profiles');
    const savedSchedule = localStorage.getItem('cookcommander_schedule');
    const savedCurrentId = localStorage.getItem('cookcommander_current_profile_id');

    if (savedPlan) setWeeklyPlan(JSON.parse(savedPlan));
    if (savedSchedule) setSchedule(JSON.parse(savedSchedule));
    
    if (savedProfiles) {
        setProfiles(JSON.parse(savedProfiles));
    } else {
        const defaultProfile: PreferenceProfile = {
            ...DEFAULT_PREFERENCES,
            id: 'default',
            name: 'Default Preferences'
        };
        setProfiles([defaultProfile]);
    }

    if (savedCurrentId) setCurrentProfileId(savedCurrentId);
  }, []);

  // Persistence Effects
  useEffect(() => {
     if(profiles.length > 0) localStorage.setItem('cookcommander_profiles', JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
     localStorage.setItem('cookcommander_schedule', JSON.stringify(schedule));
     
     // Update meal history array based on schedule for AI learning (flattened list)
     const history: MealHistoryEntry[] = [];
     Object.entries(schedule).forEach(([date, plan]) => {
         const dayPlan = plan as DayPlan;
         if(dayPlan.breakfast) history.push({ date, type: 'Breakfast', mealName: dayPlan.breakfast });
         if(dayPlan.lunch) history.push({ date, type: 'Lunch', mealName: dayPlan.lunch });
         if(dayPlan.dinner) history.push({ date, type: 'Dinner', mealName: dayPlan.dinner });
     });
     setMealHistory(history);

  }, [schedule]);
  
  useEffect(() => {
      localStorage.setItem('cookcommander_current_profile_id', currentProfileId);
  }, [currentProfileId]);

  const getActivePreferences = () => {
      return profiles.find(p => p.id === currentProfileId) || profiles[0] || DEFAULT_PREFERENCES;
  };

  const handleSaveProfile = (updatedProfile: PreferenceProfile) => {
    const existingIndex = profiles.findIndex(p => p.id === updatedProfile.id);
    let newProfiles = [...profiles];
    if (existingIndex >= 0) {
        newProfiles[existingIndex] = updatedProfile;
    } else {
        newProfiles.push(updatedProfile);
    }
    setProfiles(newProfiles);
    if (weeklyPlan) {
        handleUpdateGroceryList(weeklyPlan, updatedProfile);
    }
  };

  const handleGeneratePlan = async () => {
    setLoading(true);
    try {
      const prefs = getActivePreferences();
      const plan = await generateWeeklyPlan(prefs);
      
      // 1. Set Plan & Stop Main Loading Immediately
      setWeeklyPlan(plan);
      localStorage.setItem('cookcommander_plan', JSON.stringify(plan));
      setActiveTab('plan');
      setLoading(false); 

      // 2. Trigger Grocery Generation in Background
      setGroceryLoading(true);
      await handleUpdateGroceryList(plan, prefs);
      setGroceryLoading(false);

    } catch (error) {
      alert("Failed to generate plan. Please check your API key/Internet.");
      setLoading(false);
    }
  };

  const handleRegenerateMeal = async (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => {
    if (!weeklyPlan) return;
    setRegenLoading(true);
    try {
      const newMeal = await regenerateSingleMeal(weeklyPlan, dayIndex, mealType, getActivePreferences());
      const updatedPlan = { ...weeklyPlan };
      updatedPlan.days[dayIndex][mealType] = newMeal;
      setWeeklyPlan(updatedPlan);
      localStorage.setItem('cookcommander_plan', JSON.stringify(updatedPlan));
    } catch (error) {
      console.error(error);
    } finally {
      setRegenLoading(false);
    }
  };

  const handleUpdateGroceryList = async (plan: WeeklyPlan, prefs: UserPreferences) => {
    try {
      const groceries = await generateGroceryList(plan, prefs);
      setGroceryList(groceries);
    } catch (e) {
      console.error(e);
    }
  };
  
  const handleArchiveClick = () => {
    if (!weeklyPlan) return;
    setShowArchiveModal(true);
  };

  const handleArchiveConfirm = (dateStr: string) => {
    if (!weeklyPlan) return;
    
    // Validate date
    const startDate = parseISO(dateStr);
    if(isNaN(startDate.getTime())) {
        alert("Invalid Date");
        return;
    }

    const newSchedule = { ...schedule };
    weeklyPlan.days.forEach((day, idx) => {
        const currentDate = addDays(startDate, idx);
        const dateKey = format(currentDate, 'yyyy-MM-dd');
        newSchedule[dateKey] = { ...day, day: dateKey }; 
    });
    
    setSchedule(newSchedule);
    setWeeklyPlan(null);
    setGroceryList([]);
    localStorage.removeItem('cookcommander_plan');
    setActiveTab('calendar');
    // Removed Alert to make it smoother, transition does the job
  };

  const toggleGroceryItem = (index: number) => {
    const newList = [...groceryList];
    newList[index].checked = !newList[index].checked;
    setGroceryList(newList);
  };

  const handleSmartEditAnalyze = async (mealTypes: string[], instruction: string) => {
      if(!smartEditData || !weeklyPlan) return {};
      return await smartEditMeals(weeklyPlan, smartEditData.index, mealTypes, instruction, getActivePreferences());
  };
  
  const handleSmartEditConfirm = (updates: Record<string, string>) => {
      if(!smartEditData || !weeklyPlan) return;
      const updatedPlan = { ...weeklyPlan };
      Object.entries(updates).forEach(([type, meal]) => {
          updatedPlan.days[smartEditData.index][type] = meal;
      });
      setWeeklyPlan(updatedPlan);
      localStorage.setItem('cookcommander_plan', JSON.stringify(updatedPlan));
  };

  const handleTransferConfirm = (targetDate: string, targetType: string, action: 'copy' | 'move') => {
      if(!transferData) return;
      
      const newSchedule = { ...schedule };
      const sourceKey = transferData.sourceDate;
      
      // 1. Ensure Target Day Object Exists and is a NEW Reference
      const existingTarget = newSchedule[targetDate] || { day: targetDate, breakfast: '', lunch: '', dinner: '' };
      newSchedule[targetDate] = { ...existingTarget };
      
      // 2. Perform Copy
      newSchedule[targetDate][targetType.toLowerCase()] = transferData.sourceMealName;

      // 3. Perform Move (Delete source)
      if(action === 'move') {
          const existingSource = newSchedule[sourceKey];
          if(existingSource) {
             // Create new reference for source day too to trigger update
             newSchedule[sourceKey] = { ...existingSource };
             newSchedule[sourceKey][transferData.sourceMealType.toLowerCase()] = '';
          }
      }
      
      setSchedule(newSchedule);
  };

  const activeProfileName = profiles.find(p => p.id === currentProfileId)?.name || 'Default';

  return (
    <div className="min-h-screen pb-20 md:pb-0 bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30 shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-orange-500 p-2 rounded-lg">
              <ChefHat className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-gray-800 tracking-tight hidden sm:block">CookCommander</h1>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Profile Selector */}
            <div className="relative group">
                <button 
                    onClick={() => setIsPreferencesOpen(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                >
                    <span className="max-w-[100px] truncate">{activeProfileName}</span>
                    <ChevronDown className="w-4 h-4" />
                </button>
            </div>

            <button
              onClick={() => setIsPreferencesOpen(true)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              title="Preferences"
            >
              <Settings className="w-5 h-5" />
            </button>
            
            <button
              onClick={handleGeneratePlan}
              disabled={loading}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-70 flex items-center gap-2 shadow-sm"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="hidden sm:inline">{weeklyPlan ? 'Regenerate' : 'Generate'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 flex gap-4 overflow-x-auto sm:hidden shrink-0">
          {[
              { id: 'plan', label: 'Plan', icon: ClipboardList },
              { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
              { id: 'grocery', label: 'Shop', icon: ShoppingCart }
          ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
                }`}
              >
                  <tab.icon className="w-4 h-4" /> {tab.label}
              </button>
          ))}
      </div>

      {/* Desktop Tabs / Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">
        <div className="flex flex-col h-full gap-6">
            
            {/* Desktop Nav */}
            <div className="hidden sm:flex border-b border-gray-200 mb-2">
                 {[
                    { id: 'plan', label: 'Weekly Planner', icon: ClipboardList },
                    { id: 'calendar', label: 'Schedule & History', icon: CalendarIcon },
                    { id: 'grocery', label: 'Grocery List', icon: ShoppingCart }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 py-3 px-6 border-b-2 text-sm font-medium transition-colors ${
                            activeTab === tab.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" /> {tab.label}
                    </button>
                ))}
            </div>

            {/* PLANNER TAB */}
            <div className={`${activeTab === 'plan' ? 'block' : 'hidden'}`}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">Current Draft</h2>
                    {weeklyPlan && (
                        <div className="flex gap-2">
                            <button onClick={handleArchiveClick} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2 shadow-sm">
                                <Archive className="w-4 h-4"/> Save to Calendar
                            </button>
                        </div>
                    )}
                </div>

                {!weeklyPlan && !loading && (
                    <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200 shadow-sm max-w-2xl mx-auto">
                        <ChefHat className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to plan?</h3>
                        <p className="text-gray-500 mb-8">Generate a new weekly meal plan based on your <strong>{activeProfileName}</strong> profile.</p>
                        <button
                            onClick={handleGeneratePlan}
                            className="px-8 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 font-bold shadow-lg hover:shadow-xl transition-all"
                        >
                            Generate Plan
                        </button>
                    </div>
                )}
                
                 {loading && (
                    <div className="text-center py-20">
                        <RefreshCw className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
                        <p className="text-gray-600 font-medium">Cooking up a plan...</p>
                    </div>
                )}

                {weeklyPlan && (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                         {weeklyPlan.days.map((day, index) => (
                            <MealCard
                                key={day.day}
                                dayPlan={day}
                                dayIndex={index}
                                onRegenerate={handleRegenerateMeal}
                                onSmartEdit={(plan, idx) => setSmartEditData({ dayPlan: plan, index: idx })}
                                isLoading={regenLoading}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* CALENDAR TAB */}
            <div className={`${activeTab === 'calendar' ? 'block' : 'hidden'} h-[800px]`}>
                 <CalendarView schedule={schedule} onInitiateTransfer={setTransferData} />
            </div>

            {/* GROCERY TAB */}
            <div className={`${activeTab === 'grocery' ? 'block' : 'hidden'}`}>
                 <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        Shopping List
                        {groceryLoading && <RefreshCw className="w-4 h-4 animate-spin text-orange-500" />}
                    </h2>
                    {weeklyPlan && (
                        <button onClick={() => handleUpdateGroceryList(weeklyPlan, getActivePreferences())} className="text-sm text-indigo-600 hover:underline">
                            Regenerate List
                        </button>
                    )}
                </div>
                <GroceryList items={groceryList} onToggle={toggleGroceryItem} />
            </div>

        </div>
      </main>

      {/* Modals */}
      {isPreferencesOpen && (
        <PreferencesModal
          profiles={profiles}
          currentProfileId={currentProfileId}
          history={mealHistory}
          onSaveProfile={handleSaveProfile}
          onSwitchProfile={setCurrentProfileId}
          onClose={() => setIsPreferencesOpen(false)}
        />
      )}

      {smartEditData && (
          <SmartEditModal 
            dayPlan={smartEditData.dayPlan}
            preferences={getActivePreferences()}
            onAnalyze={handleSmartEditAnalyze}
            onConfirm={handleSmartEditConfirm}
            onClose={() => setSmartEditData(null)}
          />
      )}

      {transferData && (
          <MoveMealModal
             transfer={transferData}
             onConfirm={handleTransferConfirm}
             onClose={() => setTransferData(null)}
          />
      )}
      
      {showArchiveModal && (
        <ArchiveModal 
            onConfirm={handleArchiveConfirm} 
            onClose={() => setShowArchiveModal(false)} 
        />
      )}
    </div>
  );
}

export default App;