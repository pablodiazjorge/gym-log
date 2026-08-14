# Informe final de auditoría — gym-log

**Fecha:** 2026-08-14 · **Rama:** master (d65ae58) · **Alcance:** `src/` completo + `docs/adr/` + export real `docs/personal-progress/exports/gym_data_2026-08-14.json`

De los 39 hallazgos supervivientes, tras deduplicar quedan **28 bugs confirmados**. He verificado personalmente con lectura de código los 10 primeros (todos los de severidad crítica/alta y los de estilos que sitúo en el top). **No he tenido que retirar ninguno**, pero he fusionado varios que eran el mismo defecto visto desde ángulos distintos y he reajustado dos severidades. Al final hay una sección con las anomalías del export que **NO son bugs**.

---

## Respuesta directa al síntoma nº1 del usuario

> *"Una vez cierras una serie no la puedes volver a editar."*

**Causa raíz identificada y confirmada. Es BUG-01.** No es un problema de change detection, ni de `disabled`, ni de zoneless: es que **la funcionalidad no existe**. `src/app/features/workout/set-input.html` está partida en dos ramas mutuamente excluyentes gobernadas por `set().completed`:

- `set-input.html:2` → `@if (set().completed) {` … resumen de sólo lectura (líneas 3-57). Leí la rama entera: **ni un `<button>`, ni un `(click)`, ni un `tabindex`**. Sólo `div`, `span` y `svg`.
- `set-input.html:61` → `@if (!set().completed) {` … todo el editor (peso, reps, RIR, parciales, excéntrico, toggle warm-up, botones).

Y en todo `src/` **`completed` sólo se escribe a `true`**: `set-input.ts:48` (`completeSet`), `set-input.ts:58` (`skipSet`) y `workout.ts:402` (a nivel de sesión). No existe ninguna asignación a `false`, ningún método `reopen()`/`editSet()`, ningún flag `isEditing` en `Workout`, y `SetInput` sólo expone un output (`setCompleted`, `set-input.ts:15`). La única salida es `discardWorkout()` (`workout.ts:409`), que tira **todo** el entrenamiento.

Agravantes que multiplican el daño (todos verificados, detallados abajo): el auto-avance a los 500 ms (BUG-08) te saca del ejercicio justo cuando ibas a mirar lo apuntado, y desde la pantalla de resumen **no hay ningún camino de vuelta** a los ejercicios (BUG-07): leí `workout.html:77-160` y el resumen sólo ofrece "Save & close" y "Export".

---

## Bloque 1 — Pérdida o corrupción de datos

### BUG-01 · Una serie completada es irreversible
**Severidad: CRÍTICA** · `src/app/features/workout/set-input.html:2` y `:61`, `src/app/features/workout/set-input.ts:46-61`
*(fusión de 3 hallazgos independientes)*

**Qué pasa:** al pulsar "Set completed" o "Skipped" la tarjeta se colapsa a un resumen estático sin ningún control. Un error de tecleo (100 kg en vez de 10) queda grabado para siempre en la sesión. Ojo: `skipSet()` además **borra los datos** (`weightKg = 0; reps = 0`, `set-input.ts:56-57`), así que un "Skipped" pulsado sin querer destruye lo que hubieras escrito.

**Reproducción:** iniciar entreno → serie 1: 45 kg × 8 → "Set completed" → tocar la tarjeta, el número, el check: nada responde. No hay ningún control en toda la pantalla que la devuelva a modo edición.

**Arreglo:** en `SetInput`, añadir `readonly reopen = output<WorkoutSet>()` y convertir el contenedor de `set-input.html:3` en `<button (click)="reopen.emit(set())">` (o añadir un icono de lápiz). En `Workout`, un `onSetReopen(set)` que reemplace la serie por `{ ...set, completed: false, skipped: false }` en `exercise.sets`, llame a `persistCurrent()` (`workout.ts:392`) y haga `isSummary.set(false)`. Mínimo aceptable: replicar el botón de borrar que ya existe en el flujo hermano (`additional.html:186`).

---

### BUG-02 · Empezar cualquier entrenamiento pisa la sesión en curso, sin aviso
**Severidad: CRÍTICA** · `src/app/features/workout/workout.ts:290-291`, `src/app/core/services/storage.service.ts:95-98`
*(fusión de 3 hallazgos)*

**Qué pasa:** `createNewSessionFromPlan()` termina con `this.storage.saveCurrentSession(s)` (workout.ts:291) y `saveCurrentSession` hace un `localStorage.setItem(CURRENT_SESSION_KEY, ...)` a pelo (storage.service.ts:97), sin comprobar nada. El único camino que respeta una sesión existente es `?resume=true` (`workout.ts:137-141`), que sólo genera el banner del dashboard (`dashboard.ts:81-89`). Ni `dashboard.ts:73-75` (`startWorkout`) ni `routines-list.ts:24-31` (`startRoutine`) miran `storage.currentSession()`, pese a que el dashboard **sabe** el estado (`dashboard.ts:29`, `hasSessionInProgress`). Y la barra de navegación inferior está visible **durante el entrenamiento** (`app.html:10-53`), así que "Routines" está a un dedo de distancia.

