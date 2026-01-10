export type MealType = 'Breakfast' | 'Lunch' | 'Dinner';

export interface DayPlan {
  day: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  [key: string]: string; // Index signature for dynamic access
}

export interface WeeklyPlan {
  days: DayPlan[];
}

export interface GroceryItem {
  category: string;
  item: string;
  quantity: string;
  checked: boolean;
}

export interface UserPreferences {
  dietaryType: string;
  allergies: string[];
  dislikes: string[];
  breakfastPreferences: string[];
  lunchPreferences: string[];
  dinnerPreferences: string[];
  specialInstructions: string;
  pantryStaples: string[];
  mealsToPrepare?: ('breakfast' | 'lunch' | 'dinner')[];
  nonVegPreferences?: string[];
}

export interface PreferenceProfile extends UserPreferences {
  id: string;
  name: string;
}

export interface MealHistoryEntry {
  date: string; // ISO date string YYYY-MM-DD
  mealName: string;
  type: MealType;
  rating?: 'liked' | 'disliked';
}

// Map 'YYYY-MM-DD' to DayPlan
export type Schedule = Record<string, DayPlan>;

export interface MealTransfer {
  sourceDate: string;
  sourceMealType: string;
  sourceMealName: string;
}

export interface SavedGroceryList {
  id: string;
  name: string;
  items: GroceryItem[];
  dateRange: string; // e.g., "Jan 6 - Jan 12, 2026"
  createdAt: string; // ISO timestamp
}