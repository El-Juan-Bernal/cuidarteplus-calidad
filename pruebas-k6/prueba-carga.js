import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://host.docker.internal:4444';
const ES_HUMO = __ENV.PERFIL === 'humo';

// Métricas personalizadas por endpoint (en ms)
const tLogin = new Trend('tiempo_login', true);
const tPacientes = new Trend('tiempo_pacientes', true);
const tExamenes = new Trend('tiempo_examenes', true);
const tUsuarios = new Trend('tiempo_usuarios', true);

export const options = ES_HUMO
  ? {
      stages: [
        { duration: '15s', target: 3 }, // Perfil humo para CI
      ],
      thresholds: {
        http_req_failed: ['rate<0.05'],
        http_req_duration: ['p(95)<2000'], // Umbral real sin retardo artificial
        checks: ['rate>0.95'],
      },
    }
  : {
      stages: [
        { duration: '15s', target: 5 },  // Calentamiento (carga baja)
        { duration: '30s', target: 15 }, // Carga sostenida (operación normal)
        { duration: '20s', target: 30 }, // Pico de carga (estrés)
        { duration: '15s', target: 0 },  // Enfriamiento
      ],
      thresholds: {
        http_req_failed: ['rate<0.05'],
        http_req_duration: ['p(95)<2000'],
        checks: ['rate>0.95'],
      },
    };