**Reproducción:** entreno de Piernas, 8 series completadas → botón atrás → banner "Unfinished session" → pulsar "Routines" en la barra inferior → pulsar cualquier rutina. En el flujo de rutina no hay pantalla intermedia: la destrucción es instantánea e irrecuperable.

**Arreglo:** guarda al principio de `initWorkflow()` (`workout.ts:150`): si `storage.currentSession()` existe y no está `completed` y no se pidió `resume`, o bien redirigir al flujo de reanudación, o bien `confirm('Tienes un entrenamiento sin terminar, ¿descartarlo?')`. Complementario: deshabilitar visualmente las tarjetas de arranque mientras `hasSessionInProgress()`.

---

### BUG-03 · La rutina no manda: el historial decide cuántas series hay y cuáles son de aproximación
**Severidad: ALTA** · `src/app/features/workout/workout.ts:255` y `:264`, `src/app/core/services/progression.util.ts:435-458`
*(fusión de 4 hallazgos — es un único defecto con dos efectos visibles)*

**Corrección a la sospecha del usuario:** la sospecha literal ("workout.ts:255 lee del TEMPLATE del catálogo en vez de la CONFIG de la rutina") es **inexacta**. `createSessionFromRoutine()` **sí** fusiona correctamente la config de la rutina sobre el catálogo (`workout.ts:222-233`: `targetSets`, `targetRepsMin/Max`, `hasWarmupSets`, `warmupSets`, `targetRirMin/Max` vienen de `config`). En la línea 255 `template` ya es el objeto fusionado. El bug real está en la **precedencia** entre esa configuración y el historial:

```
workout.ts:255   const totalSets = Math.max(template.targetSets + warmupCount, targets.length);
workout.ts:264     isWarmup: target?.isWarmup ?? i < warmupCount,
```

`targets` los genera `suggestNextSessionSets()` copiando la **forma** de la última sesión registrada: un target de calentamiento por cada calentamiento que hubiera (`progression.util.ts:435`) y uno de trabajo por cada serie de trabajo (`progression.util.ts:446`). Ninguno de los dos bucles mira `template.targetSets` ni `template.warmupSets`. Resultado:

- **Efecto A (calentamientos perdidos):** si el historial no tenía aproximaciones, todos los targets llegan con `isWarmup: false`, ocupan los índices bajos, y el fallback `?? i < warmupCount` nunca llega a aplicarse. **Traza exacta del caso t-bar-row del export:** config `warmupSets:2 + targetSets:4` → `warmupCount=2`, base=6; historial (2026-07-31, día Pull, plantilla de catálogo con `hasWarmupSets:false`) con 0 calentamientos y 6 series efectivas → `targets.length=6`, todos `isWarmup:false`; `totalSets = max(6,6) = 6`; para `i=0..5` existe target → **6 series, ninguna de aproximación**. Coincide clavado con `ws-2026-08-12-routine-2878`. `machine-crunch`, `seated-leg-curl`, `incline-leg-press` y `lat-pulldown` conservan sus calentamientos **porque su historial ya los tenía**, no porque la rutina lo diga.
- **Efecto B (volumen incontrolable):** el `Math.max` hace que bajar `targetSets` en el editor de rutinas **no tenga ningún efecto** si la última vez hiciste más series. Rutina a 3 series + historial de 5 → se crean 5.
- **Se autoperpetúa:** esa sesión sin calentamientos pasa a ser el nuevo historial. Perdidos para siempre salvo intervención manual.

Los calentamientos de la rutina **sólo** se respetan la primerísima vez que se entrena el ejercicio (rama `no-history`, `progression.util.ts:358-364`).

Contradice el propio comentario de intención de `workout.ts:212-216` ("*a routine is 'configured exactly as you want'*") y ADR-0005. **No** está amparado por ADR-0007, que habla de pre-rellenar valores, no de decidir la estructura de la sesión.

**Reproducción:** 1) registrar t-bar-row en un día Pull normal (catálogo: `hasWarmupSets:false`, 3 series). 2) Crear rutina con t-bar-row a `warmupSets:2` + `targetSets:4`. 3) Lanzarla → 6 series, ninguna warm-up.

**Arreglo:** invertir la precedencia — la estructura la fija SIEMPRE el plan, la sugerencia sólo aporta VALORES:
```ts
const totalSets = template.targetSets + warmupCount;   // sin Math.max cuando viene de rutina
isWarmup: i < warmupCount,
```
y emparejar los targets **por rol** (el i-ésimo target warm-up para los índices de warm-up, el i-ésimo target de trabajo para el resto) en vez de por índice plano, rellenando/recortando cuando el historial tenga otro número de series.

