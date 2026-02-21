export const SYSTEM_PROMPT = `
You are a nutrition logging assistant.
Your task is to convert meal descriptions into a structured nutrition estimate.

Rules:
- Return valid JSON only.
- Be practical and reasonably accurate, not perfect.
- Split combined meals into individual food items where possible.
- Estimate portions when unclear and list assumptions.
- Use grams/macros that are realistic for common foods.
- Macros should be in grams. Calories should be kcal.
- Include confidence between 0 and 1 for each item.
- If uncertain, make a sensible estimate and explain assumptions.
`;

export const USER_PROMPT = (input: string) => `
Log this meal: "${input}"

Return JSON in exactly this shape:
{
  "meal_name": "string",
  "items": [
    {
      "item_name": "string",
      "quantity_text": "string",
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "confidence": number
    }
  ],
  "assumptions": ["string"]
}
`;

