> **Historical document** — this is the literal original spec/prompt (in Spanish) that generated
> the first version of the app. It is kept unmodified as a record of the original design
> rationale. Current design documentation lives in [architecture.md](../../architecture.md);
> see ADR-0005 and ADR-0008 for decisions that trace back to this document.

# PROMPT: Gym Tracker App - Angular + LocalStorage

## 1. OBJETIVO
Crea una aplicación web Angular standalone, sin backend, para registrar entrenamientos de gimnasio. Debe ser ultra rápida de usar desde el móvil (la usaré en el gimnasio entre serie y serie), con flujo de clicks mínimo, sin pereza. Los datos se guardan en localStorage y se pueden exportar/importar en JSON.

## 2. STACK TECNOLÓGICO OBLIGATORIO
- Angular 17+ standalone (sin NgModules)
- Signals (@angular/core) para estado reactivo
- localStorage para persistencia
- CSS puro o Tailwind (elige el más ligero, sin dependencias pesadas)
- Sin backend, sin auth, sin base de datos externa
- Responsive first (diseño mobile, uso con una mano)

## 3. MODELO DE DATOS (Interfaces TypeScript obligatorias)

```typescript
// Ejercicio base de la rutina
interface ExerciseTemplate {
  id: string; // slug único: "press-inclinado-maquina"
  name: string;
  category: 'push' | 'pull' | 'legs';
  dayVariant?: 'A' | 'B'; // null para ejercicios que se repiten igual
  order: number;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  hasWarmupSets: boolean; // si requiere series de aproximación
  warmupSets?: number;
  notes?: string;
}

// Serie registrada
interface WorkoutSet {
  setNumber: number;
  isWarmup: boolean;
  weightKg: number;
  reps: number;
  rir: number; // Reps In Reserve (0-5)
  completed: boolean;
  notes?: string;
}

// Ejercicio registrado en una sesión
interface WorkoutExercise {
  templateId: string;
  exerciseName: string; // snapshot por si cambia el template
  sets: WorkoutSet[];
}

// Sesión de entrenamiento
interface WorkoutSession {
  id: string; // UUID o timestamp
  date: string; // ISO 8601
  dayType: 'push' | 'pull' | 'legs';
  dayVariant: 'A' | 'B';
  exercises: WorkoutExercise[];
  durationMinutes?: number;
  bodyWeightKg?: number;
  notes?: string;
  completed: boolean;
}
```

## 4. RUTINA HARDCODED (Obligatorio, no configurable por UI)

La app debe tener la rutina hardcoded en un servicio `RoutineService`. El usuario NO puede editarla desde la UI (evita complejidad). Aquí la rutina exacta:

### PUSH (Lunes y Viernes) - Variante A y B son idénticas
1. Press inclinado en máquina | 4 sets (10-12) | hasWarmup: true, warmupSets: 2
2. Pec Deck / Chest Fly Machine | 3 sets (12-15) | hasWarmup: false
3. Tríceps en polea vertical | 3 sets (12-15) | hasWarmup: false
4. Elevaciones laterales en banco inclinado | 3 sets (12-15) | hasWarmup: false
5. Rear Delt Fly | 2-3 sets (12-15) | hasWarmup: false

### PULL (Miércoles = A, Sábado = B)
1. Jalón al pecho (agarre ancho, prono) | 4 sets (8-10) | hasWarmup: true, warmupSets: 2 | A y B idéntico
2. Remo en T con agarre neutro (ancho hombros) | 3 sets (10-12) | hasWarmup: false | A y B idéntico
3. Curl de bíceps en banco inclinado | 4 sets (10-12) | hasWarmup: false | SOLO día A (Miércoles)
3. Curl martillo | 4 sets (10-12) | hasWarmup: false | SOLO día B (Sábado)
4. Elevaciones de piernas colgado | 3 sets (12-15) | hasWarmup: false | SOLO día A (Miércoles)
4. Plancha con peso o Crunch en máquina | 3 sets (12-15) | hasWarmup: false | SOLO día B (Sábado)

