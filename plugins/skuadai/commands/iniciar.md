---
description: Prepara el proyecto actual para SkuadAI (carpeta .skuadai, tipo de proyecto, roles, modelos y plan)
argument-hint: "[nuevo|en-curso|mantenimiento|migracion] [descripción breve del proyecto]"
---
Vas a preparar este proyecto para trabajar con SkuadAI.

Argumentos que el usuario escribió junto al comando (pueden venir vacíos): «$ARGUMENTS»
Si el primer término es `nuevo`, `en-curso`, `mantenimiento` o `migracion`, es el tipo de proyecto; el resto es la descripción.

1. **Tipo de proyecto.** Si no vino en los argumentos, pregúntalo antes de todo. Si el directorio ya tiene código, menciónalo como pista, pero la decisión es del usuario:
   - **nuevo**: se parte de cero, o casi; el trabajo se organiza en fases planificadas de antemano.
   - **en-curso**: ya hay código y parte del plan está hecha, pero el proyecto no está terminado; quedan fases por completar.
   - **mantenimiento**: el proyecto está terminado; el trabajo llega como solicitudes sueltas (bugs, ajustes, mejoras pequeñas).
   - **migracion**: una solución que ya funciona, completa o en parte, se lleva a una plataforma o arquitectura más moderna **sin cambios funcionales**. Sigue las etapas de un runbook.

2. Ejecuta el script de inicio del plugin con el tipo. Su ruta aparece en el contexto de inicio de sesión como "SkuadAI plugin root"; si no la ves, prueba con `${CLAUDE_PLUGIN_ROOT}`:
   ```
   node "<plugin root>/scripts/skuadai.js" iniciar <tipo>
   ```
   Crea `.skuadai/` con `config.json` (con `tipo`), `fases/` y `costos/`. Si ya existía, solo actualiza `tipo`; no sobrescribe nada más. En **migracion** también crea `.skuadai/runbook.md` con el runbook por defecto, si no existe. El `plan.md` lo escribe el arquitecto en el paso 4.

3. Muestra al usuario los roles y modelos de `.skuadai/config.json` y pregúntale si quiere cambiar algo: activar o desactivar roles, el modelo de cada rol (`fable`, `opus`, `sonnet` o `haiku`) y un tope de consumo opcional. Aplica los cambios en el archivo.
   Al ofrecer el tope, explica que **no se cobra nada ni hace falta una API key**: SkuadAI cuenta los tokens que usa tu cuenta (Pro, Max o API) leyendo las transcripciones locales. El tope es solo un aviso en `/skuadai:estado`. Puede ser en tokens (`presupuestoTokens`) o en USD equivalentes a la API (`presupuestoUSD`).

4. Consigue la información para el plan según el tipo. Usa la descripción de los argumentos si la hay; si no, pídela:
   - **nuevo**: qué debe lograr el proyecto. Si ya tiene un plan en otro lado, que lo pegue.
   - **en-curso**: qué debe lograr, qué cree que ya está hecho y el plan original si lo tiene (que lo pegue o indique el archivo).
   - **mantenimiento**: las solicitudes que ya tiene pendientes, si hay alguna. Puede no haber ninguna todavía. Solo lo que el usuario pida entra al backlog `## Solicitudes`. Lo que el arquitecto detecte por su cuenta queda en `## Sugerencias del arquitecto (no aprobadas)`.

   - **migracion**: pide lo siguiente.
     - Qué se migra: el sistema completo o una parte, y dónde está el código de origen. Puede estar en otra carpeta o repositorio; anota su ruta en el plan.
     - La plataforma o arquitectura destino, y dónde va el código nuevo.
     - Restricciones: ventana de corte, convivencia de origen y destino, datos.
     - **El runbook:** si el usuario o su organización tiene uno, que lo pegue o indique el archivo, y reemplaza `.skuadai/runbook.md` con él. Si no, se usa el que dejó el script; muéstrale sus etapas en una línea cada una y pregúntale si quiere ajustarlas.

   Con eso, lanza el subagente **arquitecto** con el modelo de `roles.arquitecto.modelo`. Pásale el tipo y lo que dio el usuario, para que escriba `.skuadai/plan.md` con el formato de ese tipo. Si `plan.md` ya existe, el arquitecto lo actualiza en vez de reemplazarlo.

5. **Aprobación del plan.** Muestra un resumen: las fases con su estado, o las solicitudes en mantenimiento, y las dudas que dejó el arquitecto. No pegues el plan entero. Pide al usuario que lo revise:
   - Si pide cambios, vuelve a lanzar al arquitecto con ellos.
   - Cuando lo apruebe, cambia "Estado" en `plan.md` a `aprobado`.
   - En **mantenimiento** no hace falta aprobar el backlog completo: cada solicitud se aprueba con su spec, en `nueva-fase`. Muestra las solicitudes y, aparte, las sugerencias del arquitecto, aclarando que son propuestas. Pregunta cuáles acepta: las aceptadas se mueven a `## Solicitudes` con el siguiente S-xxx; las otras quedan como sugerencias o se borran, según diga el usuario.

6. Termina con un resumen corto y el siguiente paso:
   - **nuevo**: `/skuadai:nueva-fase 01`.
   - **en-curso**: `/skuadai:nueva-fase <id>` con la primera fase pendiente del plan.
   - **migracion**: `/skuadai:nueva-fase 01`, que corresponde a la primera etapa del runbook (inventario del origen).
   - **mantenimiento**: `/skuadai:nueva-fase <id> <solicitud>` para la primera solicitud. Si no hay ninguna, explica que cada solicitud nueva se registra y se trabaja con ese mismo comando.
