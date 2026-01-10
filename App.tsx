import React, { useState, useEffect, useCallback } from 'react';
import { ChefHat, ShoppingCart, Settings, RefreshCw, CalendarDays, FileText, Archive, ChevronDown, Calendar as CalendarIcon, ClipboardList, LogOut, Cpu, Share2 } from 'lucide-react';
import { WeeklyPlan, UserPreferences, GroceryItem, PreferenceProfile, MealHistoryEntry, DayPlan, Schedule, MealTransfer } from './types';
import { DEFAULT_PREFERENCES } from './constants';
import { generateWeeklyPlan, generateGroceryList, regenerateSingleMeal, smartEditMeals, generateGroceryListFromSchedule } from './services/geminiService';
import { useAuth } from './contexts/AuthContext';
import { useSettings } from './contexts/SettingsContext';
import * as supabaseService from './services/supabaseService';
import PreferencesModal from './components/PreferencesModal';
import GroceryList from './components/GroceryList';
import MealCard from './components/MealCard';
import SmartEditModal from './components/SmartEditModal';
import CalendarView from './components/CalendarView';
import MoveMealModal from './components/MoveMealModal';
import ArchiveModal from './components/ArchiveModal';
import AuthPage from './components/AuthPage';
import SettingsModal from './components/SettingsModal';
import UserMenu from './components/UserMenu';
import ShareModal from './components/ShareModal';
import { format, addDays, parseISO, startOfWeek, endOfWeek } from 'date-fns';

