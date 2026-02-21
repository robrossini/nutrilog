export type MealItem = {
  id: string;
  item_name: string;
  quantity_text: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: number | null;
};

export type BackendMeal = {
  id: string;
  logged_at: string;
  raw_input: string;
  meal_name: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  assumptions_json?: string[];
  meal_items?: MealItem[];
};

export type UIMeal = {
  id: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  timestamp: number;
  mealName?: string | null;
};
