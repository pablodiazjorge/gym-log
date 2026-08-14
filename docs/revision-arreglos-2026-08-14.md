He verificado los 28 hallazgos abriendo el código, ejecutando tests reales con el Angular del repo, compilando el CSS y cruzando contra los datos reales del usuario (`docs/personal-progress/exports/gym_data_2026-08-14.json`). Resumen:

---

# Revisión jefe — arreglos post-auditoría (gym-log)

## 0. Descartes (no se sostienen o están mal atribuidos)

| Afirmación | Veredicto |
|---|---|
| «El timer escribe en una señal de un componente ya destruido» (workout.ts:356) | **Descartado.** Las señales de Angular no están ligadas al ciclo de vida del componente: `goToNext()` tras destruir sólo escribe un `signal` huérfano. Ni error, ni fuga (el timer dura 500 ms). Las otras dos variantes del mismo hallazgo sí valen. |
| «Fugas de memoria / timers sin limpiar» en general | **Descartado.** `elapsed-minutes.ts:16-17` registra `inject(DestroyRef).onDestroy(() => clearInterval(id))` y se invoca desde inicializadores de campo (`workout.ts:72`, `additional.ts:60`), así que hay contexto de inyección. El único timer sin limpiar de todo `src/` es el `setTimeout` de workout.ts:356 (grep confirmado). |
| «`persistCurrent()` guarda el objeto viejo» (workout.ts:433/436) | **Descartado en su consecuencia.** `s` y el objeto post-`update` comparten los mismos `WorkoutExercise`; el JSON escrito es idéntico. Sólo divergen las identidades. La pérdida de notas es real pero por otra razón (nadie llama a `persistCurrent` al cambiar notas). |
| «Desde el resumen no hay ninguna forma de volver a los ejercicios» | **Parcialmente descartado.** Los puntos de workout.html:65-75 se pintan **fuera** del `@if (isSummary())` y `goToExercise()` sí hace `isSummary.set(false)`. La salida existe y funciona; sólo es poco descubrible (10 px). Lo que sí es cierto y verificado es que el `isSummary.set(false)` de `onSetReopened` (workout.ts:364) es **código muerto**: `app-set-input` sólo existe dentro de `@if (!isSummary())`. Es un comentario mentiroso, no un bug. |
| «`--app-header-h: 3rem` deja una rendija de 1 px» | **Cierto pero inerte hoy.** Sólo se manifiesta *después* de arreglar que el header sea sticky de verdad. Lo anoto como parte del arreglo de R3, no como hallazgo propio. |
| «Ninguno de los ficheros de datos pierde sesiones hoy» | **Confirmado ejecutando el predicado real: 12/12 válidas en ambos ficheros.** No hay pérdida de datos actual por `isValidSession`. |

Todo lo demás sobrevive. Ordenado por impacto real para quien registra series en el móvil:

---

## 1. REGRESIONES (lo más grave: funcionaba y ya no)

### R1 — CRÍTICA · Quitar el filtro `weightKg > 0` pone a **0 kg** toda la rutina del usuario
`src/app/core/services/progression.util.ts:360`, `:373`, `:464`

**Confirmado ejecutando el motor real contra el dato real.** La sesión `ws-2026-08-12-routine-2878` (hace dos días, la última de `t-bar-row`) tiene exactamente el caso mixto: `[0×15, 10×12, 15×10, 15×9, 15×7, 15×7]`, todas `completed`, ninguna `skipped`.

```
NEW  stable  add-weight  [[0,10],[0,10],[0,10],[0,10],[0,10],[0,10]]
NEW  rising  add-weight  [[0,10],[0,10],[0,10],[0,10],[0,10],[0,10]]
NEW  falling hold        [[0,15],[0,12],[0,10],[0,9],[0,7],[0,7]]
OLD  stable  add-weight  [[12.5,8],[20,6],[20,5],[20,3],[20,3]]
OLD  falling hold        [[10,12],[15,10],[15,9],[15,7],[15,7]]
```

