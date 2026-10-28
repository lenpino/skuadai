---
description: Muestra el avance de las fases y los tokens consumidos por etapa y por rol
argument-hint: "[id de fase]"
---
Fase indicada por el usuario (puede venir vacía): «$ARGUMENTS». Vacía = todas las etapas.

1. Ejecuta el script del plugin (ruta en "SkuadAI plugin root" del contexto, o `${CLAUDE_PLUGIN_ROOT}`):
   ```
   node "<plugin root>/scripts/skuadai.js" estado [fase]
   ```
2. Muestra su salida tal cual. Agrega, en una o dos líneas, el estado de la fase activa según su `progreso.md` (tareas hechas y pendientes, bloqueos).
3. Si hay un tope (`presupuestoTokens` o `presupuestoUSD`) y se superó el 80 %, avísalo al principio.
