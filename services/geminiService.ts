import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { WeeklyPlan, UserPreferences, GroceryItem, DayPlan, MealHistoryEntry } from "../types";
import { MealLearningSummary } from "./supabaseService";

// Types for AI Configuration
export interface AIConfig {
  apiKey: string;
  modelName: string;
}

// Validate API key by making a test request
export const validateApiKey = async (apiKey: string): Promise<boolean> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Say 'OK'",
      config: { maxOutputTokens: 10 }
    });
    return true;
  } catch (error: any) {
    console.error("API Key validation failed:", error);
    if (error?.message?.includes("API key") || error?.status === 401 || error?.status === 403) {
      throw new Error("Invalid API Key. Please check your Gemini API key in Settings.");
    }
    throw error;
  }
};

// Get current season and available vegetables based on date
const getSeasonalContext = (): { season: string; month: string; availableVegetables: string } => {
  const now = new Date();
  const month = now.toLocaleString('default', { month: 'long' });
  const monthNum = now.getMonth();

  let season: string;
  let vegetables: string;

  // Northern hemisphere seasons (adjust for India's climate)
  if (monthNum >= 2 && monthNum <= 4) {
    season = "Spring/Summer (March-May)";
    vegetables = "tomatoes, cucumbers, bottle gourd (lauki), ridge gourd (tori), bitter gourd (karela), okra (bhindi), brinjal, green beans, capsicum, watermelon, mango, muskmelon";
  } else if (monthNum >= 5 && monthNum <= 8) {
    season = "Monsoon/Rainy (June-September)";
    vegetables = "leafy greens (spinach, fenugreek), corn, mushrooms, bottle gourd, snake gourd, ivy gourd (tindora), drumstick, turmeric leaves, colocasia (arbi), yam";
  } else if (monthNum >= 9 && monthNum <= 10) {
    season = "Autumn/Post-Monsoon (October-November)";
    vegetables = "carrots, beetroot, radish, cauliflower, cabbage, peas, beans, broccoli, sweet potato, turnip, pumpkin";
  } else {
    season = "Winter (December-February)";
    vegetables = "cauliflower, cabbage, peas, carrots, radish (mooli), spinach (palak), mustard greens (sarson), fenugreek (methi), green garlic, broccoli, turnip, beetroot, parsnip";
  }

  return { season, month, availableVegetables: vegetables };
};

