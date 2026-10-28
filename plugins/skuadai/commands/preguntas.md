---
description: Revisa las preguntas abiertas de la fase y las resuelve con el arquitecto y contigo
argument-hint: "[id de fase]"
---
Fase indicada por el usuario (puede venir vacía): «$ARGUMENTS». Si está vacía, usa `faseActiva` de `.skuadai/config.json`.

1. Lee `preguntas.md` de la fase y lista las entradas `[abierta]`: número, tarea, tipo y la pregunta en una línea.
2. Si no hay ninguna, dilo y sugiere `/skuadai:implementar`.
3. Pregunta al usuario cómo quiere resolverlas:
   - **Él responde directamente:** escribe su respuesta en la sección "Respuesta" de la entrada, con sus palabras, y márcala `[respondida]`.
   - **Que responda el arquitecto:** lanza el subagente **arquitecto** (modelo de `roles.arquitecto.modelo`) con los números de pregunta y cualquier indicación del usuario. El arquitecto responde, actualiza la spec si hace falta y deja `[abierta]` lo que sea decisión del usuario.
4. Muestra qué quedó respondido, qué cambió en la spec y qué sigue abierto.
5. Si no queda nada abierto, sugiere `/skuadai:implementar`.
