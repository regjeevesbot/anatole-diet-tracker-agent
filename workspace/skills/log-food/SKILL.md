# log-food

Parse food input (natural language, shorthand, or image description) into structured meal entries.

## Steps
1. Detect meal label/time from text context.
2. For each item, attempt library match by name/brand.
3. If unmatched, estimate grams and macros; set `confidence: "estimated"`.
4. Write/update `data/daily-logs/YYYY-MM-DD.json`.
5. Recalculate `totals` from all entries.
6. Include water total from `data/water-logs/YYYY-MM-DD.json` in confirmation.

## Constraints
- Keep macros fields: calories, protein, carbs, fat, sat_fat.
- Do not invent certainty. Mark estimates.
