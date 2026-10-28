# SkuadAI

Plugin de Claude Code para desarrollo guiado por specs con un equipo de roles:

- **arquitecto** (opus): planifica fases, escribe specs y responde dudas.
- **desarrollador** (sonnet): implementa una tarea por vez y **se detiene** ante desvíos o gaps, dejando la pregunta por escrito.
- **tester** (sonnet): verifica cada tarea contra los criterios de aceptación.

Todo el estado vive en archivos dentro del proyecto (`.skuadai/`). Así puedes reiniciar la sesión cuando quieras sin perder el hilo, y cada rol trabaja con contexto limpio.

## Instalación

Desde Claude Code, en cualquier computador:

```
/plugin marketplace add <tu-usuario>/skuadai
/plugin install skuadai@skuadai
```

Para probarlo localmente sin publicarlo:

```
claude --plugin-dir ./plugins/skuadai
```

Requiere Node.js (lo usan los hooks y el script de estado).

## Flujo

| Paso | Comando | Qué pasa |
|---|---|---|
| 1 | `/skuadai:iniciar [tipo] [descripción]` | Crea `.skuadai/`, eliges el tipo de proyecto, los roles y sus modelos. El arquitecto escribe `plan.md` y tú lo apruebas. |
| 2 | `/skuadai:nueva-fase 03 [objetivo]` | El arquitecto escribe la spec de la fase, dividida en tareas pequeñas. Tú la revisas y apruebas. |
| 3 | `/skuadai:implementar` | El orquestador lanza al desarrollador y al tester tarea por tarea. Se detiene si aparece una pregunta. |
| 4 | `/skuadai:preguntas` | Respondes tú o el arquitecto; la spec se actualiza. Vuelves al paso 3. |
| — | `/skuadai:estado` | Avance por fase y tokens por etapa y rol (USD equivalentes como referencia). |

## Tipos de proyecto

| Tipo | Cuándo | Qué contiene `plan.md` | Qué es una fase |
|---|---|---|---|
| `nuevo` | Se parte de cero | Fases planificadas de antemano | Una fase del plan |
| `en-curso` | Hay código y parte del plan hecho, pero no está terminado | "Estado actual" verificado contra el código y las fases hechas y pendientes | Una fase pendiente |
| `mantenimiento` | El proyecto está terminado y llegan solicitudes sueltas | Mapa del sistema y backlog `- [ ] S-001 …` | Una solicitud, con cambios acotados y sin romper los tests existentes |
| `migracion` | Una solución que funciona se lleva a una plataforma o arquitectura más moderna, sin cambios funcionales | Origen y destino, y las fases tomadas de las etapas de `.skuadai/runbook.md` | Una etapa del runbook, o una ola de migración |

**Migración.** `iniciar migracion` crea `.skuadai/runbook.md` con un runbook por defecto de 10 etapas, cada una con criterios de salida: inventario, línea base funcional, diseño y mapeo, plataforma destino, olas, datos, equivalencia, corte y rollback, estabilización y retiro. Si tienes un runbook propio, reemplaza ese archivo y el arquitecto planifica sobre él.

La regla central es la **equivalencia funcional**:
- Cada spec trae un mapeo origen → destino y una forma de demostrar la equivalencia, normalmente con tests de caracterización.
- El desarrollador no mejora ni corrige el comportamiento del origen.
- Toda diferencia de comportamiento queda como pregunta de tipo `diferencia funcional` y la decides tú.

El tipo queda en `config.json` (`tipo`). `/skuadai:estado` muestra las solicitudes pendientes cuando el proyecto está en mantenimiento.

En mantenimiento, el backlog (`## Solicitudes`) tiene solo lo que pide el usuario. Lo que el arquitecto detecta por su cuenta queda en `## Sugerencias del arquitecto (no aprobadas)` (`G-xxx`) hasta que el usuario lo acepta.

## Skills, MCP y CLAUDE.md

Los roles heredan las herramientas de la sesión principal, incluidos los MCP y la herramienta Skill, así que pueden usar las skills globales, las del proyecto y las de plugins. El `CLAUDE.md` del proyecto se carga solo. El arquitecto no tiene `Bash`.

