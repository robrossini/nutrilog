import { z } from "zod";

export const ParsedMealSchema = z.object({
  meal_name: z.string().optional().default("Meal"),
  items: z
    .array(
      z.object({
        item_name: z.string(),
        quantity_text: z.string(),
        calories: z.number().nonnegative(),
        protein_g: z.number().nonnegative(),
        carbs_g: z.number().nonnegative(),
        fat_g: z.number().nonnegative(),
        confidence: z.number().min(0).max(1).optional(),
      })
    )
    .min(1),
  assumptions: z.array(z.string()).default([]),
});

export type ParsedMealSchemaType = z.infer<typeof ParsedMealSchema>;