---

### BUG-04 · Las series "skipped" cuentan en TODAS las métricas… y realimentan el motor de progresión
**Severidad: ALTA** · `src/app/core/services/analytics.service.ts:90`

```ts
private getWorkSets(exercise: WorkoutExercise): WorkoutSet[] {
  return exercise.sets.filter((s) => !s.isWarmup && s.completed);   // falta && !s.skipped
}
```

`skipSet()` deja la serie con `skipped=true, weightKg=0, reps=0, completed=true` (`set-input.ts:53-58`), así que entra en los cálculos como una serie real de 0 kg × 0 reps. `getWorkSets` es el filtro único del que dependen volumen, máximos, medias de reps, `avgRir`, `rirTrend`, detección de estancamiento, volumen semanal y `totalSets`. El resto del código **sí** lo hace bien (`progression.util.ts:357`, `progression.service.ts:36`, `profile.service.ts:75`), lo que confirma que es un olvido.

**Lo que eleva esto a ALTA:** verifiqué que no se queda en las gráficas. `progression.service.ts:35` calcula `metrics = this.analytics.getExerciseMetrics(...)` y `progression.service.ts:54` inyecta `rirTrend: metrics.rirTrend` en `suggestNextSessionSets()` → `decideAction()`. **Una serie saltada puede provocar un `hold` o un `add-weight-aggressive` equivocados en tu siguiente entrenamiento.**

Impactos comprobados contra el export real: `machine-crunch` muestra "Average reps" 11,67 cuando la única serie efectiva fue de 35 (error de 3×); en `ws-2026-07-23` se saltaron las 3 series de `rear-delt-fly` y las 3 de `incline-bench-lateral-raises`, así que la gráfica "Weight progression" dibuja una caída a 0 kg inexistente y `detectStagnation` la lee como regresión.

**Arreglo:** `exercise.sets.filter((s) => !s.isWarmup && s.completed && !s.skipped)`.

---

### BUG-05 · `durationMinutes` se congela: las 12 sesiones guardadas tienen duración 0
**Severidad: MEDIA-ALTA** (pérdida permanente de un dato, pero no del entreno) · `src/app/features/workout/workout.ts:70` y `:403`; réplica en `src/app/features/additional/additional.ts:59` y `:314`
*(fusión de 2 hallazgos)*

```ts
readonly durationMinutes = computed(() => Math.round((Date.now() - this.startTime()) / 60000));
```

La única dependencia reactiva es `startTime`, que se fija una sola vez (`workout.ts:292`); grep confirmado: no se toca en ningún otro sitio. `Date.now()` no es una señal, así que el computed **se memoiza en la primera lectura** (render del footer, `workout.html:241`, ~0 minutos después de crear la sesión) y no se recalcula jamás. Ese 0 es lo que se ve en el footer, en el resumen (`workout.html:87`) y sobre todo lo que se persiste en `finishWorkout()` (`workout.ts:403`).

**Verificado sobre el export real: 12 de 12 sesiones con `durationMinutes: 0`, sin excepción.** Y como `history.html:37` y `session-detail.html:18` usan `@if (session.durationMinutes)` y 0 es *falsy*, el dato ni siquiera se muestra: la pérdida es silenciosa.

**Agravante:** `loadExistingSession()` (`workout.ts:295-311`) no restaura `startTime` desde `session.date`, así que ni arreglando la memoización se mediría bien una sesión reanudada.

**Arreglo:** calcular imperativamente en `finishWorkout()` (`s.durationMinutes = Math.round((Date.now() - this.startTime()) / 60000)`) y, para el contador en pantalla, una señal `now` refrescada con `setInterval(..., 30000)` limpiada en `DestroyRef.onDestroy`. Restaurar `startTime` en `loadExistingSession()`. Aplicar lo mismo en `additional.ts:59`.

---

### BUG-06 · El import no valida nada: un JSON malformado deja History y Analysis rotos de forma permanente
**Severidad: MEDIA** · `src/app/core/services/export.service.ts:44-47`, `src/app/core/services/storage.service.ts:109-118` y `:23-34`
*(fusión de 2 hallazgos)*

`importFromFile()` sólo comprueba `data.sessions` y `Array.isArray`. `const data: ExportData = JSON.parse(...)` es un cast de TypeScript, cero verificación en runtime. `importSessions()` (storage.service.ts:114) los concatena y `persistSessions()` los escribe en localStorage. A partir de ahí, una sesión sin `exercises` revienta `history.html:36` (`session.exercises.length`), `history.ts:65` (`getMaxWeight`), `analytics.service.ts:471` y `:395`. Como el dato ya está persistido, **el fallo sobrevive a la recarga y la pantalla que peta es justo la única que ofrece `deleteSession()`**: no hay salida desde la UI. Además `loadSessions()` (storage.service.ts:27-28) no comprueba `Array.isArray(parsed)`.