Cadena: `isBodyweight` (:373) sólo detecta el caso PURO → false. Pero `set1 = workSets[0]` sigue teniendo `weightKg: 0`, así que el guard de :464 (`set1.weightKg > 0 ? … : 0`) devuelve **ratio 0 para las seis series**. Encima `rangeSwitched` (:395-399) se activa (15 > 12+2) y `estimate1Rm(0, 15)` = 0, con el rationale mentiroso «load recalculated from your estimated 1RM».

**Se rompe:** mañana, al abrir la rutina que contiene t-bar-row, las 6 series salen pre-rellenadas a 0 kg, en las tres ramas de `rirTrend`. Y como esa sesión se convierte en el nuevo historial, se auto-perpetúa.

**Arreglo:** separar el rol de `set1`. Mantener `isBodyweight = every(w => w.weightKg === 0)`, pero para los ratios usar una `refWeight` = primer `workSet` con `weightKg > 0` (o el máximo) en :464 y :452, de forma que la serie a 0 kg conserve ratio 0 y las demás su proporción. Los tests nuevos (`progression.util.spec.ts:608-676`) sólo cubren el caso todo-a-cero: falta el mixto.

---

### R2 — ALTA · `skipSet` ya no pone el peso a 0 y tres consumidores no filtran `skipped`
`workout.ts:462` · `history.ts:67` · `session-detail.ts:64` y `:69`

El diff eliminó `s.weightKg = 0; s.reps = 0` de `set-input.ts` (confirmado en el diff). Ese cero era la **red de seguridad implícita** de la que dependían tres sitios que nunca filtraron `skipped`:

- `workout.ts:462` → `filter(!isWarmup && completed)` — y `skipSet()` deja `completed: true` (set-input.ts:69).
- `history.ts:67` → `if (!s.isWarmup && s.weightKg > max)` — ni `completed` ni `skipped`.
- `session-detail.ts:64` → `filter(s => !s.isWarmup)` — idem.

El docblock de `set-input.ts:63-64` («Every consumer filters on `skipped`») es **falso**. `analytics.service.ts:95` sí se arregló, los otros tres no.

**Se rompe:** saltas la serie 3 porque pesaba demasiado (el motor la pre-rellenó a 15 kg), haces las demás a 10 kg → el resumen del entreno (workout.html:96-97) y la tarjeta de History (history.html) muestran **15 kg como máximo del día**, un peso que no levantaste, y queda grabado para siempre. Analysis muestra 10 kg: dos pantallas contradiciéndose. Hoy hay 0 series saltadas con peso en el export; la primera aparecerá mañana.

**Arreglo:** `&& !st.skipped` en workout.ts:462; `&& s.completed && !s.skipped` en history.ts:67 y session-detail.ts:64/69. Lo correcto es extraer `isCountableWorkSet(set)` a `shared/` y usarlo también en analytics.service.ts:95, progression.util.ts:360, progression.service.ts y profile.service.ts, para que no vuelvan a divergir.

---

### R3 — ALTA · El sub-header de /workout y /additional queda flotando a 48 px porque el header global **no es sticky**
`workout.html:166` · `additional.html:93` (antes `sticky top-0 z-10`)

`<app-header/>` (app.html:2) es un flex item sin `:host{display:…}` (header.css sólo tiene un comentario), así que su caja mide exactamente lo que su hijo `<header class="sticky top-0 z-50">` (h-12 + border-b = 49 px). Un sticky con recorrido 0 px dentro de su bloque contenedor **se comporta como static**. El header global se va con el scroll; el sub-header se queda anclado a `top: 3rem` sobre una franja transparente de 48 px por la que se ve desfilar la lista de series.

**Se rompe:** la pantalla principal de la app, en cada scroll, en cada entreno. Antes no pasaba.

**Arreglo:** en `header.css`, `:host { display: block; position: sticky; top: 0; z-index: 50; }`. Y entonces sí, `--app-header-h: calc(3rem + 1px)` en styles.css:5 para el borde.

---

### R4 — ALTA · Reanudar al día siguiente graba una duración absurda y la persiste
`workout.ts:311-312`

`const startedAt = new Date(existing.date).getTime(); if (!Number.isNaN(startedAt)) this.startTime.set(startedAt)`. `gym_current_session` no caduca nunca. Sesión abandonada el lunes, reanudada el viernes → `minutesSince()` (elapsed-minutes.ts:25) devuelve ~5760, que es lo que se pinta en el pie (workout.html:245), en el resumen (workout.html:88) y **lo que se escribe en `s.durationMinutes` (workout.ts:444)**, irreversible en el histórico.

