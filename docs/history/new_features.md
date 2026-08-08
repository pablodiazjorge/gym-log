> **Historical note** — the design property described here ("the export JSON is intentionally
> flat and pandas-friendly") is now documented in [architecture.md](../../architecture.md)
> (Data model section). The snippet is kept as a starting point for future external analysis.

## 🔬 Python analysis (for the future)

The export format is designed for **pandas**. A quick analysis script:

```python
import pandas as pd
import json

with open('gym_tracker_sample_data.json') as f:
    data = json.load(f)

# Flatten to a DataFrame: one row per set
rows = []
for session in data['sessions']:
    for ex in session['exercises']:
        for s in ex['sets']:
            rows.append({
                'date': session['date'],
                'dayType': session['dayType'],
                'exercise': ex['exerciseName'],
                'templateId': ex['templateId'],
                'isWarmup': s['isWarmup'],
                'weightKg': s['weightKg'],
                'reps': s['reps'],
                'rir': s['rir'],
                'volume': s['weightKg'] * s['reps']  # set volume
            })

df = pd.DataFrame(rows)

# Max-weight progression on the incline press (work sets only)
press = df[(df['templateId'] == 'press-inclinado-maquina') & (~df['isWarmup'])]
max_weight = press.groupby('date')['weightKg'].max()
print(max_weight)

# Total volume per session
volume_per_session = df[~df['isWarmup']].groupby('date')['volume'].sum()
print(volume_per_session)
```

This gives max-weight progression, weekly volume, average-RIR evolution, and similar charts.
