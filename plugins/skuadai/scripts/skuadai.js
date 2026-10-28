#!/usr/bin/env node
// SkuadAI: utilidades del plugin (estructura del proyecto, hooks y costos).
// Uso:
//   node skuadai.js iniciar            crea .skuadai/ en el directorio actual
//   node skuadai.js fase <id>          crea .skuadai/fases/fase-<id>/ y la marca activa
//   node skuadai.js estado             avance por fase y costo estimado
//   node skuadai.js hook-inicio        hook SessionStart (lee JSON por stdin)
//   node skuadai.js hook-costo         hook Stop / SubagentStop (lee JSON por stdin)

const fs = require("fs");
const path = require("path");

const PLUGIN_ROOT = path.resolve(__dirname, "..");
const TEMPLATES = path.join(PLUGIN_ROOT, "templates");
const MAX_PROGRESO = 6000;

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

// ---------- comandos ----------

function iniciar() {
  const raiz = process.cwd();
  const r = rutas(raiz);
  const creados = [];
  if (!fs.existsSync(r.config)) {
    const config = leerJSON(path.join(TEMPLATES, "config.json"), {});
    config.proyecto = path.basename(raiz);
    escribirJSON(r.config, config);
    creados.push(".skuadai/config.json");
  }
  if (!fs.existsSync(r.plan)) {
    fs.writeFileSync(r.plan, `# Plan de trabajo — ${path.basename(raiz)}\n\n## Fases\n\n<!-- 01. Nombre: objetivo en una línea (depende de: —) -->\n`);
    creados.push(".skuadai/plan.md");
  }
  fs.mkdirSync(r.fases, { recursive: true });
  fs.mkdirSync(r.sesiones, { recursive: true });
  console.log(creados.length ? `Creado: ${creados.join(", ")}` : "SkuadAI ya estaba iniciado en este proyecto; no se sobrescribió nada.");
  console.log(`Raíz: ${raiz}`);
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

function precioDe(modelo, precios) {
  if (precios[modelo]) return precios[modelo];
  for (const familia of ["fable", "mythos", "opus", "sonnet", "haiku"]) {
    if (modelo.includes(familia)) return precios[familia] || precios.fable || null;
  }
  return null;
}

function sumarArchivo(file, vistos, totales) {
  let texto;
  try {
    texto = fs.readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const linea of texto.split(/\r?\n/)) {
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
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const u = msg.usage;
    const t = (totales[msg.model] = totales[msg.model] || { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 });
    t.input += u.input_tokens || 0;
    t.output += u.output_tokens || 0;
    t.cacheWrite += u.cache_creation_input_tokens || 0;
    t.cacheRead += u.cache_read_input_tokens || 0;
  }
}

// Transcripciones de subagentes: <dir>/<sesión>/subagents/*.jsonl
function archivosSubagentes(transcript) {
  const dir = path.join(path.dirname(transcript), path.basename(transcript, ".jsonl"), "subagents");
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")).map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

function hookCosto() {
  const entrada = leerStdin();
  const raiz = buscarRaiz(entrada.cwd);
  if (!raiz || !entrada.transcript_path || !entrada.session_id) return;
  const r = rutas(raiz);
  const config = leerJSON(r.config, {});
  const precios = config.precios || {};

  const vistos = new Set();
  const totales = {};
  sumarArchivo(entrada.transcript_path, vistos, totales);
  for (const f of archivosSubagentes(entrada.transcript_path)) sumarArchivo(f, vistos, totales);

  let usd = 0;
  for (const [modelo, t] of Object.entries(totales)) {
    const p = precioDe(modelo, precios);
    t.usd = p ? (t.input * p.input + t.output * p.output + t.cacheWrite * p.cacheWrite + t.cacheRead * p.cacheRead) / 1e6 : 0;
    usd += t.usd;
  }

  const archivo = path.join(r.sesiones, `${entrada.session_id}.json`);
  const previo = leerJSON(archivo, {});
  escribirJSON(archivo, {
    sesion: entrada.session_id,
    fase: previo.fase || config.faseActiva || null,
    inicio: previo.inicio || new Date().toISOString(),
    actualizado: new Date().toISOString(),
    modelos: totales,
    usd,
  });
}

function estado() {
  const raiz = buscarRaiz();
  if (!raiz) {
    console.log("No hay .skuadai/ en este proyecto. Ejecuta /skuadai:iniciar.");
    return;
  }
  const r = rutas(raiz);
  const config = leerJSON(r.config, {});
  const fmt = (n) => `$${n.toFixed(2)}`;
  const tok = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : String(n));

  console.log(`# SkuadAI — ${config.proyecto || path.basename(raiz)}`);
  console.log(`Fase activa: ${config.faseActiva || "—"}`);
  const roles = Object.entries(config.roles || {})
    .filter(([, v]) => v.activo)
    .map(([k, v]) => `${k}=${v.modelo}`);
  console.log(`Roles: ${roles.join(", ") || "—"}\n`);

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

  const porModelo = {};
  const porFase = {};
  let total = 0;
  let sesiones = 0;
  try {
    for (const f of fs.readdirSync(r.sesiones).filter((x) => x.endsWith(".json"))) {
      const s = leerJSON(path.join(r.sesiones, f), null);
      if (!s) continue;
      sesiones++;
      total += s.usd || 0;
      const fase = s.fase || "(sin fase)";
      porFase[fase] = (porFase[fase] || 0) + (s.usd || 0);
      for (const [m, t] of Object.entries(s.modelos || {})) {
        const a = (porModelo[m] = porModelo[m] || { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, usd: 0 });
        for (const k of Object.keys(a)) a[k] += t[k] || 0;
      }
    }
  } catch {}

  console.log(`\n## Costo estimado (${sesiones} sesión(es))`);
  console.log("| Modelo | Entrada | Salida | Caché escr. | Caché lect. | USD |");
  console.log("|---|---:|---:|---:|---:|---:|");
  for (const [m, t] of Object.entries(porModelo).sort((a, b) => b[1].usd - a[1].usd)) {
    console.log(`| ${m} | ${tok(t.input)} | ${tok(t.output)} | ${tok(t.cacheWrite)} | ${tok(t.cacheRead)} | ${fmt(t.usd)} |`);
  }
  console.log("");
  for (const [f, v] of Object.entries(porFase).sort()) console.log(`- Fase ${f}: ${fmt(v)}`);
  const pres = config.presupuestoUSD;
  console.log(`\n**Total: ${fmt(total)}**${pres ? ` de ${fmt(pres)} (${Math.round((total / pres) * 100)}%)` : ""}`);
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
  lineas.push(`Proyecto SkuadAI: ${config.proyecto || path.basename(raiz)} · roles: ${roles.join(", ")}`);

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
      iniciar();
      break;
    case "fase":
      crearFase(arg);
      break;
    case "estado":
      estado();
      break;
    case "hook-inicio":
      hookInicio();
      break;
    case "hook-costo":
      hookCosto();
      break;
    default:
      console.log("Uso: node skuadai.js <iniciar | fase <id> | estado | hook-inicio | hook-costo>");
  }
} catch (e) {
  // Un hook nunca debe bloquear la sesión.
  if (cmd && cmd.startsWith("hook-")) process.exit(0);
  console.error(e.message);
  process.exit(1);
}
