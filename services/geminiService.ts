import { GoogleGenAI, Type, Schema } from "@google/genai";
import { WeeklyPlan, UserPreferences, GroceryItem, MealHistoryEntry } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-3-flash-preview';

export const generateWeeklyPlan = async (preferences: UserPreferences): Promise<WeeklyPlan> => {
  const schema: Schema = {
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
    You are an expert home meal planner. Generate a 7-day meal plan (Monday to Sunday) based on the following specific preferences.
    
    CRITICAL RULES:
    1. STRICTLY follow the 'Dislikes'. Do not include them.
    2. Ensure NO MEAL is repeated within this week.
    3. Balance nutrition: Protein, Carbs, Vitamins.
    4. Lunch must always include a Salad as per preferences.
    5. Dinner should be distinct from Lunch.
    6. Provide ONLY the meal description in the JSON values. 
    7. DO NOT append "Status: Completed", "Content added:", or other conversational metadata.
    8. DO NOT append nutritional breakdowns unless explicitly asked.
    
    User Preferences:
    ${JSON.stringify(preferences, null, 2)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text) as WeeklyPlan;
  } catch (error) {
    console.error("Error generating meal plan:", error);
    throw error;
  }
};

export const regenerateSingleMeal = async (
  currentPlan: WeeklyPlan,
  dayIndex: number,
  mealType: 'breakfast' | 'lunch' | 'dinner',
  preferences: UserPreferences
): Promise<string> => {
  const dayName = currentPlan.days[dayIndex].day;
  
  const prompt = `
    The user wants to change the ${mealType} for ${dayName}.
    
    Current Plan for Context:
    ${JSON.stringify(currentPlan)}
    
    User Preferences:
    ${JSON.stringify(preferences)}
    
    Task: Suggest ONE single alternative option for ${mealType} on ${dayName}.
    It must NOT be the same as the current option.
    It must not conflict with other meals on the same day.
    Return ONLY the meal name and description as a plain string. Do not include any status updates, "Here is your meal", or metadata.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    return response.text || "No alternative found";
  } catch (error) {
    console.error("Error regenerating meal:", error);
    return "Error generating meal";
  }
};

export const smartEditMeals = async (
  currentPlan: WeeklyPlan,
  dayIndex: number,
  mealTypes: string[],
  userInstruction: string,
  preferences: UserPreferences
): Promise<Record<string, string>> => {
  const dayName = currentPlan.days[dayIndex].day;
  const currentMeals = mealTypes.reduce((acc, type) => {
    acc[type] = currentPlan.days[dayIndex][type.toLowerCase()];
    return acc;
  }, {} as Record<string, string>);

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      breakfast: { type: Type.STRING, nullable: true },
      lunch: { type: Type.STRING, nullable: true },
      dinner: { type: Type.STRING, nullable: true },
    },
  };

  const prompt = `
    You are an AI chef assistant. The user wants to edit specific meals in their weekly plan for ${dayName}.
    
    Target Meal Slots to Edit: ${mealTypes.join(', ')}
    Current Options: ${JSON.stringify(currentMeals)}
    
    User Instruction: "${userInstruction}"
    
    Weekly Plan (to avoid repetition):
    ${JSON.stringify(currentPlan)}

    Preferences:
    ${JSON.stringify(preferences)}

    Task:
    Provide NEW meal suggestions for the target slots that satisfy the User Instruction.
    
    CRITICAL JSON RULES:
    1. Return a JSON object where keys are strictly the lowercase meal types requested (e.g. "breakfast", "lunch", "dinner").
    2. IMPORTANT: Ensure EACH selected meal type has a DISTINCT, SEPARATE string value in the JSON.
    3. If the user instruction applies to all meals (e.g., 'add quantity'), apply it individually to each meal description.
    4. Do NOT merge meal descriptions. "lunch" should only contain the lunch item. "dinner" should only contain the dinner item. Do not repeat the lunch item in the dinner slot.
    5. The value must be ONLY the meal description. DO NOT include "Status: Completed", "Content added:", or any conversational text.
    6. Use Markdown formatting in the values for emphasis if needed (e.g., **Spicy** Curry).
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });
    
    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text) as Record<string, string>;
  } catch (error) {
    console.error("Smart Edit Error:", error);
    throw error;
  }
};