export default function () {
  let token = null;

  group('01 - Autenticación (Login)', () => {
    const payload = JSON.stringify({
      nombre_usuario: 'admin',
      password: 'admin',
    });
    const res = http.post(`${BASE_URL}/autenticacion/login`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    tLogin.add(res.timings.duration);

    const ok = check(res, {
      'Login status 200': (r) => r.status === 200,
      'Login entrega token JWT': (r) => {
        try {
          return Boolean(r.json('token'));
        } catch {
          return false;
        }
      },
    });

    if (ok) {
      token = res.json('token');
    }
  });

  if (!token) {
    sleep(1);
    return;
  }

  const authHeaders = {
    headers: { Authorization: `Bearer ${token}` },
  };

  group('02 - Listado de Pacientes', () => {
    const res = http.get(`${BASE_URL}/pacientes`, authHeaders);
    tPacientes.add(res.timings.duration);
    check(res, {
      'GET /pacientes status 200': (r) => r.status === 200,
    });
  });

  group('03 - Listado de Exámenes', () => {
    const res = http.get(`${BASE_URL}/examenes`, authHeaders);
    tExamenes.add(res.timings.duration);
    check(res, {
      'GET /examenes status 200': (r) => r.status === 200,
    });
  });

  group('04 - Listado de Usuarios', () => {
    const res = http.get(`${BASE_URL}/usuarios`, authHeaders);
    tUsuarios.add(res.timings.duration);
    check(res, {
      'GET /usuarios status 200': (r) => r.status === 200,
    });
  });

  sleep(1);
}

export function handleSummary(data) {
  const m = data.metrics || {};
  const v = (name, key) =>
    m[name] && m[name].values && m[name].values[key] !== undefined
      ? m[name].values[key]
      : 0;
  const fmt = (n, dec = 2) => Number(n || 0).toFixed(dec);

  const totalReqs = v('http_reqs', 'count');
  const rps = v('http_reqs', 'rate');
  const failRate = v('http_req_failed', 'rate') * 100;
  const checkPasses = v('checks', 'passes');
  const checkFails = v('checks', 'fails');
  const checkTotal = checkPasses + checkFails;
  const checkRate = checkTotal > 0 ? (checkPasses / checkTotal) * 100 : 0;
  const maxVus = v('vus_max', 'max');
  const iterations = v('iterations', 'count');

  const endpoints = [
    { nombre: 'POST /autenticacion/login', metrica: 'tiempo_login' },
    { nombre: 'GET /pacientes', metrica: 'tiempo_pacientes' },
    { nombre: 'GET /examenes', metrica: 'tiempo_examenes' },
    { nombre: 'GET /usuarios', metrica: 'tiempo_usuarios' },
    { nombre: 'Global (todas las peticiones)', metrica: 'http_req_duration' },
  ];

  const umbrales = [];
  for (const [metricName, metricObj] of Object.entries(m)) {
    if (metricObj.thresholds) {
      for (const [expr, res] of Object.entries(metricObj.thresholds)) {
        umbrales.push({ metricName, expr, ok: res.ok });
      }
    }
  }

  const filasEndpoints = endpoints
    .map((e) => `
      <tr>
        <td><strong>${e.nombre}</strong></td>
        <td>${fmt(v(e.metrica, 'avg'))} ms</td>
        <td>${fmt(v(e.metrica, 'med'))} ms</td>
        <td>${fmt(v(e.metrica, 'p(95)'))} ms</td>
        <td>${fmt(v(e.metrica, 'max'))} ms</td>
      </tr>`)
    .join('');

  const filasUmbrales = umbrales
    .map((u) => `
      <tr>
        <td>${u.metricName}</td>
        <td><code>${u.expr}</code></td>
        <td><span class="badge ${u.ok ? 'ok' : 'fail'}">${u.ok ? 'APROBADO' : 'SUPERADO'}</span></td>
      </tr>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Reporte de Rendimiento k6 - CuidartePlus</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 32px; background: #f8fafc; color: #1e293b; }
    h1 { margin-bottom: 4px; color: #0f172a; }
    .sub { color: #64748b; margin-top: 0; margin-bottom: 24px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 28px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
    .card .label { font-size: 12px; text-transform: uppercase; color: #64748b; }
    .card .value { font-size: 24px; font-weight: 700; margin-top: 6px; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; overflow: hidden; margin-bottom: 28px; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
    th, td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: left; }
    th { background: #0f172a; color: #fff; font-weight: 600; }
    .badge { padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    .badge.ok { background: #dcfce7; color: #166534; }
    .badge.fail { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <h1>Reporte de Pruebas de Rendimiento y Carga (k6)</h1>
  <p class="sub">Sistema: CuidartePlus Backend (${BASE_URL}) | Escenario: 5 → 15 → 30 → 0 VUs (80s)</p>

  <div class="cards">
    <div class="card"><div class="label">Peticiones Totales</div><div class="value">${totalReqs}</div></div>
    <div class="card"><div class="label">Throughput</div><div class="value">${fmt(rps)} req/s</div></div>
    <div class="card"><div class="label">VUs Máximos</div><div class="value">${maxVus}</div></div>
    <div class="card"><div class="label">Iteraciones</div><div class="value">${iterations}</div></div>
    <div class="card"><div class="label">Tasa de Error HTTP</div><div class="value">${fmt(failRate)}%</div></div>
    <div class="card"><div class="label">Checks Exitosos</div><div class="value">${fmt(checkRate)}% (${checkPasses}/${checkTotal})</div></div>
  </div>

  <h2>Latencia por Endpoint</h2>
  <table>
    <thead>
      <tr><th>Endpoint</th><th>Promedio</th><th>Mediana (p50)</th><th>Percentil 95 (p95)</th><th>Máximo</th></tr>
    </thead>
    <tbody>${filasEndpoints}</tbody>
  </table>

  <h2>Evaluación de Umbrales (Thresholds)</h2>
  <table>
    <thead>
      <tr><th>Métrica</th><th>Criterio</th><th>Estado</th></tr>
    </thead>
    <tbody>${filasUmbrales}</tbody>
  </table>
</body>
</html>`;

  const texto = [
    '\n================ RESUMEN K6 - CUIDARTEPLUS ================',
    `Peticiones totales : ${totalReqs} (${fmt(rps)} req/s)`,
    `Iteraciones / VUs  : ${iterations} iteraciones | Max VUs: ${maxVus}`,
    `Tasa de error HTTP : ${fmt(failRate)}%`,
    `Checks exitosos    : ${fmt(checkRate)}% (${checkPasses}/${checkTotal})`,
    '-----------------------------------------------------------',
    'Latencia por endpoint (avg | p95 | max):',
    ...endpoints.map(
      (e) =>
        `  - ${e.nombre.padEnd(30)}: ${fmt(v(e.metrica, 'avg'))} ms | p95=${fmt(v(e.metrica, 'p(95)'))} ms | max=${fmt(v(e.metrica, 'max'))} ms`
    ),
    '-----------------------------------------------------------',
    'Umbrales (Thresholds):',
    ...umbrales.map(
      (u) => `  - [${u.ok ? 'PASS' : 'FAIL'}] ${u.metricName} (${u.expr})`
    ),
    '===========================================================\n',
  ].join('\n');

  return {
    stdout: texto,
    '/scripts/reporte-k6.html': html,
  };
}
