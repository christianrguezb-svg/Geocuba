// ===== 1. CONFIGURACIÓN DEL MAPA =====
const TOTAL = 5, MAX_PTS = 5000;
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [-79.5, 21.5], zoom: 7, minZoom: 6, maxZoom: 14
});
map.addControl(new maplibregl.NavigationControl(), 'top-right');

// ===== 2. ESTADO DEL JUEGO =====
let preguntas = [], preguntaActual = 0, puntuacion = 0;
let respuestaSeleccionada = null, marcadoresActivos = [], juegoTerminado = false;
let emojis = [];
const textoEl = document.getElementById('pregunta-texto');
const btn = document.getElementById('btn-siguiente');

// ===== 3. CARGA DEL MAPA =====
map.on('load', () => {
  map.addSource('provincias', { type: 'geojson', data: 'map/cuba-provincias.geojson' });
  map.addLayer({ id: 'prov-fill', type: 'fill', source: 'provincias',
    paint: { 'fill-color': '#9ec5f8', 'fill-opacity': 0.25 } });
  map.addLayer({ id: 'prov-line', type: 'line', source: 'provincias',
    paint: { 'line-color': '#2c5aa0', 'line-width': 2 } });
  map.addSource('municipios', { type: 'geojson', data: 'map/cuba-municipios.geojson' });
  map.addLayer({ id: 'mun-fill', type: 'fill', source: 'municipios',
    paint: { 'fill-color': '#4a90d9', 'fill-opacity': 0.1 } });
  map.addLayer({ id: 'mun-line', type: 'line', source: 'municipios',
    paint: { 'line-color': '#2c5aa0', 'line-width': 0.6 } });
  cargarPreguntas();
});
map.on('error', e => console.error('Error del mapa:', e.error || e));

// ===== 4. CARGA DE PREGUNTAS =====
async function cargarPreguntas() {
  try {
    const res = await fetch('data/preguntas.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const todas = await res.json();
    for (let i = todas.length - 1; i > 0; i--) { // Fisher-Yates
      const j = Math.floor(Math.random() * (i + 1));
      [todas[i], todas[j]] = [todas[j], todas[i]];
    }
    preguntas = todas.slice(0, TOTAL);
    preguntaActual = 0; puntuacion = 0; juegoTerminado = false; emojis = [];
    document.querySelectorAll('.btn-secundario').forEach(b => b.remove());
    btn.textContent = 'Siguiente';
    mostrarPregunta();
  } catch (err) {
    textoEl.textContent = 'No se pudieron cargar las preguntas. Revisa data/preguntas.json.';
    console.error(err);
  }
}

// ===== 5. MOSTRAR PREGUNTA =====
function limpiarMapa() {
  marcadoresActivos.forEach(m => m.remove());
  marcadoresActivos = [];
  if (map.getLayer('linea')) map.removeLayer('linea');
  if (map.getSource('linea')) map.removeSource('linea');
}
function mostrarPregunta() {
  limpiarMapa();
  respuestaSeleccionada = null;
  if (preguntaActual >= preguntas.length) return mostrarResultados();
  textoEl.textContent = `Pregunta ${preguntaActual + 1} de ${TOTAL}\n${preguntas[preguntaActual].pregunta}`;
  btn.disabled = true;
  map.flyTo({ center: [-79.5, 21.5], zoom: 7 });
}

// ===== 6. CLIC EN EL MAPA =====
map.on('click', e => {
  if (respuestaSeleccionada || juegoTerminado || !preguntas.length) return;
  const r = preguntas[preguntaActual].respuesta;
  respuestaSeleccionada = { lat: e.lngLat.lat, lng: e.lngLat.lng };
  const km = haversine(respuestaSeleccionada.lat, respuestaSeleccionada.lng, r.lat, r.lng);
  const pts = Math.max(0, Math.round(MAX_PTS - km * 10));
  puntuacion += pts;
  const emoji = km < 20 ? '🟩' : km < 60 ? '🟨' : km < 150 ? '🟧' : km < 500 ? '🟥' : '⬛';
  emojis.push(emoji);

  marcadoresActivos.push(
    new maplibregl.Marker({ color: '#e53935' }).setLngLat([e.lngLat.lng, e.lngLat.lat]).addTo(map),
    new maplibregl.Marker({ color: '#43a047' }).setLngLat([r.lng, r.lat]).addTo(map)
  );
  map.addSource('linea', { type: 'geojson', data: { type: 'Feature', geometry: {
    type: 'LineString', coordinates: [[e.lngLat.lng, e.lngLat.lat], [r.lng, r.lat]] } } });
  map.addLayer({ id: 'linea', type: 'line', source: 'linea',
    paint: { 'line-color': '#111', 'line-width': 3, 'line-dasharray': [2, 2] } });
  const b = new maplibregl.LngLatBounds([e.lngLat.lng, e.lngLat.lat], [r.lng, r.lat]);
  map.fitBounds(b, { padding: 70, maxZoom: 10 });

  textoEl.textContent = `${emoji} ${km.toFixed(1)} km · +${pts} puntos\n(${r.municipio}, ${r.provincia})`;
  btn.disabled = false;
});

// ===== 7. HAVERSINE (km) =====
function haversine(lat1, lon1, lat2, lon2) {
  const rad = x => x * Math.PI / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

// ===== 8. BOTÓN SIGUIENTE =====
btn.addEventListener('click', () => {
  if (juegoTerminado) return cargarPreguntas();
  limpiarMapa();
  preguntaActual++;
  mostrarPregunta();
});

// ===== 9. RESULTADOS =====
function mostrarResultados() {
  juegoTerminado = true;
  const max = TOTAL * MAX_PTS;
  const pct = Math.round(puntuacion / max * 100);
  const d = new Date();
  const fecha = [d.getDate(), d.getMonth() + 1, d.getFullYear()]
    .map((n, i) => i < 2 ? String(n).padStart(2, '0') : n).join('/');
  const texto = `Geo Cuba #${fecha}\n${emojis.join('')}\n${puntuacion}/${max} puntos (${pct}%)\n¿Puedes superarme?`;
  textoEl.textContent = texto;
  const copiar = document.createElement('button');
  copiar.className = 'btn-secundario';
  copiar.textContent = 'Copiar resultado';
  copiar.onclick = async () => {
    try { await navigator.clipboard.writeText(texto); copiar.textContent = '¡Copiado!'; }
    catch { prompt('Copia el texto:', texto); }
  };
  btn.before(copiar);
  btn.textContent = 'Jugar otra vez';
  btn.disabled = false;
}

// ===== 10. SUPABASE (FUTURO) =====
// const { createClient } = supabase;
// const db = createClient('URL_PROYECTO', 'ANON_KEY');
// await db.from('resultados').insert({ fecha, puntuacion, emojis: emojis.join('') });
