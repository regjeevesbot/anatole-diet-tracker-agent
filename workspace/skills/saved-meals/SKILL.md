# saved-meals

Save, recall, and log frequently eaten meal templates.

## Steps
1. Save a meal from a logged entry or items array with `save-meal`.
2. Recall by name/alias with `get-meal` (fuzzy match).
3. Log to the day with `log-saved-meal` (calculates macros from per_100g * grams).
4. For substitutions: retrieve template, swap items via `resolve-product`, log via `add-food`.

## Commands
- `save-meal` — create template from day log entry or raw items JSON
- `get-meal` — retrieve by name/alias (fuzzy match)
- `list-meals` — list all saved meals with usage stats
- `delete-meal` — remove a saved meal (requires user confirmation)
- `log-saved-meal` — log a saved meal to the day

## Constraints
- Macros stored per 100g with default_grams per item.
- Substitutions handled at agent level, not script level.
- Data file: `data/saved-meals.json`.