export const optimizePreferencesFromHistory = async (
  currentPreferences: UserPreferences,
  history: MealHistoryEntry[]
): Promise<UserPreferences> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      dietaryType: { type: Type.STRING },
      allergies: { type: Type.ARRAY, items: { type: Type.STRING } },
      dislikes: { type: Type.ARRAY, items: { type: Type.STRING } },
      breakfastPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
      lunchPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
      dinnerPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
      specialInstructions: { type: Type.STRING },
      pantryStaples: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["dietaryType", "dislikes", "breakfastPreferences", "lunchPreferences", "dinnerPreferences"],
  };

  const prompt = `
    Analyze the user's meal history and current preferences to create an IMPROVED Preference Profile.
    
    Current Preferences:
    ${JSON.stringify(currentPreferences)}
    
    Recent Meal History (Meals the user accepted/ate):
    ${JSON.stringify(history)}
    
    Task:
    1. Identify patterns in the history (what they seem to like).
    2. Refine the 'breakfastPreferences', 'lunchPreferences', and 'dinnerPreferences' lists. Add similar items to what they ate, remove items that seem contradictory if any.
    3. Keep the format structured.
    4. Do not lose critical 'allergies' or strong 'dislikes' unless the history explicitly contradicts them (e.g. they ate a disliked item).
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response");
    return JSON.parse(text) as UserPreferences;
  } catch (error) {
    console.error("Optimization Error:", error);
    throw error;
  }
};

export const generateGroceryList = async (plan: WeeklyPlan, preferences: UserPreferences): Promise<GroceryItem[]> => {
  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, description: "e.g., Vegetables, Dairy, Grains, Fruits" },
        item: { type: Type.STRING },
        quantity: { type: Type.STRING, description: "Estimated quantity e.g. 500g, 1kg, 1 bunch" },
      },
      required: ["category", "item", "quantity"],
    },
  };

  const prompt = `
    Based on the following Weekly Meal Plan, generate a consolidated grocery shopping list.
    
    Weekly Plan:
    ${JSON.stringify(plan)}
    
    Pantry Staples (DO NOT INCLUDE THESE unless quantity needed is high):
    ${JSON.stringify(preferences.pantryStaples)}
    
    Rules:
    1. Consolidate items (e.g., if Onions are needed for 5 meals, sum them up to approx 1kg or 2kg).
    2. Be specific with quantities suitable for a household of 3-4 people.
    3. Categorize logicaly.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const rawItems = JSON.parse(text);
    // Add 'checked' state locally
    return rawItems.map((i: any) => ({ ...i, checked: false }));
  } catch (error) {
    console.error("Error generating grocery list:", error);
    throw error;
  }
};

export const parsePreferencesFromText = async (textInput: string): Promise<UserPreferences> => {
   const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      dietaryType: { type: Type.STRING },
      allergies: { type: Type.ARRAY, items: { type: Type.STRING } },
      dislikes: { type: Type.ARRAY, items: { type: Type.STRING } },
      breakfastPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
      lunchPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
      dinnerPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
      specialInstructions: { type: Type.STRING },
      pantryStaples: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    // We only require fields if the AI found them, but Schema validation is strict. 
    // However, if we make them all optional in the Schema, it might return empty object.
    // It's safer to require the main structure and let AI fill empty arrays if not found.
    required: ["dietaryType", "dislikes", "breakfastPreferences", "lunchPreferences", "dinnerPreferences"],
  };

  const prompt = `
    Analyze the following unstructured text (which may be chat history, notes, or a list) and extract structured cooking preferences.
    
    Input Text:
    "${textInput}"
    
    Task:
    Extract specific meal likes, dislikes, allergies, and general rules.
    If a category is not mentioned in the text, return an empty string or empty array for that field.
    Do not hallucinate preferences not present in the text.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });
    
    const text = response.text;
    if(!text) throw new Error("Failed to parse");
    return JSON.parse(text) as UserPreferences;

  } catch (error) {
    console.error("Error parsing preferences:", error);
    throw error;
  }
}