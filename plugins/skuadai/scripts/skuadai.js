#!/usr/bin/env node
// SkuadAI: utilidades del plugin (estructura del proyecto, hooks y costos).
// Uso:
//   node skuadai.js iniciar [tipo]     crea .skuadai/ en el directorio actual
//                                      (tipo: nuevo | en-curso | mantenimiento)
//   node skuadai.js fase <id>          crea .skuadai/fases/fase-<id>/ y la marca activa
//   node skuadai.js estado [fase]      avance por fase y tokens por etapa y rol
//   node skuadai.js hook-inicio        hook SessionStart (lee JSON por stdin)
//   node skuadai.js hook-costo         hook Stop / SubagentStop (lee JSON por stdin)

const fs = require("fs");
const path = require("path");

const PLUGIN_ROOT = path.resolve(__dirname, "..");
const TEMPLATES = path.join(PLUGIN_ROOT, "templates");
const MAX_PROGRESO = 6000;
const TIPOS = ["nuevo", "en-curso", "mantenimiento"];

// ---------- utilidades ----------

function leerJSON(file, porDefecto) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return porDefecto;
  }
}

function escribirJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

function leerStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

// Busca .skuadai/ subiendo desde dir.
function buscarRaiz(dir) {
  let actual = path.resolve(dir || process.cwd());
  while (true) {
    if (fs.existsSync(path.join(actual, ".skuadai", "config.json"))) return actual;
    const padre = path.dirname(actual);
    if (padre === actual) return null;
    actual = padre;
  }
}

function rutas(raiz) {
  const base = path.join(raiz, ".skuadai");
  return {
    base,
    config: path.join(base, "config.json"),
    plan: path.join(base, "plan.md"),
    fases: path.join(base, "fases"),
    sesiones: path.join(base, "costos", "sesiones"),
  };
}

function copiarPlantilla(nombre, destino, vars) {
  if (fs.existsSync(destino)) return false;
  let texto = fs.readFileSync(path.join(TEMPLATES, nombre), "utf8");
  for (const [k, v] of Object.entries(vars || {})) texto = texto.split(`{{${k}}}`).join(v);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, texto);
  return true;
}

