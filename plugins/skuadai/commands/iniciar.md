---
description: Prepara el proyecto actual para SkuadAI (carpeta .skuadai, roles, modelos y plan de fases)
argument-hint: "[descripción breve del proyecto]"
---
Vas a preparar este proyecto para trabajar con SkuadAI.

1. Ejecuta el script de inicio del plugin. Su ruta aparece en el contexto de inicio de sesión como "SkuadAI plugin root"; si no la ves, prueba con `${CLAUDE_PLUGIN_ROOT}`:
   ```
   node "<plugin root>/scripts/skuadai.js" iniciar
   ```
   Crea `.skuadai/` con `config.json`, `plan.md`, `fases/` y `costos/`. Si ya existía, no sobrescribe nada.

2. Muestra al usuario los roles y modelos de `.skuadai/config.json` y pregúntale si quiere cambiar algo (activar o desactivar roles, modelo de cada rol: `fable`, `opus`, `sonnet` o `haiku`, y un presupuesto opcional en USD). Aplica los cambios en el archivo.

3. Si el usuario dio una descripción del proyecto (`$ARGUMENTS`) o ya existe un plan de trabajo en otro lado, lanza el subagente **arquitecto** (con el modelo de `roles.arquitecto.modelo`) para que escriba `.skuadai/plan.md`: lista de fases numeradas, cada una con objetivo de una línea y dependencias. Si no hay descripción, pídela antes.

4. Termina con un resumen corto y el siguiente paso: `/skuadai:nueva-fase 01`.
