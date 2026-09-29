// ============================================
// GEO CUBA - Juego de geolocalización
// ============================================

// --- 1. CONFIGURACIÓN DEL MAPA ---
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [-79.5, 21.5], // Centro de Cuba
  zoom: 7,
  minZoom: 6,
  maxZoom: 14
});

// Añadir controles de navegación (zoom, brújula)
map.addControl(new maplibregl.NavigationControl(), 'top-right');

// --- 2. ESTADO DEL JUEGO ---
let preguntas = [];
let preguntaActual = 0;
let puntuacion = 0;
let respuestaSeleccionada = null;
let marcadoresActivos = [];

// --- 3. CARGA DEL MAPA ---
map.on('load', () => {
  console.log('Mapa cargado correctamente');

  // --- Provincias (capa inferior) ---
  map.addSource('cuba-provincias', {
    type: 'geojson',
    data: 'map/cuba-provincias.geojson'
  });

  map.addLayer({
    id: 'provincias-fill',
    type: 'fill',
    source: 'cuba-provincias',
    paint: {
      'fill-color': '#4a90d9',
      'fill-opacity': 0.1
    }
  });

  map.addLayer({
    id: 'provincias-outline',
    type: 'line',
    source: 'cuba-provincias',
    paint: {
      'line-color': '#2c5aa0',
      'line-width': 2
    }
  });

  // --- Municipios (capa superior) ---
  map.addSource('cuba-municipios', {
    type: 'geojson',
    data: 'map/cuba-municipios.geojson'
  });

  map.addLayer({
    id: 'municipios-fill',
    type: 'fill',
    source: 'cuba-municipios',
    paint: {
      'fill-color': '#4a90d9',
      'fill-opacity': 0.3
    }
  });

  map.addLayer({
    id: 'municipios-outline',
    type: 'line',
    source: 'cuba-municipios',
    paint: {
      'line-color': '#1a3a6b',
      'line-width': 0.5
    }
  });

  // Una vez cargado el mapa, cargar las preguntas
  cargarPreguntas();
});

// --- 4. CARGA DE PREGUNTAS ---
function cargarPreguntas() {
  fetch('data/preguntas.json')
    .then(res => res.json())
    .then(data => {
      // Barajar preguntas y tomar 5 al azar
      preguntas = barajar(data).slice(0, 5);
      preguntaActual = 0;
      puntuacion = 0;
      mostrarPregunta();
    })
    .catch(err => {
      console.error('Error cargando preguntas:', err);
      document.getElementById('pregunta-texto').textContent =
        'Error al cargar las preguntas. Revisa la consola.';
    });
}

// Utilidad: barajar array (algoritmo Fisher-Yates)
function barajar(array) {
  const copia = [...array];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// --- 5. MOSTRAR PREGUNTA ---
function mostrarPregunta() {
  // Limpiar marcadores anteriores
  marcadoresActivos.forEach(m => m.remove());
  marcadoresActivos = [];
  respuestaSeleccionada = null;

  // Si ya no hay más preguntas, mostrar resultados
  if (preguntaActual >= preguntas.length) {
    mostrarResultados();
    return;
  }

  const p = preguntas[preguntaActual];
  document.getElementById('pregunta-texto').innerHTML =
    `<strong>Pregunta ${preguntaActual + 1} de ${preguntas.length}</strong><br>${p.pregunta}`;

  const btn = document.getElementById('btn-siguiente');
  btn.disabled = true;
  btn.textContent = 'Siguiente';

  // Resetear vista del mapa
  map.flyTo({ center: [-79.5, 21.5], zoom: 7, duration: 800 });
}

// --- 6. DETECTAR CLIC EN EL MAPA ---
map.on('click', (e) => {
  if (respuestaSeleccionada) return; // Ya respondió esta pregunta
  if (preguntaActual >= preguntas.length) return; // Juego terminado

  const { lng, lat } = e.lngLat;
  const correcta = preguntas[preguntaActual].respuesta;

  // Calcular distancia con fórmula de Haversine
  const distancia = calcularDistancia(lat, lng, correcta.lat, correcta.lng);

  // Puntaje: máximo 5000 puntos, decrece con la distancia
  // Si está a más de 500 km, 0 puntos
  const puntaje = Math.max(0, Math.round(5000 - distancia * 10));

  puntuacion += puntaje;
  respuestaSeleccionada = { lat, lng, distancia, puntaje };

  // Marcador rojo: donde hizo clic el jugador
  const marcadorJugador = new maplibregl.Marker({ color: '#e74c3c' })
    .setLngLat([lng, lat])
    .addTo(map);
  marcadoresActivos.push(marcadorJugador);

  // Marcador verde: respuesta correcta
  const marcadorCorrecto = new maplibregl.Marker({ color: '#27ae60' })
    .setLngLat([correcta.lng, correcta.lat])
    .addTo(map);
  marcadoresActivos.push(marcadorCorrecto);

  // Línea entre ambos puntos
  const lineaId = `linea-${preguntaActual}`;
  map.addSource(lineaId, {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[lng, lat], [correcta.lng, correcta.lat]]
      }
    }
  });
  map.addLayer({
    id: lineaId,
    type: 'line',
    source: lineaId,
    paint: {
      'line-color': '#e74c3c',
      'line-width': 2,
      'line-dasharray': [2, 2]
    }
  });

  // Ajustar vista para que se vean ambos marcadores
  const bounds = new maplibregl.LngLatBounds()
    .extend([lng, lat])
    .extend([correcta.lng, correcta.lat]);
  map.fitBounds(bounds, { padding: 80, duration: 1000 });

  // Mostrar resultado al jugador
  let emoji = '⬛';
  if (distancia < 20) emoji = '🟩';
  else if (distancia < 60) emoji = '🟨';
  else if (distancia < 150) emoji = '🟧';
  else if (distancia < 500) emoji = '🟥';

  document.getElementById('pregunta-texto').innerHTML =
    `${emoji} Distancia: <strong>${distancia.toFixed(0)} km</strong><br>` +
    `Puntos: <strong>${puntaje}</strong><br>` +
    `<small>Respuesta correcta: ${correcta.municipio}, ${correcta.provincia}</small>`;

  document.getElementById('btn-siguiente').disabled = false;
});

