---
description: Muestra el avance de las fases y el costo estimado por modelo y por fase
---
1. Ejecuta el script del plugin (ruta en "SkuadAI plugin root" del contexto, o `${CLAUDE_PLUGIN_ROOT}`):
   ```
   node "<plugin root>/scripts/skuadai.js" estado
   ```
2. Muestra su salida tal cual. Agrega, en una o dos líneas, el estado de la fase activa según su `progreso.md` (tareas hechas y pendientes, bloqueos).
3. Si hay presupuesto y se superó el 80%, avísalo al principio.
