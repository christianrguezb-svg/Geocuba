const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [-79.5, 21.5],
  zoom: 7,
  minZoom: 6,
  maxZoom: 12
});

map.on('load', () => {
  console.log('Mapa cargado correctamente');
});
