# Anatole Data Schemas

## Daily log (`data/daily-logs/YYYY-MM-DD.json`)
```json
{
  "date": "YYYY-MM-DD",
  "entries": [],
  "totals": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0, "sat_fat": 0},
  "targets": {"calories": 2000, "protein": 150, "sat_fat_max": 20}
}
```

## Symptom log (`data/symptom-logs/YYYY-MM-DD.json`)
```json
{"date":"YYYY-MM-DD","entries":[]}
```

## Water log (`data/water-logs/YYYY-MM-DD.json`)
```json
{
  "date": "YYYY-MM-DD",
  "entries": [
    {"time":"09:15","type":"water","ml":500,"source":"text"}
  ],
  "total_ml": 500,
  "target_ml": null
}
```

## Product library (`data/product-library.json`)
Array of products with macros per 100g and optional serving sizes in grams.

## Saved meals (`data/saved-meals.json`)
Array of reusable meal templates. Items store macros per 100g with a default_grams per item.
```json
{
  "id": "sm_<timestamp>",
  "name": "Morning Smoothie",
  "aliases": ["usual smoothie"],
  "items": [
    {
      "product_id": "cofid-14-123-banana-raw",
      "name": "Banana",
      "per_100g": { "calories": 89, "protein": 1.1, "carbs": 22.8, "fat": 0.3, "sat_fat": 0.1 },
      "default_grams": 120,
      "source": "cofid-2021"
    }
  ],
  "default_label": "breakfast",
  "created_at": "ISO timestamp",
  "last_used": "ISO timestamp or null",
  "use_count": 0
}
```