**Arreglo:** validar cada elemento antes de resolver (`id` string, `date` parseable, `Array.isArray(exercises)` y `Array.isArray(ex.sets)` en cada ejercicio), descartar e informar; `Array.isArray(parsed)` en `loadSessions()`; defensa en profundidad con `session.exercises ?? []` en los consumidores.

---

### BUG-07 · Los IDs de sesión sólo usan 4 dígitos: una colisión sobrescribe la sesión anterior
**Severidad: BAJA** (probabilidad baja, consecuencia = pérdida total de una sesión) · `src/app/features/workout/workout.ts:283`, réplica en `additional.ts:310`

```ts
id: `ws-${new Date().toISOString().slice(0,10)}-${dayType}-${String(Date.now()).slice(-4)}`,
```
Sólo los ms dentro de una ventana de 10 s. Dos sesiones del mismo día y tipo separadas por un múltiplo exacto de 10.000 ms generan el mismo id, y `saveSession()` resuelve por id (`storage.service.ts:39-43`: `current[index] = session`) → sobrescritura silenciosa. Contrasta con `routine-library.service.ts:63`, donde el problema ya se detectó y se resolvió con sufijo aleatorio.

**Arreglo:** `crypto.randomUUID()` o el mismo esquema que las rutinas.

---

## Bloque 2 — Funcionalidad rota durante el entrenamiento

### BUG-08 · El toggle "Warm-up" sólo aparece si el ejercicio YA tiene una serie de aproximación
**Severidad: MEDIA** · `src/app/features/workout/workout.ts:69`, `workout.html:225`, `set-input.html:189`, `set-input.ts:42-44`

Huevo y gallina: `hasWarmupSets = computed(() => this.currentExercise()?.sets.some((s) => s.isWarmup) ?? false)` se pasa como `[hasWarmup]` y `set-input.html:189` sólo pinta el toggle si es cierto. **Si un ejercicio arranca con 0 aproximaciones, no hay forma humana de marcar la primera.** Es exactamente la situación en la que deja BUG-03 al usuario con t-bar-row: 6 series, 0 warmups, y ni siquiera puede arreglarlo a mano.

Segundo defecto en el mismo punto: `toggleWarmup()` (`set-input.ts:42-44`) muta `isWarmup` sobre el objeto de entrada **sin emitir nada**. `Workout` sólo persiste en `onSetCompleted` (`workout.ts:326`), así que si marcas una serie como warm-up y sales de la app antes de completarla, **el cambio se pierde**; y cuando por fin se completa alguna serie, `hasWarmupSets()` se recalcula de golpe y los toggles de las series pendientes pueden desaparecer sin aviso.

**Arreglo:** mostrar siempre el toggle (quitar el `@if (hasWarmup())`) y hacer que `toggleWarmup()` emita el set al padre para que se actualice la señal y se persista.

### BUG-09 · Desde el resumen no hay vuelta atrás, y los puntos de progreso son controles muertos
**Severidad: MEDIA** · `src/app/features/workout/workout.html:64-74` (fuera del `@if (isSummary())` de la línea 77)

Los puntos se renderizan también encima del resumen, pero su handler es `currentExerciseIndex.set(i)` (`workout.html:66`), que no toca `isSummary`. Leí el bloque de resumen entero (`workout.html:77-160`): sus únicas acciones son "Save & close" (`finishWorkout`) y exportar. Es decir, **una vez en el resumen sólo se puede guardar o descartar**, y el único control que parece navegación no hace nada. Es justo lo que el usuario intentará pulsar tras darse cuenta de que apuntó mal una serie.

**Arreglo:** que el click de los puntos haga también `isSummary.set(false)` — con eso queda resuelta de paso la vuelta desde el resumen.

### BUG-10 · El auto-avance con `setTimeout` de 500 ms puede saltarse un ejercicio
**Severidad: MEDIA-BAJA** · `src/app/features/workout/workout.ts:328`

```ts
if (allDone && !this.isLastExercise()) setTimeout(() => this.goToNext(), 500);
```
El timer no se captura, no se cancela nunca (ni en navegación manual ni al destruir el componente) y `goToNext()` incrementa el índice **actual en el momento de dispararse**. Si en esos 500 ms tocas un punto de progreso o "Next", el temporizador te desplaza una posición más.

**Arreglo:** `const from = this.currentExerciseIndex(); const t = setTimeout(() => { if (this.currentExerciseIndex() === from) this.goToNext(); }, 500);` guardando `t` para limpiarlo en `ngOnDestroy` y en la navegación manual.

---

## Bloque 3 — UI rota (el usuario está de pie, con el móvil, entre serie y serie)

### BUG-11 · La cabecera del entreno queda tapada por la cabecera global
**Severidad: MEDIA** · `src/app/features/workout/workout.html:165`; réplica en `src/app/features/additional/additional.html:93`