export const generateWeeklyPlan = async (
  preferences: UserPreferences,
  config: AIConfig,
  learningSummary?: MealLearningSummary
): Promise<WeeklyPlan> => {
  if (!config.apiKey) {
    throw new Error("API Key is missing. Please configure it in Settings.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    const { season, month, availableVegetables } = getSeasonalContext();

    const schema = {
      type: Type.OBJECT,
      properties: {
        days: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              day: { type: Type.STRING },
              breakfast: { type: Type.STRING },
              lunch: { type: Type.STRING },
              dinner: { type: Type.STRING },
            },
            required: ["day", "breakfast", "lunch", "dinner"],
          },
        },
      },
      required: ["days"],
    };

    // Build learning context section if we have history
    let learningContext = '';
    if (learningSummary && learningSummary.totalMealCount > 0) {
      learningContext = `
    
    ## LEARNED FROM YOUR HISTORY (${learningSummary.totalMealCount} meals from last 3 months)
    The user has accepted and enjoyed these types of meals before. Use this to understand their taste:
    
    Breakfast patterns they like: ${learningSummary.acceptedBreakfasts.slice(0, 12).join(', ') || 'Not enough data'}
    Lunch patterns they like: ${learningSummary.acceptedLunches.slice(0, 12).join(', ') || 'Not enough data'}
    Dinner patterns they like: ${learningSummary.acceptedDinners.slice(0, 12).join(', ') || 'Not enough data'}
    
    ## VARIETY REQUIREMENT - DO NOT REPEAT THESE RECENT MEALS:
    ${learningSummary.recentMeals.length > 0 ? learningSummary.recentMeals.join(', ') : 'No recent meals to avoid'}
    
    INSTRUCTIONS FOR LEARNING:
    - Generate NEW meals that match the STYLE and COMPLEXITY of accepted meals
    - DO NOT repeat any meals from the "recent meals" list
    - Use similar cuisines and ingredients as the patterns above
    - Introduce subtle variety while respecting learned preferences
      `;
    }

    // Check if Hindi output is requested
    const isHindi = preferences.language === 'Hindi';

    // Build language instruction based on preference
    const languageInstruction = isHindi ? `
    LANGUAGE REQUIREMENT:
    - Output ALL meal names in HINDI DEVANAGARI script (हिंदी में)
    - Day names MUST be in Hindi: सोमवार, मंगलवार, बुधवार, गुरुवार, शुक्रवार, शनिवार, रविवार
    - Example meal names: "पोहा", "दाल चावल", "पनीर टिक्का मसाला", "रोटी सब्जी"
    - Keep meal names SHORT (2-4 words in Hindi)
    ` : `
    LANGUAGE REQUIREMENT:
    - Output meal names in English
    - Day names: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
    `;

    const prompt = `
    You are a professional meal planner. Generate a weekly meal plan (7 days: ${isHindi ? 'सोमवार to रविवार' : 'Monday to Sunday'}) based on these preferences:
    
    Dietary Type: ${preferences.dietaryType}
    Allergies: ${preferences.allergies.join(", ") || "None"}
    Dislikes: ${preferences.dislikes.join(", ") || "None"}
    Breakfast Prefs: ${preferences.breakfastPreferences.join(", ") || "Any"}
    Lunch Prefs: ${preferences.lunchPreferences.join(", ") || "Any"}
    Dinner Prefs: ${preferences.dinnerPreferences.join(", ") || "Any"}
    Special Instructions: ${preferences.specialInstructions || "None"}
    Pantry Staples: ${preferences.pantryStaples.join(", ") || "Standard Indian pantry"}
    ${languageInstruction}
    SEASONAL CONTEXT:
    - Current Month: ${month}
    - Season: ${season}
    - Fresh vegetables available in market now: ${availableVegetables}
    ${learningContext}
    IMPORTANT:
    1. Prioritize seasonal vegetables that are fresh and available now.
    2. Ensure variety - don't repeat the same dish within the week.
    3. Balance nutrition across meals.
    4. Make meals practical and achievable.
    ${learningSummary && learningSummary.totalMealCount > 0 ? '5. MATCH the style of meals from user history - they know what they like!' : ''}
    
    Think step by step about what makes a balanced, seasonal meal plan.
  `;

    const response = await ai.models.generateContent({
      model: config.modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.7,
        thinkingConfig: {
          thinkingBudget: 2048
        }
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from AI. Please check your API key.");
    }
    return JSON.parse(text) as WeeklyPlan;
  } catch (error: any) {
    console.error("Error generating plan:", error);
    const errorMessage = error?.message || '';
    const errorStatus = error?.status;

    // API Key errors
    if (errorMessage.includes("API key") || errorMessage.includes("API_KEY") ||
      errorStatus === 401 || errorStatus === 403) {
      throw new Error("Invalid API Key. Please check your Gemini API key in Settings.");
    }

    // Rate limiting
    if (errorStatus === 429 || errorMessage.includes("rate") || errorMessage.includes("quota")) {
      throw new Error("Rate limit exceeded. Please wait a moment and try again.");
    }

    // Model not found
    if (errorMessage.includes("model") && errorMessage.includes("not found")) {
      throw new Error(`Model "${config.modelName}" not found. Try using "gemini-3-flash-preview" in Settings.`);
    }

    // Network errors
    if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
      throw new Error("Network error. Please check your internet connection.");
    }

    // Rethrow with the original message for other errors
    throw new Error(errorMessage || "Failed to generate meal plan. Please try again.");
  }
};