Antes el reloj se reiniciaba (infravaloraba). Ahora puede disparar a 4 dígitos. El arreglo cambió un número malo por otro peor y persistente.

**Arreglo:** acotar en :311 — `const MAX = 4*3600_000; this.startTime.set(Number.isNaN(startedAt) || startedAt > Date.now() || Date.now()-startedAt > MAX ? Date.now() : startedAt);`.

---

### R5 — ALTA/MEDIA · El filtro de calentamientos añadió `completed`, no sólo `!skipped`
`progression.util.ts:451`

BUG-17 pedía `!s.skipped`; se añadió también `s.completed`. **Verificado ejecutando:** con un calentamiento `completed: false` en el historial, `warmupTargets` sale vacío y los targets pierden por completo la fila de calentamiento.

Consecuencia en la app: en modo rutina `buildSetsForExercise` crea el hueco pero `lastWarmupTarget` es `undefined` → `fallbackWeight = 0` (progression.util.ts:611-613) → calentamientos a **0 kg** que hay que teclear cada sesión (verificado: `[[1,true,0,8],[2,true,0,8],[3,false,60,10],…]`). En modo día con `hasWarmupSets:false` desaparecen. Y la sesión resultante es el nuevo historial → se auto-perpetúa, que es exactamente el modo de fallo que el docblock de :580-584 dice haber cerrado.

Nada en la UI obliga a marcar los calentamientos: `finishWorkout()` (workout.ts:439) no exige `allCompleted()`. Hoy no se manifiesta (0 calentamientos sin completar en el export), pero el cambio estrecha el comportamiento sin necesidad.

**Arreglo:** volver a `s.isWarmup && !s.skipped`, o como mínimo `s.completed || s.weightKg > 0`.

---

### R6 + R7 — MEDIA · La fila clicable + el auto-avance de 500 ms sin cancelar
`set-input.html:3` (`<button>` de ancho completo → `reopenSet()`) · `workout.ts:356`

`setTimeout(() => this.goToNext(), 500)` no se captura ni se cancela en `goToExercise` (:335), `goToNext`, `goToPrevious`, `onSetReopened` (:361), `goToSummary`, `finishWorkout` ni `discardWorkout` (grep confirmado: es el único `setTimeout` sin `clearTimeout` de todo `src/app`).

Al hacer clicable **toda la fila** aparece una combinación nueva y probable: completas la última serie del ejercicio, ves un número mal, tocas la fila para reabrirla → `onSetReopened` la abre en edición → 500 ms después el timer te lanza al ejercicio siguiente, con una serie a medias.

Y `reopenSet()` (set-input.ts:75-81) pone `completed = false` **y** `skipped = false` sin preguntar. Si la serie no se re-completa, `finishWorkout()` guarda sin avisar y AnalyticsService (:95), ProgressionService y ProfileService la descartan: una serie realmente ejecutada desaparece del volumen y del motor. **No es teórico: el export real ya tiene 11 series de trabajo con `completed: false`** (`ws-2026-07-30-legs-9146`, cuatro ejercicios enteros), y esas cuatro entradas hoy devuelven `basis: 'no-history'` en el motor. El gesto nuevo hace ese error mucho más fácil.

**Arreglo:** (a) `private advanceTimer` + `cancelAdvance()` llamado al inicio de las siete transiciones, y guarda de índice (`const from = this.currentExerciseIndex(); … if (this.currentExerciseIndex() === from) this.goToNext();`). (b) restringir el disparador de reapertura al icono de lápiz de set-input.html:61-63 en vez de a toda la fila. (c) en `finishWorkout()`, si `!this.allCompleted()`, avisar con el número de series sin completar antes de persistir.

---

### R8 — MEDIA · `viewport-fit=cover` activó los safe-area insets y nadie ajustó los colchones
`src/index.html:10` · `workout.html:234`

