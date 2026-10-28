# Runbook de migración — {{proyecto}}

> Runbook por defecto de SkuadAI. Si tu organización tiene uno propio, reemplaza este archivo con él: el arquitecto planifica las fases a partir de las etapas que encuentre aquí.

**Regla central:** la migración no cambia el comportamiento funcional. Con las mismas entradas, el sistema destino produce las mismas salidas, efectos y errores que el origen, incluidos los defectos conocidos. Cualquier diferencia funcional es una decisión del usuario, no del equipo. Las mejoras detectadas se anotan como sugerencias y se hacen después de la migración.

Cada etapa tiene criterios de salida. No se pasa a la siguiente sin cumplirlos o sin una excepción aprobada por el usuario.

## E1. Inventario del origen
Qué componentes, interfaces (APIs, colas, archivos, pantallas), datos, dependencias externas, configuraciones y tareas programadas hay en el alcance.
- **Salida:** inventario con rutas reales y una lista de dudas. Queda acordado qué está dentro y qué fuera del alcance.

## E2. Línea base funcional
Capturar el comportamiento actual antes de tocar nada. Se hace con tests de caracterización o de aprobación: entradas reales o representativas y sus salidas tal como el origen las produce hoy, incluidos los casos de error.
- **Salida:** una suite de equivalencia que corre contra el origen y pasa. Su cobertura de las interfaces del inventario queda documentada.

## E3. Diseño del destino y mapeo
Arquitectura destino y el mapeo de cada componente del origen a su equivalente, con las decisiones técnicas y lo que no tiene equivalente directo.
- **Salida:** una tabla de mapeo origen → destino aprobada, con los riesgos y las decisiones del usuario registrados.

## E4. Preparación de la plataforma destino
Estructura del proyecto, build, CI, entornos, configuración y secretos (sin valores en el repositorio), observabilidad mínima.
- **Salida:** un "hola mundo" desplegable en el destino, con la suite de equivalencia ejecutable contra él.

## E5. Migración por olas
Migrar en olas pequeñas (un módulo, servicio o flujo por ola), en el orden de dependencias del mapeo. Cada ola es una fase.
- **Salida de cada ola:** la suite de equivalencia de esa ola pasa contra el destino y las diferencias quedan en cero o aprobadas.

## E6. Migración de datos (si aplica)
Scripts de extracción, transformación y carga, idempotentes y repetibles, con conciliación: conteos, sumas de control y muestreo.
- **Salida:** conciliación sin diferencias en un ensayo completo, con tiempo de ejecución medido.

## E7. Verificación de equivalencia completa
Suite de equivalencia completa contra el destino. Si se puede, una ejecución en paralelo (origen y destino con el mismo tráfico o lote) y la comparación de resultados. Revisión de rendimiento y de aspectos no funcionales acordados.
- **Salida:** un informe de equivalencia sin diferencias abiertas.

## E8. Plan de corte y vuelta atrás
Pasos del corte, responsables, ventana, verificación posterior y criterio y procedimiento de rollback, ensayado.
- **Salida:** el plan aprobado por el usuario y un ensayo de rollback exitoso.

## E9. Corte y estabilización
Ejecución del corte según el plan y monitoreo intensivo durante el periodo acordado. El equipo prepara y verifica; las acciones en producción las ejecuta o autoriza el usuario.
- **Salida:** el sistema destino en operación y el periodo de estabilización cerrado sin incidentes abiertos.

## E10. Retiro del origen
Apagado ordenado del origen, archivo de datos según la política vigente y actualización de la documentación.
- **Salida:** el origen retirado y la documentación al día.
