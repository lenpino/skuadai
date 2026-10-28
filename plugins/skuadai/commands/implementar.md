---
description: Implementa las tareas pendientes de una fase, una por vez, con subagentes de contexto limpio
argument-hint: "[id de fase] [T-xx]"
---
Argumentos que el usuario escribió junto al comando (pueden venir vacíos): «$ARGUMENTS»
Son opcionales: un id de fase y una tarea concreta (T-xx). Sin fase, usa `faseActiva` de `.skuadai/config.json`; sin tarea, la siguiente pendiente.

Eres el **orquestador**. Tu trabajo es coordinar, no implementar: no leas ni edites código tú mismo. Así esta sesión se mantiene liviana y cada rol trabaja con contexto limpio.

## Preparación
1. Lee `.skuadai/config.json`, y de la fase: `progreso.md` y `preguntas.md`. De `spec.md`, solo la lista de tareas.
2. Si `spec.md` no está `aprobada`, pregunta al usuario si quiere seguir igual.
3. Si hay preguntas `[abierta]`, muéstralas en resumen y detente: el siguiente paso es `/skuadai:preguntas`.

## Ciclo (una tarea por vez)
Elige la tarea indicada o la siguiente `pendiente` cuyas dependencias estén terminadas. Luego:

1. Lanza el subagente **desarrollador** con el modelo de `roles.desarrollador.modelo`. Pásale solo la ruta de la fase y el id de la tarea; él lee los archivos.
2. Según su respuesta:
   - `DETENIDA (P-xxx)`: muestra la pregunta al usuario en dos o tres líneas y **detén el ciclo**.
   - `FALLIDA`: muestra el motivo y detén el ciclo.
   - `TERMINADA`: si `roles.tester.activo`, lanza el subagente **tester** (modelo de `roles.tester.modelo`) para esa tarea.
3. Si el tester responde `CON FALLAS`, relanza al desarrollador una vez con el detalle de las fallas. Si vuelve a fallar, detén el ciclo y avisa.
4. Informa en una línea: `T-xx ✓` (o su estado) y pasa a la siguiente tarea.

## Higiene de contexto (el "reinicio")
- Después de **3 tareas** en esta sesión, o si notas que el contexto creció mucho, detén el ciclo aunque queden tareas. Dile al usuario que ejecute `/clear` y luego `/skuadai:implementar` para continuar con contexto limpio: todo el estado está en `progreso.md`.
- Al terminar todas las tareas, pide al arquitecto una revisión final de los criterios de aceptación de la fase y muestra el resultado. Si la fase queda aceptada, el arquitecto la marca como hecha en `plan.md`. En mantenimiento, eso significa marcar la solicitud `- [x] S-xxx … (fase <id>)`.

Termina siempre con: tareas hechas en esta sesión, tareas pendientes y el siguiente comando sugerido.