### LEGS (Jueves) - Opción A
1. Hack squat en máquina | 4 sets (8-10) | hasWarmup: true, warmupSets: 2
2. Prensa inclinada (pies altos y anchos) | 3 sets (10-12) | hasWarmup: false
3. Curl femoral acostado en máquina | 3 sets (12-15) | hasWarmup: false
4. Hip thrust en máquina | 3 sets (10-12) | hasWarmup: false

**REGLA DE VARIANTES:**
- Si el usuario selecciona "Miércoles" → Pull A (con curl banco inclinado + elevaciones piernas)
- Si el usuario selecciona "Sábado" → Pull B (con curl martillo + plancha/crunch)
- Lunes y Viernes → Push A (idénticos)
- Jueves → Legs A

## 5. FLUJO DE USUARIO (UX - Sin pereza)

### Paso 1: Inicio rápido
- Pantalla principal con 4 botones grandes: **Lunes Push**, **Miércoles Pull**, **Jueves Legs**, **Viernes Push**, **Sábado Pull**
- También un botón "Historial" y "Exportar"
- Al hacer click en un día, crea una `WorkoutSession` nueva con la fecha actual y carga la plantilla de ejercicios

### Paso 2: Vista de ejercicio activo (UNO A UNO, no lista completa)
- NO muestres todos los ejercicios en una lista. Es abrumador.
- Muestra UN SOLO ejercicio con sus series. Navegación con "Anterior" / "Siguiente Ejercicio"
- Para cada serie:
  - Input numérico para peso (kg) - con botones + / - de 0.5kg o 1kg (para ajustar rápido)
  - Input numérico para reps - con botones + / -
  - Selector RIR: 0, 1, 2, 3, 4, 5 (botones grandes, click único)
  - Checkbox "¿Es serie de aproximación?" (solo si hasWarmup: true)
  - Botón "✓ Serie completada" (grande, verde)
- Cuando completas todas las series del ejercicio, auto-avanzar al siguiente ejercicio
- Mostrar progreso: "Ejercicio 2 de 5"

### Paso 3: Resumen post-entreno
- Al completar el último ejercicio, pantalla de resumen:
  - Tiempo total
  - Lista de ejercicios con peso máximo por ejercicio
  - Botón "Guardar y cerrar" (persistir en localStorage)
  - Botón "Descargar esta sesión en JSON"

## 6. FUNCIONALIDADES OBLIGATORIAS

### A. localStorage
- Guardar automáticamente cada sesión completada
- Clave: `gym_sessions`
- Array de `WorkoutSession[]`
- Al iniciar la app, cargar historial desde localStorage

### B. Exportación / Importación JSON
- **Exportar todo:** Botón que descarga `gym_data_YYYY-MM-DD.json` con TODO el historial
- **Exportar sesión individual:** Desde el resumen post-entreno
- **Importar:** Input file que permite cargar un JSON previo y mergear con el historial existente (evitar duplicados por `id`)

### C. Historial / Listado
- Lista de sesiones anteriores (fecha, día, ejercicios principales, peso máximo)
- Click en una sesión para ver detalle completo
- Opción de eliminar sesión

### D. Autosave durante el entreno
- Guardar en localStorage la sesión "en progreso" cada vez que completas una serie
- Si cierro el navegador y vuelvo, debo poder retomar donde estaba
- Clave: `gym_current_session`

### E. Pre-fill inteligente
- Al crear una nueva sesión de un día que ya he hecho antes, precargar los pesos de la última vez como valor por defecto (pero editable)
- Esto es CLAVE para no tener que recordar cuánto levanté la semana pasada

## 7. REGLAS DE UI/UX (Sin pereza - Obligatorio)

