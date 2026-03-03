# Anatole — Diet & Health Tracking Agent for OpenClaw

Anatole is a calm, minimal health logging assistant that runs as an OpenClaw agent. It tracks food, macros, water, symptoms, and supplements via natural language — designed for low-friction daily use over Telegram (or any OpenClaw channel).

## What It Does

- **Food logging** — tell it what you ate in plain language and it logs structured macro data (calories, protein, carbs, fat, saturated fat)
- **Water tracking** — say "500ml water" or "2 glasses" and it normalises to ml
- **Symptom/wellbeing logging** — track symptoms, supplements, energy, mood, sleep with severity scores
- **Daily summaries** — ask "how's today looking?" to see totals vs targets
- **Pattern analysis** — multi-day correlation between foods and symptoms
- **Product library** — builds a personal library of verified foods with per-100g macros
- **Saved meals** — save frequently eaten meals as templates and recall them with substitutions
- **Label photo ingestion** — photograph a nutrition label to add verified product data
- **Corrections loop** — correct any macro value and it updates both the day log and product library

### Smart Product Resolution

When you mention a food, Anatole follows a strict priority hierarchy:

1. **Package label** (photo or manual) — highest confidence
2. **Your verified product library** — previously confirmed items
3. **CoFID (McCance & Widdowson)** — UK government reference data (~2,800 foods)
4. **Generic estimate** — last resort, always flagged as such

It never silently estimates when better data exists.

---

## Directory Structure

```
anatole-export/
├── README.md                          # This file
├── openclaw-agent-config.example.json # Sample agent config for openclaw.json
│
├── agent/                             # Agent-level config (goes in agents/anatole/agent/)
│   ├── AGENTS.md                      # Operating rules
│   ├── SOUL.md                        # Behaviour, tone, resolution flow
│   └── USER.md                        # Your details (edit this)
│
└── workspace/                         # Workspace (goes in workspace-anatole/)
    ├── AGENTS.md                      # Workspace operating rules
    ├── IDENTITY.md                    # Agent identity
    ├── SOUL.md                        # Detailed behaviour instructions
    ├── USER.md                        # Your details (edit this)
    ├── TOOLS.md                       # Tool notes (placeholder)
    │
    ├── scripts/
    │   └── anatole_core.js            # Core Node.js script (all data operations)
    │
    ├── skills/                        # Skill definitions
    │   ├── log-food/SKILL.md
    │   ├── log-symptom/SKILL.md
    │   ├── query-day/SKILL.md
    │   ├── query-patterns/SKILL.md
    │   ├── manage-library/SKILL.md
    │   └── saved-meals/SKILL.md
    │
    └── data/                          # Data directory (starts empty)
        ├── SCHEMAS.md                 # Data format reference
        ├── product-library.json       # Your product library (starts empty)
        ├── saved-meals.json           # Saved meal templates (starts empty)
        ├── pending-confirmations.json # Product confirmation queue
        ├── pending-labels.json        # Label parse queue
        ├── daily-logs/                # Daily food logs (YYYY-MM-DD.json)
        ├── symptom-logs/              # Symptom logs (YYYY-MM-DD.json)
        ├── water-logs/                # Water logs (YYYY-MM-DD.json)
        ├── reference/                 # Reference data (put CoFID here)
        └── labels/                    # Stored label photos
```

---

## Setup

### Prerequisites