`app-header` se renderiza en TODAS las rutas (`app.html:2`, sin ningún `@if`) y es `sticky top-0 z-50` con altura fija de 48px (`h-12`, `header.html:2`). La cabecera del entreno es `sticky top-0 z-10`: **misma coordenada, z-index inferior**. Al hacer scroll por la lista de series, la fila de controles (flecha "anterior", etiqueta del día, botón de descartar sesión, `workout.html:166-185`) desaparece bajo una barra semiopaca con `backdrop-blur-xl`. Confirmado que el layout scrollea el documento y no internamente: el `<main class="flex-1 overflow-y-auto">` (`workout.html:196`) vive en un contenedor `min-h-screen` sin altura fija, así que crece con el contenido y el overflow nunca se activa.

Que es un descuido lo demuestra `exercise-library.html:39`, donde el mismo patrón sí compensa: `sticky top-12 z-10`.

**Arreglo:** `sticky top-12 z-40` en `workout.html:165` y `additional.html:93`. Mejor: variable CSS `--app-header-h` en `styles.css` y `top-[var(--app-header-h)]` en los tres sitios.

### BUG-12 · En la selección de ejercicios, "Start workout" y "Back" quedan bajo la barra de navegación
**Severidad: MEDIA** · `src/app/features/workout/workout.html:4`

La nav es `fixed bottom-0 z-50` con 64px (`h-16`, `app.html:10-11`). Todas las páginas reservan ese espacio con `pb-24` y el flujo Additional con `pb-20` (`additional.html:75`). **La pantalla de selección de Workout es la única que no reserva nada**: su contenedor es sólo `p-6` (24px). Con grupos largos (`pull-main` tiene 7 opciones) el contenido supera el viewport, `justify-center` deja de centrar y los últimos 64px quedan tapados: el botón "Back" (`workout.html:54`) queda completamente cubierto, y tocar donde debería estar **navega a otra pestaña**.

**Arreglo:** `pb-24` en `workout.html:4`. Mejor: mover la reserva al `<main>` de `app.html:5` con `padding-bottom: calc(4rem + env(safe-area-inset-bottom))` y quitar los `pb-24` repetidos.

### BUG-13 · El menú contextual de rutinas se dibuja por debajo de la barra inferior
**Severidad: MEDIA** · `src/app/features/routines/routines-list.html:59` y `:110`, backdrop en `:5`

Menú `absolute right-2 top-14 z-20`, backdrop `fixed inset-0 z-10`. El `<div class="relative">` padre (`routines-list.html:36`) no crea contexto de apilamiento (z-index auto), así que ambos compiten en la raíz contra el header (`z-50`) y la nav (`z-50`). Consecuencias: (a) el menú de la última rutina de la lista cae bajo la nav y "Edit"/"Duplicate"/"Delete" no se pueden pulsar; (b) el backdrop no cubre la nav ni el header, así que tocar una pestaña con el menú abierto **navega en vez de cerrarlo** y el menú sigue abierto al volver.

**Arreglo:** backdrop a `z-[60]` y menú a `z-[70]`; y voltear el menú a `bottom-full mb-2` cuando la tarjeta esté en el tercio inferior.

### BUG-14 · La celda "Reps" del editor de rutinas aplasta sus botones ± a ~10px
**Severidad: MEDIA** · `src/app/features/routines/routine-editor.html:130-140` (rejilla en `:108`)

Siete elementos en una columna de un `grid grid-cols-2 gap-2`: 4 botones `w-6` (24px), 2 números y el separador "–" (`mx-0.5`). En un móvil de 360px la celda mide ~128px frente a los ~213px que necesita el contenido. El preflight de Tailwind pone `padding:0` en los `<button>`, así que su min-content es el ancho del glifo y `flex-shrink` los reduce a tiras de ~10×24px, imposibles de acertar con el dedo y visualmente rotas frente a los ± cuadrados de "Sets", "Warm-up" y "Rest" de al lado (`routine-editor.html:110-127`, `:144-149`). No hay `flex-wrap`, ni `min-w-0`, ni `overflow-x` en ningún nivel. El mismo patrón, menos apretado, en `workout.html:199-221` (fila "Rest between sets").

**Arreglo:** dar fila completa a "Reps" (`col-span-2`) o partirla en "Reps min" / "Reps max"; añadir `flex-shrink-0` a los cuatro botones y `min-w-0` al contenedor.

---

## Bloque 4 — Cálculos y analítica incorrectos

### BUG-15 · Los ejercicios a peso corporal nunca progresan
**Severidad: MEDIA** · `src/app/core/services/progression.util.ts:357`

