# Migrating export data to the v2 format

The v2 format (export `version: "2.0"`, see [ADR-0012](adr/0012-v2-format-clean-break.md)) renamed
all exercise ids to English slugs and removed the dead `dayVariant` field. The app performs **no
runtime migration** — convert your old JSON externally and import the result.

## Changes to apply to an old export

1. **Rename `templateId` values** in every `sessions[].exercises[]` entry (and
   `user.benchmarkLifts[].templateId` / `routines[].exercises[].templateId` if present) using the
   mapping below.
2. **Delete `dayVariant`** from every session (top-level key of each `sessions[]` entry).
3. Set the top-level `version` to `"2.0"`.
4. Everything else (sets, reps, RIR, dates, notes, `exerciseName` snapshots) stays as-is —
   `exerciseName` is a display snapshot and may keep its Spanish text.

After converting, wipe the app's localStorage (or use a fresh browser profile) and use
**Import** on the dashboard.

## Id mapping (old → new)

| Old id | New id |
|---|---|
| press-inclinado-maquina | incline-machine-press |
| press-plano | flat-machine-press |
| press-inclinado-smith | incline-smith-press |
| pec-deck | pec-deck *(unchanged)* |
| triceps-polea-vertical | cable-triceps-pushdown |
| elevaciones-laterales-banco-inclinado | incline-bench-lateral-raises |
| rear-delt-fly | rear-delt-fly *(unchanged)* |
| jalon-pecho-agarre-ancho | lat-pulldown-wide-grip |
| jalon-pecho-agarre-mag-neutro | lat-pulldown-mag-neutral |
| dominadas-agarre-prono | pronated-pull-ups |
| jalon-lat-1-mano | single-arm-lat-pulldown |
| remo-t-agarre-neutro | t-bar-row |
| curl-biceps-banco-inclinado | incline-bench-curl |
| curl-martillo | hammer-curl |
| hack-squat-maquina | machine-hack-squat |
| prensa-inclinada | incline-leg-press |
| sentadillas-lastradas-casa | weighted-squats-home |
| curl-femoral-sentado | seated-leg-curl |
| rdl-una-pierna | single-leg-rdl |
| hip-thrust | hip-thrust *(unchanged)* |
| abductor-maquina | machine-hip-abduction |
| elevacion-gemelos-maquina-pie | standing-calf-raise |
| elevacion-gemelos-sentado | seated-calf-raise |
| bulgara-smith | smith-bulgarian-split-squat |
| abs-colgado-barra | hanging-leg-raises |
| crunch-polea | cable-crunch |
| dragon-flight | dragon-flag |

## Python one-liner skeleton

```python
import json

MAPPING = {
    'press-inclinado-maquina': 'incline-machine-press',
    'press-plano': 'flat-machine-press',
    'press-inclinado-smith': 'incline-smith-press',
    'triceps-polea-vertical': 'cable-triceps-pushdown',
    'elevaciones-laterales-banco-inclinado': 'incline-bench-lateral-raises',
    'jalon-pecho-agarre-ancho': 'lat-pulldown-wide-grip',
    'jalon-pecho-agarre-mag-neutro': 'lat-pulldown-mag-neutral',
    'dominadas-agarre-prono': 'pronated-pull-ups',
    'jalon-lat-1-mano': 'single-arm-lat-pulldown',
    'remo-t-agarre-neutro': 't-bar-row',
    'curl-biceps-banco-inclinado': 'incline-bench-curl',
    'curl-martillo': 'hammer-curl',
    'hack-squat-maquina': 'machine-hack-squat',
    'prensa-inclinada': 'incline-leg-press',
    'sentadillas-lastradas-casa': 'weighted-squats-home',
    'curl-femoral-sentado': 'seated-leg-curl',
    'rdl-una-pierna': 'single-leg-rdl',
    'abductor-maquina': 'machine-hip-abduction',
    'elevacion-gemelos-maquina-pie': 'standing-calf-raise',
    'elevacion-gemelos-sentado': 'seated-calf-raise',
    'bulgara-smith': 'smith-bulgarian-split-squat',
    'abs-colgado-barra': 'hanging-leg-raises',
    'crunch-polea': 'cable-crunch',
    'dragon-flight': 'dragon-flag',
}

with open('gym_data_old.json', encoding='utf-8') as f:
    data = json.load(f)

data['version'] = '2.0'
for session in data['sessions']:
    session.pop('dayVariant', None)
    for exercise in session['exercises']:
        exercise['templateId'] = MAPPING.get(exercise['templateId'], exercise['templateId'])

with open('gym_data_v2.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
```
