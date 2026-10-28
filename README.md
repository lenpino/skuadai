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
| 1 | `/skuadai:iniciar [descripción]` | Crea `.skuadai/`, eliges roles y modelos, y el arquitecto escribe `plan.md`. |
| 2 | `/skuadai:nueva-fase 03 [objetivo]` | El arquitecto escribe la spec de la fase, dividida en tareas pequeñas. Tú la revisas y apruebas. |
| 3 | `/skuadai:implementar` | El orquestador lanza al desarrollador y al tester tarea por tarea. Se detiene si aparece una pregunta. |
| 4 | `/skuadai:preguntas` | Respondes tú o el arquitecto; la spec se actualiza. Vuelves al paso 3. |
| — | `/skuadai:estado` | Avance por fase y costo estimado por modelo y por fase. |

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

Los hooks `Stop` y `SubagentStop` leen la transcripción de la sesión (incluidas las de subagentes) y guardan los tokens por modelo. El costo en USD se calcula con la tabla `precios` de `config.json` (tarifas de la API de Anthropic, por millón de tokens). Con una suscripción Pro o Max no pagas por token: el número sirve como medida de uso equivalente.

## Pendiente (ideas para siguientes versiones)

- Más roles (UX/UI, revisor de seguridad) definidos desde `config.json`.
- Dashboard HTML de costos y avance.
- Modo automático con `claude -p` por tarea para un reinicio total entre tareas.