export const regenerateSingleMeal = async (
  currentPlan: WeeklyPlan,
  dayIndex: number,
  mealType: 'breakfast' | 'lunch' | 'dinner',
  preferences: UserPreferences,
  config: AIConfig
): Promise<string> => {
  if (!config.apiKey) {
    throw new Error("API Key is missing. Please configure it in Settings.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    const day = currentPlan.days[dayIndex];
    const { season, availableVegetables } = getSeasonalContext();

    // Collect all existing meals to avoid duplicates
    const existingMeals = currentPlan.days
      .flatMap(d => [d.breakfast, d.lunch, d.dinner])
      .filter(m => m && m.trim() !== '')
      .map(m => m.trim());
    const uniqueExistingMeals = [...new Set(existingMeals)].join(", ");

    const prompt = `
    Regenerate the ${mealType} for Day ${dayIndex + 1}.
    Current Plan for this day:
    Breakfast: ${day.breakfast}
    Lunch: ${day.lunch}
    Dinner: ${day.dinner}
    
    The user wants to CHANGE the ${mealType} only.
    Preferences:
    Dietary: ${preferences.dietaryType}
    Allergies: ${preferences.allergies.join(", ")}
    Dislikes: ${preferences.dislikes.join(", ")}
    
    Current Season: ${season}
    Available Vegetables: ${availableVegetables}
    
    IMPORTANT: Do NOT suggest any of these already planned meals (avoid duplicates):
    ${uniqueExistingMeals}
    
    Output ONLY the name/description of the new meal as a plain string. Make it completely different from all existing options.
  `;

    // Use fast model with minimal thinking for fast single meal regeneration
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.9,  // Higher temperature for more variety
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
      }
    });

    return response.text?.trim() || "Error generating meal";
  } catch (error: any) {
    console.error("Error regenerating meal:", error);
    if (error?.message?.includes("API key") || error?.status === 401) {
      throw new Error("Invalid API Key. Please check your settings.");
    }
    throw error;
  }
};

export const smartEditMeals = async (
  currentPlan: WeeklyPlan,
  dayIndex: number,
  mealTypes: string[],
  instruction: string,
  preferences: UserPreferences,
  config: AIConfig
): Promise<Record<string, string>> => {
  if (!config.apiKey) {
    throw new Error("API Key is missing. Please configure it in Settings.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    const day = currentPlan.days[dayIndex];

    const schema = {
      type: Type.OBJECT,
      properties: {
        breakfast: { type: Type.STRING, nullable: true },
        lunch: { type: Type.STRING, nullable: true },
        dinner: { type: Type.STRING, nullable: true },
      }
    };

    const prompt = `
    Edit the meal plan for Day ${dayIndex + 1} based on this instruction: "${instruction}"
    
    Target Meals: ${mealTypes.join(", ")}
    
    Current Meals:
    Breakfast: ${day.breakfast}
    Lunch: ${day.lunch}
    Dinner: ${day.dinner}
    
    User Preferences context: ${preferences.dietaryType}, avoid ${preferences.dislikes.join(", ")}.
    
    Return a JSON object with keys for only the meals that changed.
    Example: { "lunch": "New Lunch Name" }
  `;

    // Use fast model with minimal thinking for faster responses
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.5,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }  // Minimal thinking for speed
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    console.error("Smart Edit Error:", error);
    if (error?.message?.includes("API key") || error?.status === 401) {
      throw new Error("Invalid API Key. Please check your settings.");
    }
    return {};
  }
};

export const generateGroceryList = async (plan: WeeklyPlan, preferences: UserPreferences, config: AIConfig): Promise<GroceryItem[]> => {
  if (!config.apiKey) {
    throw new Error("API Key is missing. Please configure it in Settings.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    const { season, availableVegetables } = getSeasonalContext();

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          amount: { type: Type.STRING },
          category: { type: Type.STRING },
          checked: { type: Type.BOOLEAN },
        },
        required: ["name", "category", "amount", "checked"],
      },
    };

    const prompt = `
    Generate a consolidated grocery list for this weekly meal plan.
    Combine items where possible and organize by category.
    
    Plan:
    ${JSON.stringify(plan.days)}
    
    Pantry Staples (Assume user has these, DO NOT include unless specified otherwise):
    ${preferences.pantryStaples.join(", ")}
    
    Current Season: ${season}
    Seasonal vegetables available: ${availableVegetables}
    
    Categories to use: Vegetables, Fruits, Dairy, Proteins, Grains, Spices, Others
    
    Return JSON array of items with realistic quantities.
  `;

    const response = await ai.models.generateContent({
      model: config.modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.3,
        thinkingConfig: { thinkingBudget: 1024 }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error: any) {
    console.error("Grocery Gen Error:", error);
    if (error?.message?.includes("API key") || error?.status === 401) {
      throw new Error("Invalid API Key. Please check your settings.");
    }
    throw error;
  }
};