```ts
const workSets = lastSets.filter((s) => !s.isWarmup && s.completed && !s.skipped && s.weightKg > 0);
```
Para todo ejercicio a peso corporal del catálogo (`pronated-pull-ups`, `chin-ups`, `chest-dips`, `hanging-leg-raises`, `plank`, `ab-wheel-rollout`…) las series legítimas tienen `weightKg: 0`, así que `workSets` queda vacío y siempre se devuelve `basis: 'no-history'` con los defaults de plantilla (`:358-364`). El usuario que hace 15 dominadas recibe eternamente el pre-rellenado de `targetRepsMin` y el mensaje **falso** "No previous data for this exercise". El export ya tiene el caso: `ws-2026-08-05-additional-8006` con `pronated-pull-ups` a 0 kg × 10/8/7/5.

**Arreglo:** quitar `s.weightKg > 0` (las saltadas ya se descartan con `!s.skipped`) y tratar `set1.weightKg === 0` como progresión por reps, forzando la rama `add-reps` y saltando los ratios de peso (ya existe la guarda `set1.weightKg > 0 ? ... : 0` en `:436`).

### BUG-16 · "Weeks without a PR" muestra literalmente **NaN**
**Severidad: MEDIA** · `src/app/core/services/analytics.service.ts:419` (origen en `:246-260`, render en `analysis.html:59`)

`maxWeightDate` sólo se asigna cuando `sessionMaxWeight > maxWeightEver` partiendo de `maxWeightEver = 0`; para un ejercicio a peso corporal `0 > 0` nunca se cumple y queda cadena vacía. `detectStagnation` entra igualmente (la guarda de `:414` mira `weightProgression.length`, que sí tiene entradas) y hace `new Date('')` → Invalid Date → `getTime()` → NaN → `Math.max(0, NaN)` → **NaN** (`Math.max` propaga NaN). `analysis.html:59` lo interpola sin pipe ni guarda. Con ≥3 sesiones se agrava: `allSame` es true (todos los máximos son 0) → `isStagnant = true`, y como NaN falla todas las comparaciones, la cascada cae al último `else` y recomienda "*Consider swapping the exercise or a deload*" a alguien que está progresando en dominadas.

**Reproducible hoy** con un fichero del propio repo: importar `docs/sample-data/gym_tracker_sample_data.json` y abrir `elevaciones-piernas-colgado` en /analysis.

**Arreglo:** salir antes si no hay PR válido (`if (!metrics.maxWeightDate || Number.isNaN(...)) return { isStagnant: false, weeks: 0, suggestion: 'Not enough data' }`) y medir el PR por reps/volumen en ejercicios sin peso externo.

### BUG-17 · Las aproximaciones saltadas generan un objetivo de 0 kg en la sesión siguiente
**Severidad: BAJA** · `src/app/core/services/progression.util.ts:435`

`lastSets.filter((s) => s.isWarmup)` no comprueba `skipped`, a diferencia del filtro de series de trabajo dos bloques más arriba (`:357`). Como `skipSet()` deja `weightKg = 0`, el ratio de `:436` sale 0 y la aproximación se propone a 0 kg. Ya hay un caso real en el export: `seated-leg-curl` de `ws-2026-08-13-routine-6025`, serie 1 con `isWarmup:true, skipped:true, weightKg:0`.

**Arreglo:** `lastSets.filter((s) => s.isWarmup && !s.skipped && s.weightKg > 0)`, con caída a los defaults de plantilla si no queda ninguna.

### BUG-18 · El título de la cabecera está congelado en "Gym Tracker"
**Severidad: MEDIA** (visible en todas las pantallas) · `src/app/shared/components/header.ts:25-39`

`title` es un `computed()` cuya única entrada es `this.router.url`, una propiedad normal. **Un computed sin productores señal se evalúa una vez y queda memoizado para siempre**: aunque `isHome()` (que sí es reactivo vía `toSignal`, `:17-23`) fuerce re-render, `title()` devuelve el valor cacheado de la primera evaluación. La flecha de volver funciona, el título no.

**Arreglo:** `private readonly url = toSignal(this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => this.router.url)), { initialValue: this.router.url });` y leer `this.url()` dentro del computed.

### BUG-19 · El tile "Last" del dashboard usa el orden del array, no la fecha
**Severidad: BAJA** · `src/app/features/dashboard/dashboard.ts:31-34`
*(fusión de 2 hallazgos)*

`sessions[sessions.length - 1]` asume que el orden de inserción es cronológico, pero `importSessions()` concatena al final sin ordenar (`storage.service.ts:114`). Basta restaurar un backup antiguo — el caso de uso principal de la importación según ADR-0002 — para que "Last" muestre una sesión vieja, y el efecto es permanente porque el array desordenado se persiste. `history.ts:21` y `analytics.service.ts:115` sí ordenan por fecha, lo que confirma el olvido.

**Arreglo:** `[...sessions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] ?? null`, o bien ordenar al fusionar en `importSessions`.

### BUG-20 · `getMondayOfWeek` mezcla fecha local con serialización UTC
**Severidad: BAJA** · `src/app/core/services/analytics.service.ts:99-105`
*(fusión de 2 hallazgos)*

