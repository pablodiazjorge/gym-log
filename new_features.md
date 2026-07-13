## 🔬 Análisis con Python (para el futuro)

Como dices que quieres analizar los datos más tarde, este formato está pensado para **pandas**. Un script de análisis rápido sería:

```python
import pandas as pd
import json

with open('gym_tracker_sample_data.json') as f:
    data = json.load(f)

# Flatten a DataFrame: una fila por serie
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
                'volume': s['weightKg'] * s['reps']  # volumen de la serie
            })

df = pd.DataFrame(rows)

# Progresión de peso máximo en press inclinado (solo series de trabajo)
press = df[(df['templateId'] == 'press-inclinado-maquina') & (~df['isWarmup'])]
max_weight = press.groupby('date')['weightKg'].max()
print(max_weight)

# Volumen total por sesión
volume_per_session = df[~df['isWarmup']].groupby('date')['volume'].sum()
print(volume_per_session)
```

Esto te dará gráficos de progresión de peso, volumen semanal, evolución del RIR medio, etc.