// Generate grocery list from a specific week in the schedule (for calendar view)
export const generateGroceryListFromSchedule = async (
  meals: { date: string; breakfast: string; lunch: string; dinner: string }[],
  preferences: UserPreferences,
  config: AIConfig
): Promise<GroceryItem[]> => {
  if (!config.apiKey) {
    throw new Error("API Key is missing. Please configure it in Settings.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    const { season, availableVegetables } = getSeasonalContext();

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          item: { type: Type.STRING, description: "Name of the grocery item" },
          quantity: { type: Type.STRING, description: "Amount needed" },
          category: { type: Type.STRING, description: "Category: Vegetables, Fruits, Dairy, Proteins, Grains, Spices, or Others" },
          checked: { type: Type.BOOLEAN, description: "Always false" },
        },
        required: ["item", "category", "quantity", "checked"],
      },
    };


    const mealsList = meals.map(m =>
      `${m.date}: Breakfast: ${m.breakfast || 'None'}, Lunch: ${m.lunch || 'None'}, Dinner: ${m.dinner || 'None'}`
    ).join('\n');

    const prompt = `
    Generate a consolidated grocery list for these scheduled meals.
    Combine items where possible and organize by category.
    
    Scheduled Meals:
    ${mealsList}
    
    Pantry Staples (Assume user has these, DO NOT include):
    ${preferences.pantryStaples.join(", ")}
    
    Current Season: ${season}
    Seasonal vegetables available: ${availableVegetables}
    
    Categories to use: Vegetables, Fruits, Dairy, Proteins, Grains, Spices, Others
    
    Return JSON array of items with realistic quantities.
  `;

    // Use fast model for grocery list generation
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.3,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error: any) {
    console.error("Grocery Gen from Schedule Error:", error);
    if (error?.message?.includes("API key") || error?.status === 401) {
      throw new Error("Invalid API Key. Please check your settings.");
    }
    throw error;
  }
};