function App() {
  const { user, loading: authLoading, signOut, isConfigured } = useAuth();
  const { apiKey, modelName, isAuthenticated: hasApiKey } = useSettings();
  const [skipAuth, setSkipAuth] = useState(false);

  const [profiles, setProfiles] = useState<PreferenceProfile[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string>('default');

  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [groceryList, setGroceryList] = useState<GroceryItem[]>([]);
  const [schedule, setSchedule] = useState<Schedule>({});

  const [mealHistory, setMealHistory] = useState<MealHistoryEntry[]>([]);

  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [smartEditData, setSmartEditData] = useState<{ dayPlan: DayPlan, index: number } | null>(null);
  const [transferData, setTransferData] = useState<MealTransfer | null>(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [scheduleHistory, setScheduleHistory] = useState<Schedule[]>([]); // For undo/revert
  const [shareModalData, setShareModalData] = useState<{ isOpen: boolean; type: 'plan' | 'grocery'; data: any; dateRange: string }>({ isOpen: false, type: 'plan', data: null, dateRange: '' });
  const [loadedWeekRange, setLoadedWeekRange] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [groceryLoading, setGroceryLoading] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'plan' | 'calendar' | 'grocery'>('plan');

  // Get user ID (or 'local' for offline mode)
  const userId = user?.id || 'local';
  const isAuthenticated = !!user || skipAuth;

  // AI Config object
  const aiConfig = { apiKey, modelName };

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      if (!isAuthenticated) {
        setDataLoading(false);
        return;
      }

      setDataLoading(true);
      try {
        // Load profiles
        const loadedProfiles = await supabaseService.getPreferenceProfiles(userId);
        if (loadedProfiles.length > 0) {
          setProfiles(loadedProfiles);
          // Load current profile ID from localStorage as it's session-specific
          const savedCurrentId = localStorage.getItem('cookcommander_current_profile_id');
          if (savedCurrentId && loadedProfiles.find(p => p.id === savedCurrentId)) {
            setCurrentProfileId(savedCurrentId);
          } else {
            setCurrentProfileId(loadedProfiles[0].id);
          }
        } else {
          // Create default profile with proper UUID for Supabase
          const defaultProfileId = crypto.randomUUID();
          const defaultProfile: PreferenceProfile = {
            ...DEFAULT_PREFERENCES,
            id: defaultProfileId,
            name: 'Default Preferences'
          };
          setProfiles([defaultProfile]);
          setCurrentProfileId(defaultProfileId);
          await supabaseService.savePreferenceProfile(defaultProfile, userId);
        }

        // Load current plan
        const loadedPlan = await supabaseService.getCurrentPlan(userId);
        setWeeklyPlan(loadedPlan);

        // Load schedule
        const loadedSchedule = await supabaseService.getSchedule(userId);
        setSchedule(loadedSchedule);

        // Load meal history
        const loadedHistory = await supabaseService.getMealHistory(userId);
        setMealHistory(loadedHistory);

      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setDataLoading(false);
      }
    };

    loadData();
  }, [isAuthenticated, userId]);

  // Subscribe to real-time schedule changes
  useEffect(() => {
    if (!isAuthenticated || skipAuth) return;

    const subscription = supabaseService.subscribeToScheduleChanges(userId, (newSchedule) => {
      setSchedule(newSchedule);
    });

    return () => subscription.unsubscribe();
  }, [isAuthenticated, userId, skipAuth]);

  // Save current profile ID to localStorage
  useEffect(() => {
    localStorage.setItem('cookcommander_current_profile_id', currentProfileId);
  }, [currentProfileId]);

  // Update meal history from schedule (for offline compatibility)
  useEffect(() => {
    if (skipAuth || !user) {
      const history: MealHistoryEntry[] = [];
      Object.entries(schedule).forEach(([date, plan]) => {
        const dayPlan = plan as DayPlan;
        if (dayPlan.breakfast) history.push({ date, type: 'Breakfast', mealName: dayPlan.breakfast });
        if (dayPlan.lunch) history.push({ date, type: 'Lunch', mealName: dayPlan.lunch });
        if (dayPlan.dinner) history.push({ date, type: 'Dinner', mealName: dayPlan.dinner });
      });
      setMealHistory(history);
    }
  }, [schedule, skipAuth, user]);

  // Show settings modal if not configured
  useEffect(() => {
    if (isAuthenticated && !hasApiKey) {
      setIsSettingsOpen(true);
    }
  }, [isAuthenticated, hasApiKey]);

  const getActivePreferences = useCallback(() => {
    return profiles.find(p => p.id === currentProfileId) || profiles[0] || DEFAULT_PREFERENCES;
  }, [profiles, currentProfileId]);

  const handleSaveProfile = async (updatedProfile: PreferenceProfile) => {
    try {
      await supabaseService.savePreferenceProfile(updatedProfile, userId);

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
    } catch (error: any) {
      console.error('Failed to save profile:', error);
      alert(`Failed to save profile: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    try {
      await supabaseService.deletePreferenceProfile(profileId, userId);
      const newProfiles = profiles.filter(p => p.id !== profileId);
      setProfiles(newProfiles);
      // Switch to first remaining profile if deleted current
      if (currentProfileId === profileId && newProfiles.length > 0) {
        setCurrentProfileId(newProfiles[0].id);
      }
    } catch (error: any) {
      console.error('Failed to delete profile:', error);
      alert(`Failed to delete profile: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleLoadWeek = useCallback(async (date: Date) => {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const end = endOfWeek(date, { weekStartsOn: 1 });
    const startDateStr = format(start, 'yyyy-MM-dd');
    const endDateStr = format(end, 'yyyy-MM-dd');

    // Set the loaded week range for share modal
    const dateRangeStr = `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    setLoadedWeekRange(dateRangeStr);

    try {
      const sched = await supabaseService.getSchedule(userId, startDateStr, endDateStr);

      const days: DayPlan[] = [];
      for (let i = 0; i < 7; i++) {
        const currentDate = addDays(start, i);
        const dateKey = format(currentDate, 'yyyy-MM-dd');
        const dayName = format(currentDate, 'EEEE');

        if (sched[dateKey]) {
          days.push({ ...sched[dateKey], day: dayName });
        } else {
          days.push({ day: dayName, breakfast: '', lunch: '', dinner: '' });
        }
      }

      setWeeklyPlan({ days });
      setActiveTab('plan');
    } catch (error) {
      console.error('Failed to load week:', error);
      alert('Failed to load selected week into planner');
    }
  }, [userId]);

  const handleGeneratePlan = async () => {
    if (!hasApiKey) {
      setIsSettingsOpen(true);
      return;
    }

    setLoading(true);
    try {
      const prefs = getActivePreferences();

      // Fetch learning summary from last 3 months of accepted meals
      const learningSummary = await supabaseService.getMealLearningSummary(userId, 3);

      // Generate plan with learning context
      const plan = await generateWeeklyPlan(prefs, aiConfig, learningSummary);

      // Save to Supabase
      await supabaseService.savePlan(plan, userId, currentProfileId);

      setWeeklyPlan(plan);
      setLoadedWeekRange(''); // Clear so Share uses current week
      setActiveTab('plan');
      setLoading(false);

      // Generate grocery in background
      setGroceryLoading(true);
      await handleUpdateGroceryList(plan, prefs);
      setGroceryLoading(false);

    } catch (error: any) {
      console.error("Plan Generation Error", error);
      const errorMessage = error?.message || 'Unknown error';
      if (errorMessage.includes('API Key') || errorMessage.includes('API key')) {
        alert(`API Key Error: ${errorMessage}`);
        setIsSettingsOpen(true);
      } else {
        alert(`Failed to generate plan: ${errorMessage}`);
      }
      setLoading(false);
    }
  };

  const handleRegenerateMeal = async (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => {
    if (!weeklyPlan) return;
    setRegenLoading(true);
    try {
      const newMeal = await regenerateSingleMeal(weeklyPlan, dayIndex, mealType, getActivePreferences(), aiConfig);
      const updatedPlan = { ...weeklyPlan };
      updatedPlan.days[dayIndex][mealType] = newMeal;
      setWeeklyPlan(updatedPlan);

      // Save updated plan
      await supabaseService.savePlan(updatedPlan, userId, currentProfileId);
    } catch (error) {
      console.error(error);
    } finally {
      setRegenLoading(false);
    }
  };

  const handleUpdateGroceryList = async (plan: WeeklyPlan, prefs: UserPreferences) => {
    try {
      const groceries = await generateGroceryList(plan, prefs, aiConfig);
      setGroceryList(groceries);
    } catch (e) {
      console.error(e);
    }
  };

  const handleArchiveClick = () => {
    if (!weeklyPlan) return;
    setShowArchiveModal(true);
  };

  const handleArchiveConfirm = async (dateStr: string, overwrite: boolean = true) => {
    if (!weeklyPlan) return;

    const startDate = parseISO(dateStr);
    if (isNaN(startDate.getTime())) {
      alert("Invalid Date");
      return;
    }

    try {
      // Save current schedule to history for revert
      setScheduleHistory(prev => [...prev.slice(-4), { ...schedule }]); // Keep last 5 states

      await supabaseService.archivePlanToSchedule(weeklyPlan, dateStr, userId);

      // Update local state with overwrite logic
      const newSchedule = { ...schedule };
      weeklyPlan.days.forEach((day, idx) => {
        const currentDate = addDays(startDate, idx);
        const dateKey = format(currentDate, 'yyyy-MM-dd');
        const existing = schedule[dateKey];

        if (overwrite) {
          // Overwrite regardless of existing meals
          newSchedule[dateKey] = { ...day, day: dateKey };
        } else {
          // Only fill if no existing meals
          if (!existing || (!existing.breakfast && !existing.lunch && !existing.dinner)) {
            newSchedule[dateKey] = { ...day, day: dateKey };
          }
        }
      });

      setSchedule(newSchedule);
      setWeeklyPlan(null);
      setGroceryList([]);
      setActiveTab('calendar');
    } catch (error) {
      console.error('Failed to save to calendar:', error);
      alert('Failed to save to calendar. Please try again.');
    }
  };

  // Revert to previous schedule state
  const handleRevertSchedule = async () => {
    if (scheduleHistory.length === 0) {
      alert('No previous state to revert to.');
      return;
    }

    const previousSchedule = scheduleHistory[scheduleHistory.length - 1];
    setSchedule(previousSchedule);
    setScheduleHistory(prev => prev.slice(0, -1));

    // Save reverted state to Supabase
    try {
      for (const dateKey of Object.keys(previousSchedule)) {
        await supabaseService.saveScheduledMeal(dateKey, previousSchedule[dateKey], userId);
      }
    } catch (error) {
      console.error('Failed to save reverted state:', error);
    }
  };

  const toggleGroceryItem = (index: number) => {
    const newList = [...groceryList];
    newList[index].checked = !newList[index].checked;
    setGroceryList(newList);
  };

  const handleGenerateGroceryFromWeek = async (meals: { date: string; breakfast: string; lunch: string; dinner: string }[]) => {
    if (!hasApiKey) {
      setIsSettingsOpen(true);
      return;
    }

    setGroceryLoading(true);
    try {
      const prefs = getActivePreferences();
      const list = await generateGroceryListFromSchedule(meals, prefs, aiConfig);
      setGroceryList(list);
      setActiveTab('grocery');
    } catch (error: any) {
      console.error('Grocery generation error:', error);
      alert(`Failed to generate grocery list: ${error?.message || 'Unknown error'}`);
    } finally {
      setGroceryLoading(false);
    }
  };

  const handleSmartEditAnalyze = async (mealTypes: string[], instruction: string) => {
    if (!smartEditData || !weeklyPlan) return {};
    return await smartEditMeals(weeklyPlan, smartEditData.index, mealTypes, instruction, getActivePreferences(), aiConfig);
  };

  const handleSmartEditConfirm = async (updates: Record<string, string>) => {
    if (!smartEditData || !weeklyPlan) return;
    const updatedPlan = { ...weeklyPlan };
    Object.entries(updates).forEach(([type, meal]) => {
      updatedPlan.days[smartEditData.index][type] = meal;
    });
    setWeeklyPlan(updatedPlan);

    // Save updated plan
    await supabaseService.savePlan(updatedPlan, userId, currentProfileId);
  };

  // Handle inline meal edits in weekly planner
  const handleMealUpdate = async (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner', newValue: string) => {
    if (!weeklyPlan) return;
    const updatedPlan = { ...weeklyPlan };
    updatedPlan.days[dayIndex][mealType] = newValue;
    setWeeklyPlan(updatedPlan);
    await supabaseService.savePlan(updatedPlan, userId, currentProfileId);
  };

  // Handle inline meal edits in schedule/calendar
  const handleScheduleMealUpdate = async (dateKey: string, mealType: 'breakfast' | 'lunch' | 'dinner', newValue: string) => {
    const newSchedule = { ...schedule };
    if (!newSchedule[dateKey]) {
      newSchedule[dateKey] = { day: dateKey, breakfast: '', lunch: '', dinner: '' };
    }
    newSchedule[dateKey][mealType] = newValue;
    setSchedule(newSchedule);
    await supabaseService.saveScheduledMeal(dateKey, newSchedule[dateKey], userId);
  };

  const handleTransferConfirm = async (targetDate: string, targetType: string, action: 'copy' | 'move') => {
    if (!transferData) return;

    const newSchedule = { ...schedule };
    const sourceKey = transferData.sourceDate;

    // Ensure Target Day Object Exists
    const existingTarget = newSchedule[targetDate] || { day: targetDate, breakfast: '', lunch: '', dinner: '' };
    newSchedule[targetDate] = { ...existingTarget };

    // Perform Copy
    newSchedule[targetDate][targetType.toLowerCase()] = transferData.sourceMealName;

    // Perform Move (Delete source)
    if (action === 'move') {
      const existingSource = newSchedule[sourceKey];
      if (existingSource) {
        newSchedule[sourceKey] = { ...existingSource };
        newSchedule[sourceKey][transferData.sourceMealType.toLowerCase()] = '';
      }
    }

    setSchedule(newSchedule);

    // Save to Supabase
    try {
      await supabaseService.saveScheduledMeal(targetDate, newSchedule[targetDate], userId);
      if (action === 'move' && newSchedule[sourceKey]) {
        await supabaseService.saveScheduledMeal(sourceKey, newSchedule[sourceKey], userId);
      }
    } catch (error) {
      console.error('Failed to save meal transfer:', error);
    }
  };

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  // Show auth page if not authenticated and Supabase is configured
  if (!isAuthenticated && isConfigured) {
    return <AuthPage onSkipAuth={() => setSkipAuth(true)} />;
  }

  // Show config message if Supabase not configured and not skipping
  if (!isAuthenticated && !isConfigured && !skipAuth) {
    return <AuthPage onSkipAuth={() => setSkipAuth(true)} />;
  }

  // Show loading while fetching data
  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center flex-col gap-4">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-gray-500">Loading your data...</p>
      </div>
    );
  }

  const activeProfileName = profiles.find(p => p.id === currentProfileId)?.name || 'Default';

  return (
    <div className="min-h-dvh pb-20 md:pb-0 bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30 shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          {/* Left: Logo */}
          <div className="flex items-center gap-2">
            <div className="bg-orange-500 p-2 rounded-lg">
              <ChefHat className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-gray-800 tracking-tight hidden sm:block">CookCommander</h1>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Profile Selector (Meal Preferences) */}
            <div className="relative group">
              <button
                onClick={() => setIsPreferencesOpen(true)}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors min-h-[44px]"
              >
                <span className="max-w-[60px] sm:max-w-[100px] truncate hidden xs:inline">{activeProfileName}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* AI Settings */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg relative min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="AI Settings"
            >
              <Cpu className="w-5 h-5" />
              {!hasApiKey && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
            </button>

            {/* Preferences */}
            <button
              onClick={() => setIsPreferencesOpen(true)}
              className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Preferences"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Generate Plan Button */}
            <button
              onClick={handleGeneratePlan}
              disabled={loading}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-70 flex items-center gap-2 shadow-sm"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="hidden sm:inline">{weeklyPlan ? 'Regenerate' : 'Generate'}</span>
            </button>

            {/* User Menu */}
            <UserMenu
              userEmail={user?.email || null}
              isOfflineMode={!user && skipAuth}
              onSignOut={signOut}
              onSwitchAccount={() => {
                signOut();
                setSkipAuth(false);
              }}
            />
          </div>
        </div>
      </header>

      {/* Mobile Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 flex gap-4 overflow-x-auto sm:hidden shrink-0">
        {[
          { id: 'plan', label: 'Plan', icon: ClipboardList },
          { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
          { id: 'grocery', label: 'Grocery', icon: ShoppingCart }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 py-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
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
                className={`flex items-center gap-2 py-3 px-6 border-b-2 text-sm font-medium transition-colors ${activeTab === tab.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'
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
                  <button
                    onClick={() => {
                      // Use loaded week range if available, otherwise calculate current week
                      let dateRangeStr = loadedWeekRange;
                      if (!dateRangeStr) {
                        const today = new Date();
                        const weekStart = startOfWeek(today, { weekStartsOn: 1 });
                        const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
                        dateRangeStr = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
                      }
                      setShareModalData({
                        isOpen: true,
                        type: 'plan',
                        data: weeklyPlan,
                        dateRange: dateRangeStr
                      });
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center gap-2 shadow-sm"
                  >
                    <Share2 className="w-4 h-4" /> Share
                  </button>
                  <button onClick={handleArchiveClick} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2 shadow-sm">
                    <Archive className="w-4 h-4" /> Save to Calendar
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
                <p className="text-gray-600 font-medium">Creating your meal plan in ~30 seconds...</p>
                <p className="text-sm text-gray-400 mt-2">AI is thinking about seasonal ingredients and your preferences</p>
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
                    onMealUpdate={handleMealUpdate}
                    isLoading={regenLoading}
                  />
                ))}
              </div>
            )}
          </div>

          {/* CALENDAR TAB */}
          <div className={`${activeTab === 'calendar' ? 'block' : 'hidden'} h-[800px]`}>
            <CalendarView
              schedule={schedule}
              onInitiateTransfer={setTransferData}
              onGenerateGroceryFromWeek={handleGenerateGroceryFromWeek}
              groceryLoading={groceryLoading}
              onMealUpdate={handleScheduleMealUpdate}
              onRevert={handleRevertSchedule}
              canRevert={scheduleHistory.length > 0}
              onLoadWeek={handleLoadWeek}
            />
          </div>

          {/* GROCERY TAB */}
          <div className={`${activeTab === 'grocery' ? 'block' : 'hidden'}`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                Shopping List
                {groceryLoading && <RefreshCw className="w-4 h-4 animate-spin text-orange-500" />}
              </h2>
            </div>
            <GroceryList
              items={groceryList}
              onToggle={toggleGroceryItem}
              schedule={schedule}
              onGenerateFromDates={handleGenerateGroceryFromWeek}
              loading={groceryLoading}
              onLoadSavedList={(items) => setGroceryList(items)}
              userId={userId}
              onShare={(items, range) => setShareModalData({ isOpen: true, type: 'grocery', data: items, dateRange: range })}
            />
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
          onDeleteProfile={handleDeleteProfile}
          onClose={() => setIsPreferencesOpen(false)}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          canClose={hasApiKey}
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
          schedule={schedule}
          daysCount={weeklyPlan?.days.length || 7}
        />
      )}

      {shareModalData.isOpen && (
        <ShareModal
          isOpen={shareModalData.isOpen}
          onClose={() => setShareModalData({ ...shareModalData, isOpen: false })}
          type={shareModalData.type}
          data={shareModalData.data}
          dateRange={shareModalData.dateRange}
        />
      )}
    </div>
  );
}

export default App;