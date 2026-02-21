export type ParsedMealItem = {
  item_name: string;
  quantity_text: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence?: number;
};

export type ParsedMeal = {
  meal_name?: string;
  items: ParsedMealItem[];
  assumptions: string[];
};

export type Meal = {
  id: string;
  logged_at: string;
  raw_input: string;
  source: "text" | "voice";
  meal_name: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  assumptions_json: string[];
};

export type MealItem = {
  id: string;
  meal_id: string;
  item_name: string;
  quantity_text: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence?: number | null;
};
