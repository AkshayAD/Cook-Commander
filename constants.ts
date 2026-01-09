import { UserPreferences } from './types';

// Extracted from the provided WhatsApp chat history
export const DEFAULT_PREFERENCES: UserPreferences = {
  dietaryType: "Vegetarian (with Eggs)",
  allergies: [],
  dislikes: [
    "Carrot Matar Sabzi",
    "Beetroot Sabzi (Only allowed in Salad)",
    "Gawar (Cluster Beans)",
    "Arbi Masala (Dry)",
    "Mooli dishes (Only allowed in Salad)",
    "Repeat of same meal within 2 weeks"
  ],
  breakfastPreferences: [
    "Vegetable Sandwich with Cheese",
    "Pasta with Broccoli",
    "Idli with Sambar & Coconut/Peanut Chutney",
    "Besan Cheela with Grated Paneer",
    "Veggie Uttapam",
    "Poha (Paneer Poha)",
    "Upma (Vermicelli/Rava)",
    "Stuffed Paratha (Gobi, Palak, Methi) with Curd",
    "Dhokla",
    "Moong Dal Cheela",
    "Fruits: Cut Apple, Papaya, Guava, Pineapple, Orange"
  ],
  lunchPreferences: [
    "Staples: Plain Roti/Paratha, Rice (Jeera/Steamed)",
    "Sabzi: Aloo Gobi, Bhindi, Cabbage & Peas, Lauki Kofta, Mix Veg, Mushroom Matar",
    "Dal: Methi Toor Dal, Arhar Dal Tadka, Chana Dal, Rajma, Chole, Kadhi Pakoda",
    "Salad: Cucumber, Carrot, Beetroot, Onion, Tomato (Mandatory at lunch)",
    "Specials: Lemon Rice, Bhature (Sundays)"
  ],
  dinnerPreferences: [
    "Lighter/Special Meals",
    "Paneer: Palak Paneer, Paneer Bhurji, Shahi Paneer, Kadai Paneer (Limit Paneer frequency)",
    "Rice: Veg Pulao, Soya Pulao, Veg Biryani, Khichdi",
    "Egg: Egg Bhurji, Egg Curry, Egg Rolls",
    "Chinese: Hakka Noodles, Manchurian, Fried Rice",
    "Others: Sarson ka Saag & Makki Roti (Winter), Pav Bhaji, Wraps",
    "Sides: Raita (Boondi, Onion Tomato)"
  ],
  specialInstructions: [
    "Cook visits twice a day: Morning (Breakfast+Lunch), Evening (Dinner).",
    "Use Amul brand Paneer only.",
    "Do not repeat meals quickly.",
    "If Lunch is Chole/Rajma, Dinner should be lighter.",
    "Grocery list must be precise."
  ].join('\n'),
  pantryStaples: [
    "Salt", "Sugar", "Oil", "Spices (Haldi, Mirch, Jeera, etc.)", "Wheat Flour (Atta)", "Rice"
  ]
};