La nav (app.html:10) tiene `padding-bottom: env(safe-area-inset-bottom, 0px)`, que antes resolvía a 0 y ahora es real (~34 px en iOS con notch, en standalone). El pie de workout es `sticky bottom-0 pb-16` (exactamente 4rem = la nav sin inset), así que el botón «Discard session» queda cortado por la nav. Los `pb-24` de las páginas pasan de 2rem de holgura a `2rem − inset`.

**Arreglo:** `--app-nav-h: calc(4rem + env(safe-area-inset-bottom, 0px))` en styles.css:7 (hoy es `4rem` pelado y el comentario dice que incluye el safe area: **miente**) y usarla en workout.html:234 y en los `pb-24`. Añadir `padding-top: env(safe-area-inset-top)` al header.

---

## 2. Bugs de la auditoría dados por arreglados que siguen vivos

### V1 — ALTA · `isValidSession` no valida el contenido de `sets`: el crash de Analysis sigue ahí
`storage.service.ts:19-21` — **verificado ejecutando el predicado real:**
```
isValidSession({… exercises:[{templateId:'pec-deck', sets:[null]}]}) = true
```
La validación se detiene en `Array.isArray(ex.sets)`. Con `sets: [null]`, `AnalyticsService.getExerciseMetrics()` lanza `TypeError: Cannot read properties of null (reading 'isWarmup')` en analytics.service.ts:95 — literalmente el fallo que el docblock de :7-12 dice prevenir. `history.ts:67` y `session-detail.ts:64` revientan igual. Con `sets:[{completed:true}]` no revienta pero produce `NaN` que analysis.html interpola tal cual. Tampoco se valida `dayType` (analytics.service.ts:480 crea una clave nueva a NaN en silencio).

**Además** (verificado): un solo ejercicio roto invalida la sesión ENTERA (`s.exercises.every`, :19) — se pierde también el bench-press perfecto de al lado. Y `persistSessions()` (:96) reescribe `this.sessions()` en el siguiente guardado, **haciendo la pérdida irreversible y silenciosa**, mientras que la ruta de import sí informa (`skippedSessions`, dashboard.ts:121-125). Hoy no hay pérdida (12/12 válidas), pero el modo de fallo elegido es destructivo.

**Arreglo:** extender el predicado a las series (`weightKg`/`reps`/`rir` finitos), filtrar **por ejercicio** en vez de por sesión, y volcar el original a `gym_sessions_backup_<ts>` si `parsed.length !== filtered.length`.

### V2 — ALTA · `loadCurrentSession()` quedó sin validar
`storage.service.ts:106-107` — sigue siendo `const parsed: WorkoutSession = JSON.parse(raw)`, un cast sin comprobación. Con `exercises` ausente, `loadExistingSession()` explota en `existing.exercises.findIndex(...)` (workout.ts:319) y deja /workout en blanco; y **el guard nuevo lo empeora**: `guardUnfinishedSession()` (workout.ts:178-179) lee ese objeto basura como «sesión sin terminar» y bloquea con un `confirm` el inicio de CUALQUIER entreno. La salida es el Discard del banner (dashboard.ts:90-92), que existe, pero el estado sobrevive a la recarga.

**Arreglo:** `this.currentSession.set(isValidSession(parsed) ? parsed : null)` + `localStorage.removeItem` si no valida, simétrico a `loadSessions`.

### V3 — ALTA · `guardUnfinishedSession()` borra antes de crear
`workout.ts:153` + `:186` — En el camino de rutina está bien (`createSessionFromRoutine` crea a continuación). En el camino de **día con grupos de elección** (:159-165) sólo se pintan los `choiceGroups`; la sesión nueva no nace hasta `confirmSelection()` (:200-218). Entre medias hay tres salidas: «Back» (workout.html:55), la nav inferior (siempre presente) y el botón atrás del navegador. Cualquiera deja al usuario **sin la vieja (ya borrada) y sin la nueva (nunca creada)**. Bonus: si `createSessionFromRoutine` no encuentra la rutina (:231-234) navega a /routines habiendo borrado ya la sesión.

**Arreglo:** no borrar nunca; `saveCurrentSession` ya sobrescribe la clave. Basta con que la guarda devuelva la intención y que `createNewSessionFromPlan` sea quien decida.

