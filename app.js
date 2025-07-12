const map = L.map('map').setView([52.52, 13.405], 13); // In Berlin beginnen
const distance = 100;

// Aktuellen Standort abrufen und anzeigen:
map.locate({ setView: true, maxZoom: 16 });

map.on('locationfound', function(e) {
  L.marker(e.latlng).addTo(map)
    .bindPopup("Du bist hier").openPopup();
});

map.on('locationerror', function() {
  alert("Standort konnte nicht ermittelt werden.");
});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);

    const chargerIcon = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/3103/3103446.png',
      iconSize: [25, 25],
      iconAnchor: [12, 25],
      popupAnchor: [0, -25],
    });

    const playgroundIcon = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/854/854866.png',
      iconSize: [25, 25],
      iconAnchor: [12, 25],
      popupAnchor: [0, -25],
    });

    async function findPausenplaetze() {
      markersLayer.clearLayers();

      const bounds = map.getBounds();
      const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;

      const query = `
        [out:json][timeout:25];
        (
          node["amenity"="charging_station"](${bbox});
          way["amenity"="charging_station"](${bbox});
          relation["amenity"="charging_station"](${bbox});
        )->.chargers;

        (
          node["leisure"="playground"](around.chargers:100);
          way["leisure"="playground"](around.chargers:100);
          relation["leisure"="playground"](around.chargers:100);
        )->.playgrounds_nearby;

        (
          .chargers;
          .playgrounds_nearby;
        );
        out center;
      `;

      const url = 'https://overpass-api.de/api/interpreter';
      const response = await fetch(url, {
        method: 'POST',
        body: query,
      });

      const data = await response.json();
      console.log('Empfangene Daten:', data);

      const chargers = data.elements.filter(e => e.tags?.amenity === 'charging_station');
      const playgrounds = data.elements.filter(e => e.tags?.leisure === 'playground');

      chargers.forEach(charger => {
        let lat = charger.lat || charger.center?.lat;
        let lon = charger.lon || charger.center?.lon;
        if (lat && lon) {
          const nearbyPlaygrounds = playgrounds.filter(pg => {
            const pgLat = pg.lat || pg.center?.lat;
            const pgLon = pg.lon || pg.center?.lon;
            if (pgLat && pgLon) {
              const dist = map.distance([lat, lon], [pgLat, pgLon]);
              return dist <= 100;
            }
            return false;
          });
          if (nearbyPlaygrounds.length > 0) {
            let popup = '<b>Ladesäule</b>';
            for (const [key, value] of Object.entries(charger.tags)) {
              popup += `<br><b>${key}</b>: ${value}`;
            }
            popup += `<br><b>Nahe Spielplätze:</b> ${nearbyPlaygrounds.length}`;
            const marker = L.marker([lat, lon], { icon: chargerIcon }).bindPopup(popup);
            markersLayer.addLayer(marker);

            nearbyPlaygrounds.forEach(pg => {
              const pgLat = pg.lat || pg.center?.lat;
              const pgLon = pg.lon || pg.center?.lon;
              if (pgLat && pgLon) {
                const pgMarker = L.marker([pgLat, pgLon], { icon: playgroundIcon }).bindPopup(`Spielplatz nahe Ladesäule ${charger.id}`);
                markersLayer.addLayer(pgMarker);
              }
            });
          }
        }
      });
    }

    document.getElementById('find').addEventListener('click', findPausenplaetze);