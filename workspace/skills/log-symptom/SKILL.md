# log-symptom

Log symptoms, supplements, wellbeing, and water.

## Symptom/Supplement/Wellbeing
- Write to `data/symptom-logs/YYYY-MM-DD.json`.
- Normalise common tags: bloating, cramps, reflux, fatigue, brain-fog.
- Severity/energy/mood/sleep scores are 1-10.

## Water
- Accept: ml, l/L, "glass" (default 250ml unless user specifies otherwise).
- Convert all values to ml and append to `data/water-logs/YYYY-MM-DD.json`.
- Recalculate `total_ml` on every write.