### V4 — MEDIA · «Sets: X/Y done» está congelado y `hasWarmupSets()` miente (mitad de BUG-08)
`workout.ts:71`, `:73`, `:74`, `:75` — **verificado con un test que replica `replaceSet` + `persistCurrent` usando el propio Angular del repo:** tras completar una serie y marcarla warm-up, `completedCount() = 0` y `hasWarmupSets() = false`.

Causa: `replaceSet` (workout.ts:343-350) muta el `WorkoutExercise` in situ; `persistCurrent` (:435) sólo crea `session` y `exercises` nuevos. `currentExercise` (:67) reevalúa a un valor `Object.is`-igual, y un `computed` que reevalúa a un valor igual **no incrementa su versión**, así que sus dependientes se quedan limpios y devuelven la caché. `allCompleted` (:70) sí funciona porque depende de `exercises()` directamente, y el `@for` de workout.html:225 también (el template se reejecuta entero en cada CD). Sólo se «cura» al cambiar de ejercicio.

**No es una regresión** — el patrón ya estaba antes del diff. Pero invalida el comentario de set-input.ts:49-50: el flag *sí* se persiste ahora, la señal *no* se refresca.

**Arreglo:** que `replaceSet` sustituya el objeto ejercicio en vez de mutarlo:
```ts
const exercises = [...this.exercises()];
exercises[i] = { ...exercises[i], sets: exercises[i].sets.map(s => s.setNumber === updatedSet.setNumber ? updatedSet : s) };
this.session.update(prev => ({ ...prev!, exercises }));
```

### V5 — ALTA (UI) · El anillo de `:focus-visible` sigue invisible
`src/styles.css:23` — **verificado en el CSS compilado** (`ng build --configuration development`):
```
línea    4: @layer theme, base, components, utilities;
línea  318: @layer utilities {          ← abre
línea 2025:   .focus\:outline-none:focus { --tw-outline-style: none; outline-style: none; }
línea 2042: }                            ← cierra
línea 2048: @layer base {
línea 2063:   :where(a,button,input,select,textarea,[tabindex]):focus-visible { outline: 2px solid … }
```
`utilities` va **después** de `base` en el orden de capas, así que `outline-style: none` gana y el anillo no se pinta en ninguno de los 22 elementos que motivaron el arreglo (set-input.html:104/125/145/167/184, profile.html, workout.html:127/145). `:where()` con especificidad 0 empeora, no ayuda. La variable `--color-emerald-500` sí existe.

**Arreglo:** sacar la regla de `@layer base` y dejarla **sin capa** (como ya se hace con `select` en styles.css:89), y al hacerlo **quitar `border-radius: 0.25rem`**: sin capa también ganaría a `rounded-full` y los puntos de progreso (workout.html:67) y los toggles cambiarían de forma al recibir foco.

### V6 — MEDIA · BUG-15 medio arreglado: bucle infinito a peso corporal
`progression.util.ts:406` + `:432` — **verificado ejecutando:**
```
pull-ups 0×10/8/7, rising, RIR 4  → add-reps [[0,10],[0,8],[0,7]]   (idénticos)
pull-ups 0×20/20/20               → add-reps [[0,10],[0,10],[0,10]] (la mitad)
```
Con `isBodyweight`, todo veredicto de peso pasa a `add-reps` (:404-408), pero `add-reps` clampa a `repsMax` (:432). Si ya estás en el techo del rango, el motor propone **exactamente lo mismo** con el rationale «add a rep at the same weight». Y `rangeSwitched` está deshabilitado para bodyweight (:396), así que con reps por encima del rango **baja** el target. Peor aún: el test nuevo `progression.util.spec.ts:640-651` afirma `expect(b).toBe(a - 2)` con `a = 10` — **fija el bucle como comportamiento esperado**.

**Arreglo:** cuando `isBodyweight && set1.reps >= repsMax`, no clampar (dejar crecer las reps con un aviso «rango agotado — añade lastre») y nunca bajar del logro previo: `newSet1Reps = Math.max(set1.reps, …)`.

---

## 3. Efectos colaterales en pantallas no tocadas