Calcula el lunes con `getDay()`/`getDate()`/`setDate()` (local) pero devuelve `toISOString().split('T')[0]` (UTC) conservando la hora original. Con España en UTC+1/+2, una sesión entre 00:00 y 01:59 local retrocede un día y cae en domingo: el volumen semanal se parte en dos buckets, aparece una barra espuria en "Total weekly volume" y se desplazan las derivadas (`:187`, `:518`, `:555`, `:576-595`). Con el horario habitual del usuario (6:30) no se dispara, pero es real para entrenos de madrugada.

**Arreglo:** `d.setHours(12,0,0,0)` tras `setDate(diff)`, o construir la cadena con los getters locales.

### BUG-21 · El índice de consistencia ignora las sesiones de rutina y se queda clavado en 100 %
**Severidad: BAJA** · `src/app/core/services/analytics.service.ts:495`

El bucle sólo recorre `['push','pull','legs','abs']`; `routine` y `additional` quedan fuera. `consistencyScore` se inicializa a 100 y sólo se recalcula si `typeGaps.length > 0`. **Las 3 últimas sesiones del export (2026-08-12/13/14) son todas `dayType:'routine'` y ninguna cuenta**: en cuanto el usuario migre del todo a rutinas, el marcador se queda en "100 %" en verde (`analysis.html:135-140`) aunque lleve meses sin entrenar. El mismo sesgo afecta a las alertas de caída de volumen (`:580-593`). Es una métrica que miente con confianza, no un dato ausente.

**Arreglo:** agrupar por una clave que cubra todo (para `routine`, `session.routineId`) y devolver "sin datos" en vez de 100 cuando no haya huecos que medir.

### BUG-22 · "Overall trend" compara la semana en curso (incompleta) contra la anterior (completa)
**Severidad: BAJA** · `src/app/core/services/analytics.service.ts:553-558`

El comentario declara "*compare last 2 full weeks*"; el código coge los dos últimos buckets, y el último es siempre la semana a medias. Quien entrena 3 días/semana verá "Watch out →" en rojo (`analysis.html:143-150`) casi toda la semana. Además, una semana sin sesiones no genera bucket, así que la comparación puede acabar enfrentando semanas separadas por meses sin que nada lo indique.

**Arreglo:** descartar el bucket cuyo `weekStart === getMondayOfWeek(hoy)`, comparar sólo semanas cerradas y consecutivas, y mostrar "sin datos suficientes" si no hay dos.

---

## Bloque 5 — Cosmético