- A running [OpenClaw](https://github.com/openclaw/openclaw) instance
- Node.js (for the core script)
- A channel binding (e.g. Telegram DM) — see OpenClaw docs

### 1. Copy files into place

```bash
# Copy the agent config directory
cp -r agent/ /path/to/your/openclaw/agents/anatole/agent/

# Copy the workspace
cp -r workspace/ /path/to/your/openclaw/workspace-anatole/
```

### 2. Edit your user details

Open these two files and fill in your name and timezone:

- `agents/anatole/agent/USER.md`
- `workspace-anatole/USER.md`

### 3. Configure your targets

The core script reads daily targets from environment variables (with sensible defaults). Set these in your shell profile or OpenClaw environment:

| Variable | Default | Description |
|---|---|---|
| `ANATOLE_TIMEZONE` | `Europe/London` | Your IANA timezone |
| `ANATOLE_CAL_TARGET` | `2000` | Daily calorie target |
| `ANATOLE_PROTEIN_TARGET` | `150` | Daily protein target (g) |
| `ANATOLE_SAT_FAT_MAX` | `20` | Daily saturated fat max (g) |

Or edit the values directly at the top of `workspace-anatole/scripts/anatole_core.js`.

### 4. Add the agent to openclaw.json

Add the agent entry from `openclaw-agent-config.example.json` to the `agents.list` array in your `openclaw.json`. Update the paths to match your installation.

### 5. (Optional) Add CoFID reference data

The UK CoFID (McCance & Widdowson's Composition of Foods) dataset gives Anatole access to ~2,800 verified food items. Place the JSON file at:

```
workspace-anatole/data/reference/cofid-products.json
```

Each entry should follow this format:

```json
{
  "id": "cofid-13-145-ackee-canned-drained",
  "name": "Ackee, canned, drained",
  "per_100g": {
    "calories": 151,
    "protein": 2.9,
    "carbs": 0.8,
    "fat": 15.2,
    "sat_fat": null
  },
  "source": "cofid-2021",
  "verification_status": "verified",
  "confidence_score": 0.95
}
```

Without this file, Anatole still works — it will just rely on your product library and estimates.

### 6. Bind a channel

Set up a Telegram (or other) channel binding in `openclaw.json` so messages route to the `anatole` agent. See the [OpenClaw docs](https://docs.openclaw.ai) for channel configuration.

### 7. Restart the gateway

```bash
openclaw gateway restart
```

---

## Usage Examples

Once set up, just message Anatole naturally:

| You say | What happens |
|---|---|
| `2 poached eggs on toast with butter` | Logs food with resolved macros, shows day totals |
| `500ml water` | Logs water, shows running total |
| `bloating, severity 6` | Logs symptom with severity score |
| `how's today looking?` | Shows day summary vs targets |
| `save this as "usual breakfast"` | Saves the last logged meal as a template |
| `usual breakfast` | Recalls and logs the saved meal |
| `usual breakfast but no butter` | Logs saved meal with substitution |
| *(send a nutrition label photo)* | Parses macros from label, asks for confirmation |
| `actually that toast was 80g not 60g` | Corrects the entry and updates product library |
| `any patterns this week?` | Analyses food/symptom correlations |

### Confirmation format

After logging food, Anatole responds with:

```
✓ Logged: Breakfast
Poached eggs (100g) — 143 kcal · 12.6g protein · 1.3g sat fat (source: CoFID)
Toast (60g) — 149 kcal · 5.3g protein · 0.3g sat fat (source: local library)
Meal total: 292 kcal · 17.9g protein · 1.6g sat fat
Day so far: 292/2000 kcal · 17.9/150g protein · 1.6/20g sat fat · Water: 500ml
```

---

## Key Design Principles

- **Never moralises food choices** — no "that's a lot of calories!" judgements
- **Estimates are always flagged** — never silently guesses when reference data exists
- **Corrections improve future accuracy** — fixing a macro updates the product library permanently
- **Local data only** — all data stays on your filesystem, nothing external
- **Minimal friction** — designed to be as fast as texting a friend what you ate

---

## Customisation

- **Tone**: Edit `workspace/SOUL.md` to change language style (currently UK English, calm and minimal)
- **Targets**: Set via environment variables or edit the top of `scripts/anatole_core.js`
- **Timezone**: Set `ANATOLE_TIMEZONE` to your IANA timezone
- **Tracked macros**: The schema tracks calories, protein, carbs, fat, and saturated fat. To add more, modify `anatole_core.js` and `SCHEMAS.md`

---

## Data Privacy

All data is stored locally in JSON files under `data/`. Nothing is sent to external services. Your food logs, symptoms, and product library stay entirely on your machine.
