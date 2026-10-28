---
description: Crea una fase (o, en mantenimiento, una solicitud) y hace que el arquitecto escriba su spec
argument-hint: "<id de fase, ej. 03> [qué debe lograr la fase o la solicitud]"
---
Argumentos que el usuario escribió junto al comando (pueden venir vacíos): «$ARGUMENTS»
El primer término es el id de la fase y el resto, la descripción.

Lee `tipo` en `.skuadai/config.json`. Si no está definido, pregúntale al usuario cuál es (`nuevo`, `en-curso`, `mantenimiento` o `migracion`) y guárdalo ahí.

**Si falta el id:** propón el siguiente número según las fases existentes en `.skuadai/fases/` y `plan.md`, y confírmalo con el usuario.

**Si falta la descripción:**
- **nuevo**, **en-curso** o **migracion**: usa lo que dice `plan.md` sobre esa fase y pregunta si quiere agregar algo.
- **mantenimiento**: muestra las solicitudes pendientes (`- [ ] S-xxx`) de `plan.md` y pregunta cuál trabajar, o cuál es la solicitud nueva. Si elige una sugerencia del arquitecto (G-xxx), muévela primero a `## Solicitudes` como S-xxx: elegirla cuenta como aceptarla.

1. Crea la carpeta de la fase con el script del plugin (ruta en "SkuadAI plugin root" del contexto, o `${CLAUDE_PLUGIN_ROOT}`):
   ```
   node "<plugin root>/scripts/skuadai.js" fase <id>
   ```
   Esto crea `.skuadai/fases/fase-<id>/` con `spec.md`, `preguntas.md` y `progreso.md`, y la marca como `faseActiva` en `config.json`.

2. Lanza el subagente **arquitecto** con el modelo de `roles.arquitecto.modelo`. Pásale:
   - El tipo de proyecto, el id de la fase y la descripción del usuario.
   - Lo que dice `.skuadai/plan.md` sobre esta fase o solicitud.
   - La instrucción de escribir `spec.md` completa, con tareas T-01, T-02… pequeñas, y de llenar la tabla de tareas de `progreso.md`.
   - En **mantenimiento**: si la solicitud no está en el backlog de `plan.md`, que la agregue con el siguiente S-xxx. En los dos casos, que la anote como `(fase <id>)`.
   - En **mantenimiento**, además: la spec debe ser acotada al cambio pedido, sin rediseñar lo que ya funciona. Debe incluir como criterio que los tests existentes sigan pasando.
   - En **migracion**: la etapa del runbook (`.skuadai/runbook.md`) que corresponde a la fase, con sus criterios de salida, y la instrucción de incluir el mapeo origen → destino de lo que se migra en la fase y criterios de equivalencia funcional.

3. Muestra al usuario el resumen del arquitecto: el objetivo, la lista de tareas y las dudas abiertas. No pegues la spec entera.

4. Pide al usuario que la revise. Cuando la apruebe, cambia "Estado" en `spec.md` a `aprobada` y sugiere `/skuadai:implementar`.
