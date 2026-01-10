/**
 * Supabase Data Service
 * Handles all CRUD operations for QookCommander with Supabase backend.
 * Falls back gracefully to localStorage when Supabase is not configured or user is in offline mode.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
    PreferenceProfile,
    WeeklyPlan,
    DayPlan,
    Schedule,
    GroceryItem,
    MealHistoryEntry,
    MealType,
    SavedGroceryList
} from '../types';

// Helper to check if we should use localStorage instead of Supabase
// Returns true if Supabase is not configured OR if user is in "local/offline" mode
const isOfflineMode = (userId: string): boolean => {
    return !isSupabaseConfigured || !supabase || userId === 'local';
};

// ============================================================================
// USER SETTINGS (Cross-device sync for API key, Cook contact)
// ============================================================================

export interface UserSettings {
    geminiApiKey: string;
    cookName: string;
    cookWhatsappNumber: string;
}

export const getUserSettings = async (userId: string): Promise<UserSettings | null> => {
    if (isOfflineMode(userId)) {
        // Fallback to localStorage
        return {
            geminiApiKey: localStorage.getItem('gemini_api_key') || '',
            cookName: localStorage.getItem('cook_name') || '',
            cookWhatsappNumber: localStorage.getItem('cook_number') || ''
        };
    }

    try {
        const { data, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            console.error('Error fetching user settings:', error);
            return null;
        }

        if (!data) return null;

        return {
            geminiApiKey: data.gemini_api_key || '',
            cookName: data.cook_name || '',
            cookWhatsappNumber: data.cook_whatsapp_number || ''
        };
    } catch (err) {
        console.error('Error in getUserSettings:', err);
        return null;
    }
};

export const saveUserSettings = async (userId: string, settings: Partial<UserSettings>): Promise<void> => {
    if (isOfflineMode(userId)) {
        // Fallback to localStorage
        if (settings.geminiApiKey !== undefined) localStorage.setItem('gemini_api_key', settings.geminiApiKey);
        if (settings.cookName !== undefined) localStorage.setItem('cook_name', settings.cookName);
        if (settings.cookWhatsappNumber !== undefined) localStorage.setItem('cook_number', settings.cookWhatsappNumber);
        return;
    }

    try {
        const updateData: any = { user_id: userId, updated_at: new Date().toISOString() };
        if (settings.geminiApiKey !== undefined) updateData.gemini_api_key = settings.geminiApiKey;
        if (settings.cookName !== undefined) updateData.cook_name = settings.cookName;
        if (settings.cookWhatsappNumber !== undefined) updateData.cook_whatsapp_number = settings.cookWhatsappNumber;

        const { error } = await supabase
            .from('user_settings')
            .upsert(updateData, { onConflict: 'user_id' });

        if (error) {
            console.error('Error saving user settings:', error);
            throw error;
        }
    } catch (err) {
        console.error('Error in saveUserSettings:', err);
        throw err;
    }
};

// ============================================================================
// HELPER: Convert between app types and database types
// ============================================================================

interface PreferenceProfileRow {
    id: string;
    user_id: string;
    name: string;
    dietary_type: string | null;
    allergies: string[] | null;
    dislikes: string[] | null;
    breakfast_preferences: string[] | null;
    lunch_preferences: string[] | null;
    dinner_preferences: string[] | null;
    special_instructions: string | null;
    pantry_staples: string[] | null;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}

interface ScheduledMealRow {
    id: string;
    user_id: string;
    date: string;
    breakfast: string | null;
    lunch: string | null;
    dinner: string | null;
    created_at: string;
    updated_at: string;
}

const profileRowToApp = (row: PreferenceProfileRow): PreferenceProfile => ({
    id: row.id,
    name: row.name,
    dietaryType: row.dietary_type || '',
    allergies: row.allergies || [],
    dislikes: row.dislikes || [],
    breakfastPreferences: row.breakfast_preferences || [],
    lunchPreferences: row.lunch_preferences || [],
    dinnerPreferences: row.dinner_preferences || [],
    specialInstructions: row.special_instructions || '',
    pantryStaples: row.pantry_staples || [],
});

const profileAppToRow = (profile: PreferenceProfile, userId: string) => ({
    id: profile.id,
    user_id: userId,
    name: profile.name,
    dietary_type: profile.dietaryType,
    allergies: profile.allergies,
    dislikes: profile.dislikes,
    breakfast_preferences: profile.breakfastPreferences,
    lunch_preferences: profile.lunchPreferences,
    dinner_preferences: profile.dinnerPreferences,
    special_instructions: profile.specialInstructions,
    pantry_staples: profile.pantryStaples,
});

const scheduledMealRowToDay = (row: ScheduledMealRow): DayPlan => ({
    day: row.date,
    breakfast: row.breakfast || '',
    lunch: row.lunch || '',
    dinner: row.dinner || '',
});

// ============================================================================
// PREFERENCE PROFILES
// ============================================================================

export const getPreferenceProfiles = async (userId: string): Promise<PreferenceProfile[]> => {
    if (isOfflineMode(userId)) {
        const saved = localStorage.getItem('qookcommander_profiles');
        return saved ? JSON.parse(saved) : [];
    }

    const { data, error } = await supabase
        .from('preference_profiles')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching profiles:', error);
        throw error;
    }

    return (data || []).map((row: any) => profileRowToApp(row as PreferenceProfileRow));
};

export const savePreferenceProfile = async (
    profile: PreferenceProfile,
    userId: string
): Promise<PreferenceProfile> => {
    if (isOfflineMode(userId)) {
        // Fallback to localStorage
        const saved = localStorage.getItem('qookcommander_profiles');
        const profiles: PreferenceProfile[] = saved ? JSON.parse(saved) : [];
        const existingIdx = profiles.findIndex(p => p.id === profile.id);

        if (existingIdx >= 0) {
            profiles[existingIdx] = profile;
        } else {
            profiles.push(profile);
        }

        localStorage.setItem('qookcommander_profiles', JSON.stringify(profiles));
        return profile;
    }

    const rowData = profileAppToRow(profile, userId);

    const { data, error } = await supabase
        .from('preference_profiles')
        .upsert(rowData as any)
        .select()
        .single();

    if (error) {
        console.error('Error saving profile:', error);
        throw error;
    }

    return profileRowToApp(data as PreferenceProfileRow);
};

export const deletePreferenceProfile = async (profileId: string, userId: string = 'local'): Promise<void> => {
    if (isOfflineMode(userId)) {
        const saved = localStorage.getItem('qookcommander_profiles');
        const profiles: PreferenceProfile[] = saved ? JSON.parse(saved) : [];
        const filtered = profiles.filter(p => p.id !== profileId);
        localStorage.setItem('qookcommander_profiles', JSON.stringify(filtered));
        return;
    }

    const { error } = await supabase
        .from('preference_profiles')
        .delete()
        .eq('id', profileId);

    if (error) {
        console.error('Error deleting profile:', error);
        throw error;
    }
};

// ============================================================================
// WEEKLY PLANS
// ============================================================================

export const getCurrentPlan = async (userId: string): Promise<WeeklyPlan | null> => {
    if (isOfflineMode(userId)) {
        const saved = localStorage.getItem('qookcommander_plan');
        return saved ? JSON.parse(saved) : null;
    }

    const { data, error } = await supabase
        .from('weekly_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('is_current', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        // PGRST116 = no rows returned for single(), 406 = Not Acceptable (often means no/multiple rows)
        if (error.code === 'PGRST116' || error.message?.includes('406')) return null;
        console.error('Error fetching plan:', error);
        throw error;
    }

    return { days: data.days as DayPlan[] };
};

export const savePlan = async (
    plan: WeeklyPlan,
    userId: string,
    profileId?: string
): Promise<string> => {
    if (isOfflineMode(userId)) {
        localStorage.setItem('qookcommander_plan', JSON.stringify(plan));
        return 'local';
    }

    // Mark all existing as not current
    await supabase
        .from('weekly_plans')
        .update({ is_current: false })
        .eq('user_id', userId);

    const { data, error } = await supabase
        .from('weekly_plans')
        .insert({
            user_id: userId,
            profile_id: profileId,
            days: plan.days as any,
            is_current: true,
        })
        .select('id')
        .single();

    if (error) {
        console.error('Error saving plan:', error);
        throw error;
    }

    return data.id;
};

export const clearCurrentPlan = async (userId: string): Promise<void> => {
    if (isOfflineMode(userId)) {
        localStorage.removeItem('qookcommander_plan');
        return;
    }

    await supabase
        .from('weekly_plans')
        .update({ is_current: false })
        .eq('user_id', userId)
        .eq('is_current', true);
};

// ============================================================================
// SCHEDULED MEALS (Calendar)
// ============================================================================

export const getSchedule = async (
    userId: string,
    startDate?: string,
    endDate?: string
): Promise<Schedule> => {
    if (isOfflineMode(userId)) {
        const saved = localStorage.getItem('qookcommander_schedule');
        return saved ? JSON.parse(saved) : {};
    }

    let query = supabase
        .from('scheduled_meals')
        .select('*')
        .eq('user_id', userId);

    if (startDate) {
        query = query.gte('date', startDate);
    }
    if (endDate) {
        query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching schedule:', error);
        throw error;
    }

    const schedule: Schedule = {};
    (data || []).forEach((row: any) => {
        schedule[row.date] = scheduledMealRowToDay(row as ScheduledMealRow);
    });

    return schedule;
};

export const saveScheduledMeal = async (
    date: string,
    dayPlan: DayPlan,
    userId: string
): Promise<void> => {
    if (isOfflineMode(userId)) {
        const saved = localStorage.getItem('qookcommander_schedule');
        const schedule: Schedule = saved ? JSON.parse(saved) : {};
        schedule[date] = dayPlan;
        localStorage.setItem('qookcommander_schedule', JSON.stringify(schedule));
        return;
    }

    const { error } = await supabase
        .from('scheduled_meals')
        .upsert({
            user_id: userId,
            date: date,
            breakfast: dayPlan.breakfast || null,
            lunch: dayPlan.lunch || null,
            dinner: dayPlan.dinner || null,
        } as any);

    if (error) {
        console.error('Error saving scheduled meal:', error);
        throw error;
    }
};

export const archivePlanToSchedule = async (
    plan: WeeklyPlan,
    startDate: string,
    userId: string
): Promise<void> => {
    if (isOfflineMode(userId)) {
        const saved = localStorage.getItem('qookcommander_schedule');
        const schedule: Schedule = saved ? JSON.parse(saved) : {};

        plan.days.forEach((day, idx) => {
            const date = addDays(startDate, idx);
            schedule[date] = { ...day, day: date };
        });

        localStorage.setItem('qookcommander_schedule', JSON.stringify(schedule));
        localStorage.removeItem('qookcommander_plan');
        return;
    }

    const rows = plan.days.map((day, idx) => ({
        user_id: userId,
        date: addDays(startDate, idx),
        breakfast: day.breakfast || null,
        lunch: day.lunch || null,
        dinner: day.dinner || null,
    }));

    const { error } = await supabase
        .from('scheduled_meals')
        .upsert(rows as any, {
            onConflict: 'user_id,date',
            ignoreDuplicates: false
        });

    if (error) {
        console.error('Error archiving plan:', error);
        throw error;
    }

    // Clear current plan
    await clearCurrentPlan(userId);
};

// Helper to add days to a date string
const addDays = (dateStr: string, days: number): string => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
};

// ============================================================================
// GROCERY LISTS
// ============================================================================

export const saveGroceryList = async (
    items: GroceryItem[],
    userId: string,
    planId?: string
): Promise<void> => {
    if (isOfflineMode(userId)) {
        // Grocery list is ephemeral in the app, not saved to localStorage currently
        return;
    }

    const { error } = await supabase
        .from('grocery_lists')
        .insert({
            user_id: userId,
            plan_id: planId,
            items: items as any,
        });

    if (error) {
        console.error('Error saving grocery list:', error);
        throw error;
    }
};

// ============================================================================
// MEAL HISTORY (for AI learning)
// ============================================================================

export const getMealHistory = async (
    userId: string,
    limit: number = 100
): Promise<MealHistoryEntry[]> => {
    if (isOfflineMode(userId)) {
        // Derive from schedule in offline mode
        const saved = localStorage.getItem('qookcommander_schedule');
        const schedule: Schedule = saved ? JSON.parse(saved) : {};

        const history: MealHistoryEntry[] = [];
        Object.entries(schedule).forEach(([date, plan]) => {
            const dayPlan = plan as DayPlan;
            if (dayPlan.breakfast) history.push({ date, type: 'Breakfast', mealName: dayPlan.breakfast });
            if (dayPlan.lunch) history.push({ date, type: 'Lunch', mealName: dayPlan.lunch });
            if (dayPlan.dinner) history.push({ date, type: 'Dinner', mealName: dayPlan.dinner });
        });

        return history.slice(-limit);
    }

    const { data, error } = await supabase
        .from('meal_history')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching meal history:', error);
        throw error;
    }

    return (data || []).map((row: any) => ({
        date: row.date,
        type: row.meal_type as MealType,
        mealName: row.meal_name,
        rating: row.rating as 'liked' | 'disliked' | undefined,
    }));
};

export const saveMealHistory = async (
    entries: MealHistoryEntry[],
    userId: string
): Promise<void> => {
    if (isOfflineMode(userId)) {
        return; // History is derived from schedule in offline mode
    }

    const rows = entries.map(entry => ({
        user_id: userId,
        date: entry.date,
        meal_type: entry.type,
        meal_name: entry.mealName,
        rating: entry.rating || null,
    }));

    const { error } = await supabase
        .from('meal_history')
        .insert(rows as any);

    if (error) {
        console.error('Error saving meal history:', error);
        throw error;
    }
};

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

export const subscribeToScheduleChanges = (
    userId: string,
    callback: (schedule: Schedule) => void
) => {
    if (isOfflineMode(userId)) {
        return { unsubscribe: () => { } };
    }

    const subscription = supabase
        .channel('scheduled_meals_changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'scheduled_meals',
                filter: `user_id=eq.${userId}`,
            },
            async () => {
                // Refetch schedule on any change
                const schedule = await getSchedule(userId);
                callback(schedule);
            }
        )
        .subscribe();

    return {
        unsubscribe: () => {
            supabase.removeChannel(subscription);
        },
    };
};

// ============================================================================
// SMART LEARNING: Build meal history summary for AI context
// ============================================================================

export interface MealLearningSummary {
    acceptedBreakfasts: string[];
    acceptedLunches: string[];
    acceptedDinners: string[];
    recentMeals: string[]; // Last 3-4 weeks for variety checking
    totalMealCount: number;
    oldestDate: string | null;
    newestDate: string | null;
}

export const getMealLearningSummary = async (
    userId: string,
    monthsBack: number = 3
): Promise<MealLearningSummary> => {
    const emptySummary: MealLearningSummary = {
        acceptedBreakfasts: [],
        acceptedLunches: [],
        acceptedDinners: [],
        recentMeals: [],
        totalMealCount: 0,
        oldestDate: null,
        newestDate: null,
    };

    if (isOfflineMode(userId)) {
        // For local mode, use localStorage schedule
        const saved = localStorage.getItem('qookcommander_schedule');
        if (!saved) return emptySummary;

        const schedule: Schedule = JSON.parse(saved);
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);

        const breakfasts: string[] = [];
        const lunches: string[] = [];
        const dinners: string[] = [];
        const allMeals: string[] = [];

        Object.entries(schedule).forEach(([dateKey, dayPlan]) => {
            const date = new Date(dateKey);
            if (date >= cutoffDate) {
                if (dayPlan.breakfast) breakfasts.push(dayPlan.breakfast);
                if (dayPlan.lunch) lunches.push(dayPlan.lunch);
                if (dayPlan.dinner) dinners.push(dayPlan.dinner);
                allMeals.push(dayPlan.breakfast, dayPlan.lunch, dayPlan.dinner);
            }
        });

        return {
            acceptedBreakfasts: [...new Set(breakfasts.filter(Boolean))],
            acceptedLunches: [...new Set(lunches.filter(Boolean))],
            acceptedDinners: [...new Set(dinners.filter(Boolean))],
            recentMeals: allMeals.filter(Boolean).slice(-21), // Last 3 weeks
            totalMealCount: allMeals.filter(Boolean).length,
            oldestDate: null,
            newestDate: null,
        };
    }

    try {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];

        // Fetch scheduled meals from last N months
        const { data: scheduledMeals, error } = await supabase
            .from('scheduled_meals')
            .select('date, breakfast, lunch, dinner')
            .eq('user_id', userId)
            .gte('date', cutoffStr)
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching learning summary:', error);
            return emptySummary;
        }

        if (!scheduledMeals || scheduledMeals.length === 0) {
            return emptySummary;
        }

        const breakfasts: string[] = [];
        const lunches: string[] = [];
        const dinners: string[] = [];
        const recentMeals: string[] = [];

        scheduledMeals.forEach((meal, index) => {
            if (meal.breakfast) {
                breakfasts.push(meal.breakfast);
                if (index < 21) recentMeals.push(meal.breakfast); // Last 3 weeks
            }
            if (meal.lunch) {
                lunches.push(meal.lunch);
                if (index < 21) recentMeals.push(meal.lunch);
            }
            if (meal.dinner) {
                dinners.push(meal.dinner);
                if (index < 21) recentMeals.push(meal.dinner);
            }
        });

        return {
            acceptedBreakfasts: [...new Set(breakfasts)],
            acceptedLunches: [...new Set(lunches)],
            acceptedDinners: [...new Set(dinners)],
            recentMeals,
            totalMealCount: breakfasts.length + lunches.length + dinners.length,
            oldestDate: scheduledMeals[scheduledMeals.length - 1]?.date || null,
            newestDate: scheduledMeals[0]?.date || null,
        };
    } catch (error) {
        console.error('Error in getMealLearningSummary:', error);
        return emptySummary;
    }
};

// ============================================================================
// GROCERY LIST HISTORY
// ============================================================================

const GROCERY_HISTORY_KEY = 'qookcommander_grocery_history';

export const saveGroceryListToHistory = async (
    items: GroceryItem[],
    dateRange: string,
    userId: string,
    customName?: string
): Promise<SavedGroceryList> => {
    // 1. Supabase Storage
    if (!isOfflineMode(userId)) {
        const { data, error } = await supabase
            .from('grocery_list_history')
            .insert({
                user_id: userId,
                name: customName || `Grocery List - ${dateRange}`,
                items: items,
                date_range: dateRange
            })
            .select()
            .single();

        if (error) {
            console.error('Error saving grocery list to Supabase:', error);
            throw error;
        }

        return {
            id: data.id,
            name: data.name,
            items: data.items,
            dateRange: data.date_range,
            createdAt: data.created_at
        };
    }

    // 2. Offline Fallback
    const newList: SavedGroceryList = {
        id: `local_${Date.now()}`,
        name: customName || `Grocery List - ${dateRange}`,
        items,
        dateRange,
        createdAt: new Date().toISOString()
    };

    const saved = localStorage.getItem(GROCERY_HISTORY_KEY);
    const history: SavedGroceryList[] = saved ? JSON.parse(saved) : [];

    // Add new list at the beginning
    history.unshift(newList);

    // Keep only last N lists
    const trimmed = history.slice(0, 10);

    localStorage.setItem(GROCERY_HISTORY_KEY, JSON.stringify(trimmed));

    return newList;
};

export const getGroceryListHistory = async (userId: string): Promise<SavedGroceryList[]> => {
    // 1. Supabase Storage
    if (!isOfflineMode(userId)) {
        const { data, error } = await supabase
            .from('grocery_list_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching grocery history:', error);
            return [];
        }

        return data.map((d: any) => ({
            id: d.id,
            name: d.name,
            items: d.items,
            dateRange: d.date_range,
            createdAt: d.created_at
        }));
    }

    // 2. Offline Fallback
    const saved = localStorage.getItem(GROCERY_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
};

export const deleteGroceryList = async (listId: string, userId: string): Promise<void> => {
    // 1. Supabase Storage
    if (!isOfflineMode(userId) && !listId.startsWith('local_')) {
        const { error } = await supabase
            .from('grocery_list_history')
            .delete()
            .eq('id', listId)
            .eq('user_id', userId);

        if (error) {
            console.error('Error deleting grocery list:', error);
            throw error;
        }
        return;
    }

    // 2. Offline Fallback
    const saved = localStorage.getItem(GROCERY_HISTORY_KEY);
    if (!saved) return;

    const history: SavedGroceryList[] = JSON.parse(saved);
    const filtered = history.filter(list => list.id !== listId);
    localStorage.setItem(GROCERY_HISTORY_KEY, JSON.stringify(filtered));
};

// ============================================================================
// FEEDBACK SYSTEM
// ============================================================================

export interface FeedbackData {
    rating: number;
    whatWorks: string;
    whatNeedsImprovement: string;
    suggestions: string;
}

export const submitFeedback = async (data: FeedbackData, userId: string = 'anon'): Promise<void> => {
    if (isOfflineMode(userId) && userId !== 'anon') {
        // Feedback requires online connection
        throw new Error("Cannot submit feedback in offline mode");
    }

    const { error } = await supabase
        .from('feedback')
        .insert({
            user_id: userId === 'anon' || userId === 'local' ? null : userId,
            rating: data.rating,
            what_works: data.whatWorks,
            what_needs_improvement: data.whatNeedsImprovement,
            suggestions: data.suggestions
        });

    if (error) {
        console.error('Error submitting feedback:', error);
        throw error;
    }
};

