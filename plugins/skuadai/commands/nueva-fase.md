---
description: Crea una fase y hace que el arquitecto escriba su spec
argument-hint: "<id de fase, ej. 03> [qué debe lograr la fase]"
---
Argumentos: `$ARGUMENTS` (el primer término es el id de la fase; el resto, la descripción).

1. Crea la carpeta de la fase con el script del plugin (ruta en "SkuadAI plugin root" del contexto, o `${CLAUDE_PLUGIN_ROOT}`):
   ```
   node "<plugin root>/scripts/skuadai.js" fase <id>
   ```
   Esto crea `.skuadai/fases/fase-<id>/` con `spec.md`, `preguntas.md` y `progreso.md`, y la marca como `faseActiva` en `config.json`.

2. Lanza el subagente **arquitecto** con el modelo de `roles.arquitecto.modelo` en `.skuadai/config.json`. Pásale:
   - El id de la fase y la descripción del usuario.
   - Lo que dice `.skuadai/plan.md` sobre esta fase.
   - La instrucción de escribir `spec.md` completa (con tareas T-01, T-02… pequeñas) y llenar la tabla de tareas de `progreso.md`.

3. Muestra al usuario el resumen del arquitecto, el objetivo, la lista de tareas y las dudas abiertas. No pegues la spec entera.

4. Pide al usuario que la revise. Cuando la apruebe, cambia "Estado" en `spec.md` a `aprobada` y sugiere `/skuadai:implementar`.