function preguntasAbiertas(archivo) {
  if (!fs.existsSync(archivo)) return [];
  // Ignora los bloques ``` (el formato de ejemplo de la plantilla).
  let enBloque = false;
  return fs
    .readFileSync(archivo, "utf8")
    .split(/\r?\n/)
    .filter((l) => {
      if (l.startsWith("```")) enBloque = !enBloque;
      return !enBloque && /^## P-\d+ \[abierta\]/.test(l);
    })
    .map((l) => l.replace(/^## /, ""));
}

// Cuenta estados de la tabla "| T-xx | estado | notas |" de progreso.md.
function resumenTareas(archivo) {
  const conteo = {};
  if (!fs.existsSync(archivo)) return conteo;
  for (const l of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\|\s*T-\d+\s*\|\s*([^|]+?)\s*\|/);
    if (m) conteo[m[1]] = (conteo[m[1]] || 0) + 1;
  }
  return conteo;
}

// Backlog de mantenimiento en plan.md: "- [ ] S-001 …" pendiente, "- [x] S-001 …" hecha.
function solicitudesPendientes(archivo) {
  if (!fs.existsSync(archivo)) return [];
  return fs
    .readFileSync(archivo, "utf8")
    .split(/\r?\n/)
    .filter((l) => /^\s*- \[ \] S-\d+/.test(l))
    .map((l) => l.replace(/^\s*- \[ \] /, ""));
}

// ---------- comandos ----------

function iniciar(tipo) {
  if (tipo && !TIPOS.includes(tipo)) {
    console.error(`Tipo desconocido: ${tipo}. Usa: ${TIPOS.join(" | ")}`);
    process.exit(1);
  }
  const raiz = process.cwd();
  const r = rutas(raiz);
  const creados = [];
  if (!fs.existsSync(r.config)) {
    const config = leerJSON(path.join(TEMPLATES, "config.json"), {});
    config.proyecto = path.basename(raiz);
    if (tipo) config.tipo = tipo;
    escribirJSON(r.config, config);
    creados.push(".skuadai/config.json");
  } else if (tipo) {
    // Fijar el tipo es lo único que se cambia en un proyecto ya iniciado.
    const config = leerJSON(r.config, {});
    config.tipo = tipo;
    escribirJSON(r.config, config);
  }
  fs.mkdirSync(r.fases, { recursive: true });
  fs.mkdirSync(r.sesiones, { recursive: true });
  console.log(creados.length ? `Creado: ${creados.join(", ")}` : "SkuadAI ya estaba iniciado en este proyecto; no se sobrescribió nada.");
  console.log(`Raíz: ${raiz}`);
  console.log(`Tipo: ${leerJSON(r.config, {}).tipo || "sin definir (pregúntalo al usuario)"}`);
  console.log(fs.existsSync(r.plan) ? "plan.md: ya existe." : "plan.md: pendiente (lo escribe el arquitecto).");
}

function crearFase(id) {
  if (!id) {
    console.error("Falta el id de la fase. Ejemplo: node skuadai.js fase 03");
    process.exit(1);
  }
  const raiz = buscarRaiz();
  if (!raiz) {
    console.error("No hay .skuadai/ en este proyecto. Ejecuta primero /skuadai:iniciar.");
    process.exit(1);
  }
  const r = rutas(raiz);
  const dir = path.join(r.fases, `fase-${id}`);
  const vars = { fase: id, titulo: "(por definir)" };
  const creados = ["spec.md", "preguntas.md", "progreso.md"].filter((f) => copiarPlantilla(f, path.join(dir, f), vars));
  const config = leerJSON(r.config, {});
  config.faseActiva = id;
  escribirJSON(r.config, config);
  console.log(`Fase ${id}: ${path.relative(raiz, dir)}`);
  console.log(creados.length ? `Creado: ${creados.join(", ")}` : "La fase ya existía; no se sobrescribió nada.");
  console.log(`faseActiva = ${id}`);
}

// ---------- costos ----------
//
// Cada sesión guarda .skuadai/costos/sesiones/<id>.json con los tokens por fase y por rol:
//   porFase[fase][rol] = { modelos: { <modelo>: tokens }, herramientas: { Read: 3 }, contextoMax }
// La sesión principal es el rol "orquestador"; cada subagente aporta su rol (arquitecto, desarrollador…).
// Las transcripciones solo crecen: se guarda por archivo cuántas líneas ya se leyeron, y lo nuevo
// se asigna a la fase activa en ese momento.

const CAMPOS = ["input", "cacheWrite", "cacheRead", "output", "thinking", "llamadas"];
const SIN_FASE = "(sin fase)";

// Precio por familia (opus, sonnet…). Un ID exacto en la tabla, si existe, tiene prioridad.
function precioDe(modelo, precios) {
  if (precios[modelo] && typeof precios[modelo] === "object") return precios[modelo];
  for (const familia of ["fable", "mythos", "opus", "sonnet", "haiku"]) {
    if (modelo.includes(familia)) return precios[familia] || (familia === "mythos" ? precios.fable : null) || null;
  }
  return null;
}

function usdDe(modelo, t, precios) {
  const p = precioDe(modelo, precios);
  return p ? (t.input * p.input + t.output * p.output + t.cacheWrite * p.cacheWrite + t.cacheRead * p.cacheRead) / 1e6 : 0;
}

const totalTokens = (t) => t.input + t.cacheWrite + t.cacheRead + t.output;

function statsVacias() {
  return { modelos: {}, herramientas: {}, contextoMax: 0 };
}

// Suma a `destino` (stats) los mensajes nuevos de un archivo de transcripción.
function sumarArchivo(file, cursor, destino) {
  let lineas;
  try {
    lineas = fs.readFileSync(file, "utf8").split(/\r?\n/);
  } catch {
    return;
  }
  // La última línea puede estar a medio escribir: se deja para la próxima vez.
  const hasta = lineas.length - 1;
  const vistos = new Set(cursor.ultimosIds || []);
  for (let i = cursor.lineas || 0; i < hasta; i++) {
    const linea = lineas[i];
    if (!linea.includes('"usage"')) continue;
    let obj;
    try {
      obj = JSON.parse(linea);
    } catch {
      continue;
    }
    const msg = obj.message;
    if (obj.type !== "assistant" || !msg || !msg.usage || !msg.model || msg.model.startsWith("<")) continue;
    // Un mismo mensaje puede aparecer en varias líneas (un bloque de contenido por línea).
    const clave = msg.id || obj.uuid;
    for (const b of msg.content || []) {
      if (b.type === "tool_use") destino.herramientas[b.name] = (destino.herramientas[b.name] || 0) + 1;
    }
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const u = msg.usage;
    const t = (destino.modelos[msg.model] = destino.modelos[msg.model] || Object.fromEntries(CAMPOS.map((c) => [c, 0])));
    t.input += u.input_tokens || 0;
    t.cacheWrite += u.cache_creation_input_tokens || 0;
    t.cacheRead += u.cache_read_input_tokens || 0;
    t.output += u.output_tokens || 0;
    t.thinking += (u.output_tokens_details && u.output_tokens_details.thinking_tokens) || 0;
    t.llamadas += 1;
    const contexto = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
    destino.contextoMax = Math.max(destino.contextoMax, contexto);
  }
  cursor.lineas = hasta;
  cursor.ultimosIds = [...vistos].slice(-50);
}

function mezclar(destino, origen) {
  for (const [m, t] of Object.entries(origen.modelos)) {
    const d = (destino.modelos[m] = destino.modelos[m] || Object.fromEntries(CAMPOS.map((c) => [c, 0])));
    for (const c of CAMPOS) d[c] += t[c] || 0;
  }
  for (const [h, n] of Object.entries(origen.herramientas)) destino.herramientas[h] = (destino.herramientas[h] || 0) + n;
  destino.contextoMax = Math.max(destino.contextoMax || 0, origen.contextoMax || 0);
}

// Transcripciones de subagentes: <dir>/<sesión>/subagents/agent-<id>.jsonl, con su rol en agent-<id>.meta.json.
function subagentes(transcript) {
  const dir = path.join(path.dirname(transcript), path.basename(transcript, ".jsonl"), "subagents");
  let archivos = [];
  try {
    archivos = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  } catch {}
  return archivos.map((f) => {
    const meta = leerJSON(path.join(dir, f.replace(/\.jsonl$/, ".meta.json")), {});
    const rol = (meta.agentType || "subagente").replace(/^skuadai:/, "");
    return { archivo: path.join(dir, f), rol };
  });
}

function hookCosto() {
  const entrada = leerStdin();
  const raiz = buscarRaiz(entrada.cwd);
  if (!raiz || !entrada.transcript_path || !entrada.session_id) return;
  const r = rutas(raiz);
  const config = leerJSON(r.config, {});
  const fase = config.faseActiva || SIN_FASE;

  const archivo = path.join(r.sesiones, `${entrada.session_id}.json`);
  let s = leerJSON(archivo, {});
  // Los registros de la versión 0.1 no tienen cursores: se recalculan desde cero.
  if (s.version !== 2) s = { sesion: entrada.session_id, inicio: s.inicio || new Date().toISOString() };
  s.version = 2;
  s.archivos = s.archivos || {};
  s.porFase = s.porFase || {};

  const fuentes = [{ archivo: entrada.transcript_path, rol: "orquestador" }, ...subagentes(entrada.transcript_path)];
  for (const { archivo: f, rol } of fuentes) {
    const nuevo = statsVacias();
    const cursor = (s.archivos[path.basename(f)] = s.archivos[path.basename(f)] || {});
    sumarArchivo(f, cursor, nuevo);
    if (!Object.keys(nuevo.modelos).length && !Object.keys(nuevo.herramientas).length) continue;
    const porRol = (s.porFase[fase] = s.porFase[fase] || {});
    mezclar((porRol[rol] = porRol[rol] || statsVacias()), nuevo);
  }
  s.actualizado = new Date().toISOString();
  escribirJSON(archivo, s);
}

// Junta todas las sesiones: porFase[fase][rol] = stats.
function costosPorFase(r) {
  const porFase = {};
  let sesiones = 0;
  let archivos = [];
  try {
    archivos = fs.readdirSync(r.sesiones).filter((x) => x.endsWith(".json"));
  } catch {}
  for (const f of archivos) {
    const s = leerJSON(path.join(r.sesiones, f), null);
    if (!s) continue;
    sesiones++;
    // Registro de la versión 0.1: solo totales por modelo, sin rol.
    const datos = s.version === 2 ? s.porFase || {} : { [s.fase || SIN_FASE]: { "(sin rol)": { modelos: s.modelos || {}, herramientas: {}, contextoMax: 0 } } };
    for (const [fase, roles] of Object.entries(datos)) {
      for (const [rol, st] of Object.entries(roles)) {
        const destino = ((porFase[fase] = porFase[fase] || {})[rol] = porFase[fase][rol] || statsVacias());
        mezclar(destino, st);
      }
    }
  }
  return { porFase, sesiones };
}

function estado(faseFiltro) {
  const raiz = buscarRaiz();
  if (!raiz) {
    console.log("No hay .skuadai/ en este proyecto. Ejecuta /skuadai:iniciar.");
    return;
  }
  const r = rutas(raiz);
  const config = leerJSON(r.config, {});
  const precios = config.precios || {};
  const fmt = (n) => `$${n.toFixed(2)}`;
  const tok = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));

  console.log(`# SkuadAI — ${config.proyecto || path.basename(raiz)}`);
  console.log(`Tipo: ${config.tipo || "—"} · fase activa: ${config.faseActiva || "—"}`);
  const roles = Object.entries(config.roles || {})
    .filter(([, v]) => v.activo)
    .map(([k, v]) => `${k}=${v.modelo}`);
  console.log(`Roles: ${roles.join(", ") || "—"}\n`);

  if (config.tipo === "mantenimiento") {
    const pend = solicitudesPendientes(r.plan);
    console.log(`## Solicitudes pendientes (${pend.length})`);
    console.log((pend.length ? pend.map((p) => `- ${p}`).join("\n") : "(ninguna)") + "\n");
  }

  console.log("## Fases");
  let fases = [];
  try {
    fases = fs.readdirSync(r.fases).filter((d) => d.startsWith("fase-")).sort();
  } catch {}
  if (!fases.length) console.log("(sin fases todavía)");
  for (const d of fases) {
    const dir = path.join(r.fases, d);
    const tareas = Object.entries(resumenTareas(path.join(dir, "progreso.md")))
      .map(([k, v]) => `${v} ${k}`)
      .join(", ");
    const abiertas = preguntasAbiertas(path.join(dir, "preguntas.md")).length;
    console.log(`- ${d}: ${tareas || "sin tareas"}${abiertas ? ` · ${abiertas} pregunta(s) abierta(s)` : ""}`);
  }

  const { porFase, sesiones } = costosPorFase(r);
  console.log(`\n## Consumo por etapa y rol (${sesiones} sesión(es))`);
  console.log("Tokens de tu cuenta. \"USD eq.\" es lo que costaría con las tarifas de la API: con Pro o Max es solo una referencia; no se cobra.");
  console.log("\"Caché lect.\" es el contexto que se relee en cada llamada: suele dominar el total, pero es lo más liviano.");
  const orden = Object.keys(porFase)
    .filter((f) => !faseFiltro || f === faseFiltro)
    .sort((a, b) => (a === SIN_FASE ? -1 : b === SIN_FASE ? 1 : a.localeCompare(b)));
  if (!orden.length) console.log("\n(sin consumo registrado todavía)");

  let granTotal = 0;
  let granUsd = 0;
  const porModelo = {};
  for (const fase of orden) {
    console.log(`\n### ${fase === SIN_FASE ? "Antes de la primera fase (inicio y plan)" : `Fase ${fase}`}`);
    console.log("| Rol | Modelo | Entrada | Caché escr. | Caché lect. | Salida (razon.) | **Total** | Llamadas | Contexto máx. | USD eq. |");
    console.log("|---|---|---:|---:|---:|---:|---:|---:|---:|---:|");
    const suma = Object.fromEntries(CAMPOS.map((c) => [c, 0]));
    let usdFase = 0;
    const herramientas = [];
    const rolesFase = Object.entries(porFase[fase]).sort((a, b) => (a[0] === "orquestador" ? -1 : b[0] === "orquestador" ? 1 : a[0].localeCompare(b[0])));
    for (const [rol, st] of rolesFase) {
      const t = Object.fromEntries(CAMPOS.map((c) => [c, 0]));
      let usd = 0;
      for (const [m, mt] of Object.entries(st.modelos)) {
        for (const c of CAMPOS) t[c] += mt[c] || 0;
        usd += usdDe(m, mt, precios);
        const pm = (porModelo[m] = porModelo[m] || Object.fromEntries(CAMPOS.map((c) => [c, 0])));
        for (const c of CAMPOS) pm[c] += mt[c] || 0;
      }
      for (const c of CAMPOS) suma[c] += t[c];
      usdFase += usd;
      const modelos = Object.keys(st.modelos).map((m) => m.replace(/^claude-/, "")).join(", ");
      const razon = t.thinking ? ` (${tok(t.thinking)})` : "";
      console.log(`| ${rol} | ${modelos} | ${tok(t.input)} | ${tok(t.cacheWrite)} | ${tok(t.cacheRead)} | ${tok(t.output)}${razon} | **${tok(totalTokens(t))}** | ${t.llamadas} | ${tok(st.contextoMax)} | ${fmt(usd)} |`);
      const h = Object.entries(st.herramientas).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ");
      if (h) herramientas.push(`- ${rol}: ${h}`);
    }
    const razon = suma.thinking ? ` (${tok(suma.thinking)})` : "";
    console.log(`| **Total etapa** | | ${tok(suma.input)} | ${tok(suma.cacheWrite)} | ${tok(suma.cacheRead)} | ${tok(suma.output)}${razon} | **${tok(totalTokens(suma))}** | ${suma.llamadas} | | ${fmt(usdFase)} |`);
    if (herramientas.length) console.log(`\nHerramientas usadas:\n${herramientas.join("\n")}`);
    granTotal += totalTokens(suma);
    granUsd += usdFase;
  }

  if (orden.length) {
    console.log(`\n## Total por modelo${faseFiltro ? ` (fase ${faseFiltro})` : ""}`);
    console.log("| Modelo | Entrada | Caché escr. | Caché lect. | Salida | **Total** | USD eq. |");
    console.log("|---|---:|---:|---:|---:|---:|---:|");
    for (const [m, t] of Object.entries(porModelo).sort((a, b) => totalTokens(b[1]) - totalTokens(a[1]))) {
      console.log(`| ${m} | ${tok(t.input)} | ${tok(t.cacheWrite)} | ${tok(t.cacheRead)} | ${tok(t.output)} | **${tok(totalTokens(t))}** | ${fmt(usdDe(m, t, precios))} |`);
    }
  }
  const topeT = config.presupuestoTokens;
  const topeU = config.presupuestoUSD;
  let linea = `\n**Total: ${tok(granTotal)} tokens** (${fmt(granUsd)} USD eq.)`;
  if (!faseFiltro && topeT) linea += ` · tope ${tok(topeT)} tokens (${Math.round((granTotal / topeT) * 100)}%)`;
  if (!faseFiltro && topeU) linea += ` · tope ${fmt(topeU)} USD eq. (${Math.round((granUsd / topeU) * 100)}%)`;
  console.log(linea);
}