| # | Fichero:línea | Qué pasa |
|---|---|---|
| C1 (media) | `session-detail.html:57-67` | Una serie saltada es **indistinguible** de una real: la columna Type sólo distingue Warm-up/Work y `{{ set.weightKg }} kg` se pinta igual. Antes se delataba con «0 kg / 0». El registro histórico deja de ser legible. Añadir el tercer caso `@if (set.skipped)` replicando set-input.html:21-22. |
| C2 (media) | `export.service.ts:58` + `dashboard.ts:115-117` | Se filtran las sesiones pero `data.user` se adopta tal cual, y precisamente en el escenario «dispositivo nuevo». Un `"user": {}` → `resolveLevel` (progression.util.ts:214) devuelve `undefined` → `AGGRESSIVENESS[undefined].requireRirInRange` (:315) → TypeError persistido. Añadir `isValidProfile`/`isValidRoutine` y, como red barata, normalizar en `decideAction`. *(Confirmo también que **no** hay ciclo de imports: `storage.service.ts` sólo importa `@angular/core` y el modelo, y `isValidSession` es una `function` hoisted sin DI.)* |
| C3 (baja) | `progression.util.ts:611-620` | **Verificado:** `buildSetsForExercise({warmupSets:3}, [warmup 40×10, work 60×10], true)` → `[[1,true,40,10,rir3],[2,true,40,8,rir2],[3,true,40,8,rir2],…]`. Los huecos heredan el **peso** del calentamiento pero las **reps y el RIR de serie de trabajo**. Un «calentamiento» de 40 kg × 8 a RIR 2 no es un calentamiento. Hacer el fallback completo y por rol. |
| C4 (baja) | `workout.html:143` | `[(ngModel)]="session.notes"` no llama a `persistCurrent()`. Si escribes notas en el resumen y la app se recarga antes de «Save & close», se pierden. Se salvan por casualidad si tocas el peso corporal después. |
| C5 (baja) | `set-input.html:102, 123, 143, 165, 182` | `(ngModelChange)="set().weightKg = $event"`: el `NumberValueAccessor` emite `null` al vaciar el campo (gesto habitual antes de teclear). Ese `null` viaja al JSON. Pre-existente, no lo introdujo el diff. |
| C6 (baja) | `routine-editor.html:132` | El `col-span-2` de Reps deja 5 medias celdas en un `grid-cols-2` de 4 hijos: fila 3 = `Rest | HUECO`, en **cada** ejercicio de la rutina. Poner `col-span-2` también en Rest (:146). |
| C7 (baja) | `routines-list.html:5` | El backdrop pasó de `z-10` a `z-[60]`, por encima del header y la nav (ambos z-50): con un menú abierto, el botón Atrás y las 5 pestañas quedan muertos (hace falta un toque extra). El menú a `z-[70]` sí es correcto. |
| C8 (baja) | Código muerto | `hasWarmup` (set-input.ts:13) — grep confirmado: **cero lecturas de `hasWarmup()`**, sólo el enlace de workout.html:226. `currentExerciseDone` (workout.ts:75-78) — sólo su definición. `--app-nav-h` (styles.css:7) y `.safe-bottom` (:67) — sin consumidores. `.scrollbar-hide` duplicada en `additional.css:2` y `styles.css:76`. |

---

## Mínimo que hay que tocar antes de ir al gimnasio

1. **R1** (progression.util.ts:464 + :373) — sin esto, la rutina con t-bar-row sale a 0 kg. Bloqueante.
2. **R2** (workout.ts:462, history.ts:67, session-detail.ts:64/69) — o, si se prefiere el parche de 1 línea, revertir el `s.weightKg = 0` de `skipSet()`.
3. **R7** (`clearTimeout` del auto-avance) y limitar la reapertura al icono de lápiz.
4. **R4** (acotar `startTime` en workout.ts:311) y **V3** (no borrar en la guarda).

R3, R5, V5 y R8 son visuales/de accesibilidad: molestan, no corrompen datos.

---

**Veredicto: NO — no los uses mañana tal cual; R1 está confirmado sobre los datos reales del usuario (t-bar-row del 12-ago sale a 0 kg en las tres ramas del motor) y R2 falsea el máximo del histórico de forma permanente en cuanto se salte una serie.**