// --- 7. FÓRMULA DE HAVERSINE ---
function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- 8. BOTÓN SIGUIENTE ---
document.getElementById('btn-siguiente').addEventListener('click', () => {
  // Limpiar la línea del mapa
  const lineaId = `linea-${preguntaActual}`;
  if (map.getLayer(lineaId)) map.removeLayer(lineaId);
  if (map.getSource(lineaId)) map.removeSource(lineaId);

  preguntaActual++;
  mostrarPregunta();
});

// --- 9. PANTALLA DE RESULTADOS ---
function mostrarResultados() {
  const maxPuntos = preguntas.length * 5000;
  const porcentaje = Math.round((puntuacion / maxPuntos) * 100);

  // Guardar en Supabase (si está configurado)
  guardarPuntuacion(puntuacion);

  // Obtener fecha actual para el texto compartible
  const hoy = new Date();
  const fecha = `${hoy.getDate()}/${hoy.getMonth() + 1}/${hoy.getFullYear()}`;

  const textoCompartir =
    `Geo Cuba #${fecha}\n` +
    `${puntuacion}/${maxPuntos} puntos (${porcentaje}%)\n` +
    `¿Puedes superarme?`;

  document.getElementById('pregunta-texto').innerHTML =
    `🎉 ¡Juego completado!<br><br>` +
    `Puntuación: <strong>${puntuacion}</strong> / ${maxPuntos}<br>` +
    `Precisión: <strong>${porcentaje}%</strong><br><br>` +
    `<button id="btn-compartir" style="padding:10px 20px; background:#2c5aa0; color:white; border:none; border-radius:8px; cursor:pointer;">Copiar resultado</button>`;

  const btn = document.getElementById('btn-siguiente');
  btn.textContent = 'Jugar otra vez';
  btn.disabled = false;
  btn.onclick = () => {
    // Reiniciar el juego
    cargarPreguntas();
  };

  // Acción del botón compartir
  document.getElementById('btn-compartir').addEventListener('click', () => {
    navigator.clipboard.writeText(textoCompartir)
      .then(() => {
        document.getElementById('btn-compartir').textContent = '¡Copiado!';
        setTimeout(() => {
          document.getElementById('btn-compartir').textContent = 'Copiar resultado';
        }, 2000);
      })
      .catch(err => console.error('Error al copiar:', err));
  });
}

// --- 10. GUARDAR PUNTUACIÓN EN SUPABASE (opcional) ---
// Descomenta este bloque si tienes Supabase configurado
/*
const SUPABASE_URL = 'TU_SUPABASE_URL';
const SUPABASE_KEY = 'TU_SUPABASE_ANON_KEY';
const supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);

async function guardarPuntuacion(puntos) {
  if (!supabase) return;
  const nombre = prompt('¿Tu nombre para el ranking?') || 'Anónimo';
  const { error } = await supabase
    .from('puntuaciones')
    .insert([{ nombre, puntuacion: puntos }]);
  if (error) console.error('Error guardando puntuación:', error);
  else console.log('Puntuación guardada');
}
*/
function guardarPuntuacion(puntos) {
  // Placeholder si Supabase no está activo
  console.log('Puntuación final:', puntos);
}
