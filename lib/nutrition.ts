import { ParsedMealItem } from "./types";

export function sumMealTotals(items: ParsedMealItem[]) {
  return items.reduce(
    (acc, item) => {
      acc.calories += item.calories || 0;
      acc.protein_g += item.protein_g || 0;
      acc.carbs_g += item.carbs_g || 0;
      acc.fat_g += item.fat_g || 0;
      return acc;
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
}