1. **Inputs numéricos nativos:** Usar `input type="number"` con step="0.5" para peso, step="1" para reps
2. **Botones táctiles grandes:** Mínimo 48x48px para todo click en móvil
3. **Dark mode por defecto:** Fondo oscuro, texto claro (menos deslumbrante en el gimnasio)
4. **Sin scroll innecesario:** Todo en una pantalla, o máximo 1 scroll por ejercicio
5. **Sin formularios complejos:** No pedir nombre de sesión, no pedir confirmaciones molestas
6. **Feedback inmediato:** Al completar una serie, sonido o vibración (si es posible) y color verde
7. **Keyboard friendly:** Si estoy en PC, poder navegar con Tab y Enter
8. **Offline first:** Debe funcionar sin internet una vez cargada

## 8. ESTRUCTURA DE CARPETAS SUGERIDA

```
src/app/
  core/
    models/
      workout.model.ts
    services/
      routine.service.ts        // Datos hardcoded de la rutina
      storage.service.ts        // localStorage CRUD
      export.service.ts         // Import/Export JSON
  features/
    dashboard/
      dashboard.component.ts    // Pantalla principal con botones de días
    workout/
      workout.component.ts      // Flujo de ejercicio activo
      set-input.component.ts    // Componente de una serie (peso/reps/rir)
    history/
      history.component.ts      // Listado de sesiones
      session-detail.component.ts
  shared/
    components/
      header.component.ts
```

## 9. REGLAS DE NEGOCIO (Lógica obligatoria)

- Una serie de aproximación NO cuenta como serie de trabajo (no se incluye en el progreso de peso máximo, pero sí se guarda)
- El peso máximo de un ejercicio en una sesión se calcula sobre las series de trabajo (isWarmup: false)
- Si el usuario abandona una sesión (no completa todos los ejercicios), guardarla como `completed: false` pero mantener los datos
- No permitir crear dos sesiones del mismo día sin completar la anterior (o preguntar si quiere retomar)

## 10. ANÁLISIS FUTURO (Preparación)

El JSON exportado debe tener una estructura que permita análisis posterior con Python/pandas o una app de IA. Por eso:
- Fechas en ISO 8601
- Pesos siempre en kg (números, no strings)
- RIR siempre número
- Evitar arrays anidados complejos que no sean fácilmente flattenables
- Incluir un campo `version: "1.0"` en el JSON exportado para futuras migraciones

## 11. CRITERIOS DE ACEPTACIÓN (Definition of Done)

- [ ] Puedo crear una sesión de Push, completar las 5 ejercicios con sus series, y guardar
- [ ] Los pesos de la última sesión se precargan en la siguiente
- [ ] Puedo exportar todo el historial a JSON y descargarlo
- [ ] Puedo importar un JSON y recuperar sesiones previas
- [ ] Si cierro el navegador a mitad de entreno, al volver me pregunta si quiero retomar
- [ ] Funciona perfectamente en móvil (Chrome Android/Safari iOS)
- [ ] Dark mode por defecto
- [ ] No hay errores de TypeScript, standalone components, signals usados para estado

## 12. EXTRAS (Si hay tiempo, nice to have)

- Timer de descanso entre series (botón "Descanso 90s" con cuenta atrás)
- Gráfico simple de progresión de peso en el ejercicio principal (Chart.js o SVG simple)
- Backup automático cada 5 minutos durante el entreno

---

GENERA EL CÓDIGO COMPLETO Y FUNCIONAL. Empieza por los modelos, luego el servicio de rutina hardcoded, luego el servicio de storage, y finalmente los componentes. No me des explicaciones largas, genera el código directamente.
```

---

## 💡 Consejo de uso

1. **Dividelo en 2 prompts si es necesario:** primero pide la estructura base (modelos + servicios + rutina hardcoded), y luego los componentes UI. Así no se desborda el contexto.
2. Si usas **Roo Code**, añade al final: `Modo: Code` para que no te dé explicaciones.
3. Si ves que genera NgModules en vez de standalone, corrige inmediatamente: **"Usa standalone components, sin NgModules"**.