function hookInicio() {
  const entrada = leerStdin();
  const lineas = [`SkuadAI plugin root: ${PLUGIN_ROOT}`];
  const raiz = buscarRaiz(entrada.cwd);
  if (!raiz) {
    lineas.push("Este proyecto no usa SkuadAI todavía (sin .skuadai/). Para empezar: /skuadai:iniciar");
    console.log(lineas.join("\n"));
    return;
  }
  const r = rutas(raiz);
  const config = leerJSON(r.config, {});
  const roles = Object.entries(config.roles || {})
    .filter(([, v]) => v.activo)
    .map(([k, v]) => `${k}=${v.modelo}`);
  lineas.push(`Proyecto SkuadAI: ${config.proyecto || path.basename(raiz)} · tipo: ${config.tipo || "sin definir"} · roles: ${roles.join(", ")}`);
  if (config.tipo === "mantenimiento") {
    const pend = solicitudesPendientes(r.plan);
    if (pend.length) lineas.push(`Solicitudes pendientes en plan.md (${pend.length}):\n- ${pend.slice(0, 10).join("\n- ")}`);
  }

  const fase = config.faseActiva;
  if (!fase) {
    lineas.push("Sin fase activa. Siguiente paso habitual: /skuadai:nueva-fase <id>");
  } else {
    const dir = path.join(r.fases, `fase-${fase}`);
    lineas.push(`Fase activa: ${fase} (${path.relative(raiz, dir)})`);
    const abiertas = preguntasAbiertas(path.join(dir, "preguntas.md"));
    if (abiertas.length) lineas.push(`Preguntas abiertas (${abiertas.length}):\n- ${abiertas.join("\n- ")}`);
    const prog = path.join(dir, "progreso.md");
    if (fs.existsSync(prog)) {
      let texto = fs.readFileSync(prog, "utf8");
      if (texto.length > MAX_PROGRESO) texto = texto.slice(0, MAX_PROGRESO) + "\n…(recortado; lee el archivo completo si lo necesitas)";
      lineas.push("--- progreso.md ---\n" + texto.trim() + "\n--- fin progreso.md ---");
    }
    lineas.push(
      "Este es el estado guardado del trabajo; retoma desde aquí sin releer todo. Comandos: /skuadai:implementar, /skuadai:preguntas, /skuadai:estado"
    );
  }
  console.log(lineas.join("\n"));
}

// ---------- main ----------

const [cmd, arg] = process.argv.slice(2);
try {
  switch (cmd) {
    case "iniciar":
      iniciar(arg);
      break;
    case "fase":
      crearFase(arg);
      break;
    case "estado":
      estado(arg);
      break;
    case "hook-inicio":
      hookInicio();
      break;
    case "hook-costo":
      hookCosto();
      break;
    default:
      console.log("Uso: node skuadai.js <iniciar [tipo] | fase <id> | estado [fase] | hook-inicio | hook-costo>");
  }
} catch (e) {
  // Un hook nunca debe bloquear la sesión.
  if (cmd && cmd.startsWith("hook-")) process.exit(0);
  console.error(e.message);
  process.exit(1);
}