export const parsePreferencesFromText = async (text: string, config: AIConfig): Promise<Partial<UserPreferences>> => {
  if (!config.apiKey) {
    throw new Error("API Key is missing. Please configure it in Settings.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    const { season, month, availableVegetables } = getSeasonalContext();

    const schema = {
      type: Type.OBJECT,
      properties: {
        dietaryType: { type: Type.STRING },
        allergies: { type: Type.ARRAY, items: { type: Type.STRING } },
        dislikes: { type: Type.ARRAY, items: { type: Type.STRING } },
        breakfastPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
        lunchPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
        dinnerPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
        specialInstructions: { type: Type.STRING },
        pantryStaples: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    };

    const prompt = `
    You are an expert meal planning assistant. Analyze the user's input and extract detailed culinary preferences.
    
    User Input: "${text}"
    
    CONTEXT:
    - Current Month: ${month}
    - Season: ${season}
    - Seasonal vegetables available now: ${availableVegetables}
    
    TASK:
    1. Extract ALL preferences mentioned or implied in the text.
    2. For meal preferences (breakfast, lunch, dinner), suggest specific dish ideas based on:
       - What the user mentioned
       - Seasonal ingredients available now
       - Common complementary dishes
    3. If the user mentions general preferences (e.g., "healthy", "quick meals"), translate these into specific dish suggestions for EACH meal category.
    4. Add relevant pantry staples based on the cuisine/dietary preferences mentioned.
    5. Include any special dietary instructions or cooking preferences.
    
    Think carefully about:
    - What type of cuisine does the user prefer?
    - What seasonal dishes would complement their preferences?
    - What specific breakfast, lunch, and dinner options would they enjoy?
    
    Return comprehensive preferences that will help generate a great meal plan.
  `;

    const response = await ai.models.generateContent({
      model: config.modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.2,  // Low temperature for consistent, focused extraction
        thinkingConfig: { thinkingBudget: 2048 }  // Use thinking tokens for better analysis
      }
    });

    const result = JSON.parse(response.text || "{}");
    return result;
  } catch (error: any) {
    console.error("Parse preferences error:", error);
    if (error?.message?.includes("API key") || error?.status === 401) {
      throw new Error("Invalid API Key. Please check your settings.");
    }
    throw error;
  }
};

export const optimizePreferencesFromHistory = async (
  currentPrefs: UserPreferences,
  history: MealHistoryEntry[],
  config: AIConfig
): Promise<UserPreferences> => {
  if (!config.apiKey) {
    throw new Error("API Key is missing. Please configure it in Settings.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });

    // Filter for rated meals
    const liked = history.filter(h => h.rating === 'liked').map(h => h.mealName);
    const disliked = history.filter(h => h.rating === 'disliked').map(h => h.mealName);

    if (liked.length === 0 && disliked.length === 0) return currentPrefs;

    const schema = {
      type: Type.OBJECT,
      properties: {
        dietaryType: { type: Type.STRING },
        allergies: { type: Type.ARRAY, items: { type: Type.STRING } },
        dislikes: { type: Type.ARRAY, items: { type: Type.STRING } },
        breakfastPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
        lunchPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
        dinnerPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
        specialInstructions: { type: Type.STRING },
        pantryStaples: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["dietaryType", "allergies", "dislikes", "breakfastPreferences", "lunchPreferences", "dinnerPreferences", "specialInstructions", "pantryStaples"]
    };

    const prompt = `
        Analyze the user's feedback to OPTIMIZE their preferences.
        
        Current Preferences: ${JSON.stringify(currentPrefs)}
        
        New Feedback:
        Liked Meals: ${liked.join(", ")}
        Disliked Meals: ${disliked.join(", ")}
        
        Task:
        1. Add traits of liked meals to preferences (e.g. if they liked "Spicy Tacos", maybe add "Mexican" or "Spicy" to prefs).
        2. Add traits of disliked meals to 'Dislikes' list.
        3. Refine dietary type if needed.
        
        Return the complete updated preference profile JSON.
     `;

    const response = await ai.models.generateContent({
      model: config.modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.3,
        thinkingConfig: { thinkingBudget: 1024 }
      }
    });
    return JSON.parse(response.text || JSON.stringify(currentPrefs));
  } catch (error: any) {
    console.error("Optimize preferences error:", error);
    if (error?.message?.includes("API key") || error?.status === 401) {
      throw new Error("Invalid API Key. Please check your settings.");
    }
    return currentPrefs;
  }
};

// Learning Suggestions Interface
export interface LearningSuggestions {
  summary: string;
  likedPatterns: string[];
  dislikedPatterns: string[];
  suggestedAdditions: {
    breakfastPreferences: string[];
    lunchPreferences: string[];
    dinnerPreferences: string[];
    dislikes: string[];
  };
  totalMealsAnalyzed: number;
}

export const getLearningSuggestions = async (
  currentPrefs: UserPreferences,
  history: MealHistoryEntry[],
  config: AIConfig
): Promise<LearningSuggestions> => {
  if (!config.apiKey) {
    throw new Error("API Key is missing. Please configure it in Settings.");
  }

  const liked = history.filter(h => h.rating === 'liked').map(h => h.mealName);
  const disliked = history.filter(h => h.rating === 'disliked').map(h => h.mealName);

  if (liked.length === 0 && disliked.length === 0) {
    return {
      summary: "No rated meals found. Start rating your meals to get personalized suggestions!",
      likedPatterns: [],
      dislikedPatterns: [],
      suggestedAdditions: { breakfastPreferences: [], lunchPreferences: [], dinnerPreferences: [], dislikes: [] },
      totalMealsAnalyzed: 0
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });

    const schema = {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        likedPatterns: { type: Type.ARRAY, items: { type: Type.STRING } },
        dislikedPatterns: { type: Type.ARRAY, items: { type: Type.STRING } },
        suggestedAdditions: {
          type: Type.OBJECT,
          properties: {
            breakfastPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
            lunchPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
            dinnerPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
            dislikes: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["breakfastPreferences", "lunchPreferences", "dinnerPreferences", "dislikes"]
        }
      },
      required: ["summary", "likedPatterns", "dislikedPatterns", "suggestedAdditions"]
    };

    const prompt = `
        Analyze this user's meal history feedback and provide learning suggestions.
        
        Liked Meals: ${liked.join(", ")}
        Disliked Meals: ${disliked.join(", ")}
        
        Current Preferences: ${JSON.stringify(currentPrefs)}
        
        Task:
        1. Identify patterns in liked meals (e.g., "South Indian", "Spicy", "Light", "Protein-rich")
        2. Identify patterns in disliked meals (e.g., "Too heavy", "Bland", specific ingredients)
        3. Suggest NEW items to add to preferences (don't repeat what's already there)
        4. Write a friendly 1-2 sentence summary of what you learned
        
        Be concise but insightful. Focus on actionable patterns, not just listing the meals.
     `;

    const response = await ai.models.generateContent({
      model: config.modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.4,
        thinkingConfig: { thinkingBudget: 1024 }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      ...result,
      totalMealsAnalyzed: liked.length + disliked.length
    };
  } catch (error: any) {
    console.error("Get learning suggestions error:", error);
    throw error;
  }
};

// Translate content to Hindi using AI
export interface TranslatedMealPlan {
  days: {
    day: string;
    breakfast: string;
    lunch: string;
    dinner: string;
  }[];
}

export interface TranslatedGroceryItem {
  item: string;
  quantity: string;
  category: string;
  checked: boolean;
}

export const translateMealPlanToHindi = async (
  plan: { days: { day: string; breakfast: string; lunch: string; dinner: string }[] },
  config: AIConfig
): Promise<TranslatedMealPlan> => {
  if (!config.apiKey) {
    throw new Error("API Key is missing for translation.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });

    const schema = {
      type: Type.OBJECT,
      properties: {
        days: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              day: { type: Type.STRING },
              breakfast: { type: Type.STRING },
              lunch: { type: Type.STRING },
              dinner: { type: Type.STRING },
            },
            required: ["day", "breakfast", "lunch", "dinner"],
          },
        },
      },
      required: ["days"],
    };

    const prompt = `
    Translate this meal plan to Hindi (Devanagari script) for display on a shareable menu card.
    
    CRITICAL: The JSON structure must use ENGLISH keys (day, breakfast, lunch, dinner) but the VALUES must be in HINDI DEVANAGARI SCRIPT.
    
    FORMATTING RULES:
    1. Keep meal names SHORT and CONCISE (max 3-4 words in Hindi Devanagari)
    2. Use authentic Hindi names: "Poha" → "पोहा", "Dal Tadka" → "दाल तड़का"
    3. Drop extras like "with..." - keep only main dish names
    4. Example JSON output format:
       {
         "days": [
           { "day": "सोमवार", "breakfast": "पोहा", "lunch": "दाल चावल", "dinner": "रोटी सब्जी" }
         ]
       }
    
    Day translations: Monday → सोमवार, Tuesday → मंगलवार, Wednesday → बुधवार, 
    Thursday → गुरुवार, Friday → शुक्रवार, Saturday → शनिवार, Sunday → रविवार
    
    Meal Plan to translate:
    ${JSON.stringify(plan.days)}
    
    Return JSON with SHORT Hindi Devanagari meal names that fit in a menu card.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.3,
        thinkingConfig: { thinkingBudget: 512 }
      }
    });

    return JSON.parse(response.text || JSON.stringify(plan));
  } catch (error: any) {
    console.error("Translation error:", error);
    // Return original plan if translation fails
    return plan as TranslatedMealPlan;
  }
};

export const translateGroceryListToHindi = async (
  items: { item: string; quantity: string; category: string; checked: boolean }[],
  config: AIConfig
): Promise<TranslatedGroceryItem[]> => {
  if (!config.apiKey) {
    throw new Error("API Key is missing for translation.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          item: { type: Type.STRING },
          quantity: { type: Type.STRING },
          category: { type: Type.STRING },
          checked: { type: Type.BOOLEAN },
        },
        required: ["item", "quantity", "category", "checked"],
      },
    };

    const prompt = `
    Translate this grocery list to Hindi (Devanagari script) for display.
    
    CRITICAL: Use ENGLISH keys (item, quantity, category, checked) but VALUES in HINDI DEVANAGARI SCRIPT.
    
    Translations:
    - Items: "Tomatoes" → "टमाटर", "Onions" → "प्याज", "Rice" → "चावल"
    - Categories: Vegetables → सब्जियां, Fruits → फल, Dairy → डेयरी, Proteins → प्रोटीन, Grains → अनाज, Spices → मसाले, Others → अन्य
    - Quantities: "500g" → "500 ग्राम", "1 kg" → "1 किलो", "2 pieces" → "2 टुकड़े"
    
    Example output:
    [{ "item": "टमाटर", "quantity": "500 ग्राम", "category": "सब्जियां", "checked": false }]
    
    Grocery List to translate:
    ${JSON.stringify(items)}
    
    Return JSON array with Hindi Devanagari values.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.3,
        thinkingConfig: { thinkingBudget: 512 }
      }
    });

    return JSON.parse(response.text || JSON.stringify(items));
  } catch (error: any) {
    console.error("Translation error:", error);
    // Return original items if translation fails
    return items;
  }
};