- **Skills de un rol:** para que un rol siempre use ciertas skills, agrégalas a `roles.<rol>.skills` en `config.json`; el rol las invoca al empezar.
- **Acciones externas:** los roles pueden consultar libremente por MCP, pero solo hacen acciones con efecto externo (escribir en Jira, enviar mensajes, desplegar) si la tarea lo pide.
- **Lo que no pueden hacer:** los subagentes no pueden preguntarte directamente; dejan sus dudas en `preguntas.md`.

## Estructura en cada proyecto

```
.skuadai/
├── config.json          roles → modelo, reglas, presupuesto, tabla de precios
├── plan.md              plan de fases
├── fases/fase-03/
│   ├── spec.md          lo que hay que construir, con tareas T-01…
│   ├── preguntas.md     desvíos y gaps; una [abierta] detiene su tarea
│   └── progreso.md      archivo de traspaso entre sesiones
└── costos/sesiones/     un JSON por sesión con tokens y USD por modelo
```

Conviene versionar `.skuadai/` salvo `costos/`, si no quieres compartirlo.

## Cómo se evita la sobrecarga de contexto

1. **Subagentes:** cada tarea la hace un subagente que arranca con contexto vacío y devuelve solo un resumen.
2. **Archivo de traspaso:** el desarrollador y el tester actualizan `progreso.md` al terminar cada tarea.
3. **Hook `SessionStart`:** al abrir, reanudar, limpiar (`/clear`) o compactar una sesión, inyecta la fase activa, las preguntas abiertas y `progreso.md`.
4. **Corte cada 3 tareas:** `/skuadai:implementar` se detiene y sugiere `/clear` + `/skuadai:implementar` para seguir con contexto limpio.

## Costos

No hace falta una API key. Los hooks `Stop` y `SubagentStop` leen las transcripciones locales de la sesión y de sus subagentes, y guardan los tokens **por etapa y por rol**. La sesión principal cuenta como `orquestador`. Lo nuevo de cada transcripción se asigna a la fase activa en ese momento.

`/skuadai:estado [fase]` muestra una tabla por etapa, con una fila por rol y el total de la etapa. Las columnas son:
- **Entrada:** tokens nuevos de entrada.
- **Caché escr.** y **Caché lect.:** contexto que se guarda en caché y que se relee en cada llamada.
- **Salida:** tokens generados, con los de razonamiento entre paréntesis.
- **Total:** la suma de las anteriores.
- **Llamadas:** cuántas veces se llamó al modelo.
- **Contexto máx.:** el tamaño del contexto más grande que alcanzó el rol.

Debajo de cada tabla aparecen las herramientas que usó cada rol.

La columna **USD eq.** usa la tabla `precios` de `config.json`, con las tarifas de la API de Anthropic. Con Pro o Max no pagas por token: es solo una referencia para comparar. Puedes fijar un tope de aviso en tokens (`presupuestoTokens`) o en USD equivalentes (`presupuestoUSD`).

Las transcripciones no registran cómo se reparte el contexto entre system prompt, herramientas, MCP o skills, así que ese desglose no está disponible.

## Pendiente (ideas para siguientes versiones)

- Más roles (UX/UI, revisor de seguridad) definidos desde `config.json`.
- Dashboard HTML de costos y avance.
- Modo automático con `claude -p` por tarea para un reinicio total entre tareas.
- **TODO: motor externo para el desarrollador (Codex).** Agregar una opción experimental, `roles.desarrollador.motor: "codex"`. Con ella, un rol envoltorio liviano (haiku) arma el encargo con la tarea de la spec y las reglas de SkuadAI y llama a `codex exec`. Después verifica el resultado con tests y diff y actualiza `progreso.md`. Alternativa: registrar Codex como servidor MCP, según la versión de la CLI.
  - **Costos:** el consumo de Codex va a la cuenta de OpenAI y `estado` no lo cuenta.
  - **Reglas:** la regla de detención y la de equivalencia funcional las controla el envoltorio.
  - **Datos:** confirmar la política de la organización antes de enviar código a OpenAI.
- **TODO: escalamiento automático a Opus.** Cuando una tarea termina `FALLIDA` o el tester la marca `CON FALLAS` dos veces con el modelo del desarrollador, reintentarla con Opus y anotarlo en `progreso.md`.