| # | Bug | Fichero:línea | Arreglo |
|---|---|---|---|
| BUG-23 | El `<body>` pinta `bg-slate-900` (#0f172a) y **cancela** el `bg-gray-950` (#030712) de `styles.css`: la capa `utilities` gana siempre sobre `base` en Tailwind 4. Se ve como banda azulada en el rebote de scroll de iOS. La regla de `styles.css:5` está muerta. | `src/index.html:11` | Quitar `bg-slate-900 text-slate-100` del body; actualizar `theme-color` de `index.html:8` a `#030712` |
| BUG-24 | `text-white` estático + `[class.text-gray-500]` condicional: Angular no borra la clase estática, y en el CSS compilado `.text-white` va después → el botón deshabilitado sigue saliendo blanco y pierde la señal de "no puedes pulsar". Mismo patrón en `additional.html:78-79`. | `src/app/features/workout/workout.html:43` y `:49` | Hacer `[class.text-white]="hasAnySelection()"` o usar `disabled:text-gray-500` (el atributo `disabled` ya está en `:42`) |
| BUG-25 | `.scrollbar-hide` sólo existe en `additional.css` (stylesheet de componente con encapsulación emulada → `[_ngcontent-…]`), pero se usa en tres plantillas. En dos de ellas es inerte y la barra de scroll horizontal se ve. Verificado: la clase aparece en `additional.html:17`, `exercise-library.html:11` y `routine-editor.html:17`, y la definición sólo en `additional.css:2-8`. | `src/app/features/routines/routine-editor.html:17`, `src/app/features/exercise-library/exercise-library.html:11` | Mover el bloque a `src/styles.css` (o `@utility scrollbar-hide` de Tailwind 4) |
| BUG-26 | **22** usos de `focus:outline-none` y **0** de `focus-visible`/`focus:ring`/`outline` en todo `src/` (verificado por grep). El foco de teclado es invisible; peor en `set-input`, donde los inputs son `bg-transparent` sin borde. | `set-input.html:97,118,138,160,177`, `profile.html` (11), `additional.html` (3), `workout.html` (2), `routine-editor.html` (1) | Regla global en `@layer base`: `:where(a,button,input,select,textarea):focus-visible { outline: 2px solid var(--color-emerald-500); outline-offset: 2px; }` |
| BUG-27 | Cuatro `<select>` con `appearance-none` sin chevron de sustitución: parecen inputs de texto. El peor es el control principal de /analysis. | `analysis.html:30`, `profile.html:25,49,172` | Quitar `appearance-none` o superponer un SVG con `pointer-events-none` + `pr-10` |
| BUG-28 | Las 10 páginas de feature usan `min-h-screen` (100vh) dentro de un shell `min-h-dvh`: en móvil cada página mide más que la ventana y aparece scroll muerto de ~100-150px incluso con la pantalla vacía. Verificado: `app.html:1` usa `min-h-dvh`, los 10 ficheros de feature usan `min-h-screen`. | `dashboard.html:1`, `history.html:1`, `session-detail.html:1`, `analysis.html:1`, `profile.html:1`, `routines-list.html:1`, `routine-editor.html:1`, `exercise-library.html:1`, `workout.html:1`, `additional.html:1` | `min-h-dvh`, o quitarlo (el shell ya garantiza el alto) |
| BUG-29 | `.safe-bottom { padding-bottom: var(--safe-bottom) }` usa una custom property **que no existe** → declaración inválida y descartada; además la clase no se usa en ninguna plantilla. Y `env(safe-area-inset-bottom)` de `app.html:10` es inerte porque el meta viewport (`index.html:7`) no lleva `viewport-fit=cover`. | `src/styles.css:38-40`, `src/index.html:7` | Definir `:root { --safe-bottom: env(safe-area-inset-bottom, 0px) }`, añadir `viewport-fit=cover` y usar `pb-[calc(4rem+env(safe-area-inset-bottom))]` en los footers sticky (`workout.html:230`, `additional.html:204`) |

---

## Anomalías del export que NO son bugs (verificadas y descartadas)

1. **`exerciseName` en inglés en las sesiones desde rutina.** La sospecha ("el flujo de rutina usa `template.name` en vez de `template.nameEs`") **no se sostiene**: verifiqué que **ambos** flujos usan `template.name` — `workout.ts:278` (`exerciseName: template.name`) y `additional.ts:301` (`exerciseName: t.name`). No hay divergencia entre el flujo de rutina y el de día. La explicación real está en **ADR-0012 (v2 format clean break, 2026-08-08)**: el catálogo pasó a `name` en inglés + `nameEs` opcional, la UI de la app está en inglés, y el propio ADR dice que "*the app performs no runtime migration*". Las sesiones "antiguas" en español son **datos legacy anteriores a esa migración**, no un bug del flujo de rutina. Coincide con la cronología: las sesiones en español son de julio, las de rutina de agosto. Sí queda un efecto colateral cosmético (el historial mezcla idiomas), pero es consecuencia aceptada del ADR, no un defecto de código. `nameEs` sólo se muestra en la biblioteca de ejercicios (`exercise-library.html:50-51`), lo cual es coherente.
2. **`dayType:"routine"` y `restSeconds` a nivel de ejercicio en las sesiones nuevas.** Intencionado: son campos del modelo (`workout.model.ts`) introducidos con la feature de rutinas personalizadas y con el descanso configurable (`workout.ts:275-278`, `routine-editor.html:144-149`). Las sesiones antiguas no los tienen simplemente porque la feature no existía.
3. **`eccentricSeconds` con decimales (0.3, 0.5, 0.7).** El campo es de entrada libre: `set-input.html:175` es un `<input type="number" step="1" min="0">` sin `pattern`, y `adjustEccentricSeconds` (`set-input.ts:37-40`) sólo suma enteros. Los decimales vienen de teclearlos a mano. No hay corrupción ni cálculo dependiente. No es bug.
4. **Nota menor (no reportada como bug):** en `routines-list.html:37-56` hay un `<button>` (menú de tres puntos, línea 48) anidado dentro de otro `<button>` (la tarjeta, línea 37). HTML inválido; funciona porque Angular construye el DOM programáticamente y `toggleMenu` hace `stopPropagation` (`routines-list.ts:34`), pero es frágil y rompe la semántica de accesibilidad. Merece limpieza, no entra en la lista de bugs.

---

## Plan de ataque recomendado

**Sprint 1 — lo que le hace perder datos hoy en el gimnasio:** BUG-01 (reabrir serie) → BUG-02 (guarda antes de pisar la sesión) → BUG-09 (salida del resumen, comparte solución con BUG-01) → BUG-08 (toggle warm-up siempre visible, es el parche manual de BUG-03).

**Sprint 2 — la rutina debe mandar:** BUG-03 (una sola inversión de precedencia en `workout.ts:255/264` + emparejado por rol) y BUG-04 (`&& !s.skipped`, un carácter con impacto en toda la analítica **y** en el motor de progresión). Ambos son arreglos pequeños con retorno enorme.

**Sprint 3 — datos y calidad:** BUG-05, BUG-06, BUG-15, BUG-16, BUG-17, BUG-18.

**Sprint 4 — UI:** BUG-11, BUG-12, BUG-13, BUG-14 y el bloque cosmético.