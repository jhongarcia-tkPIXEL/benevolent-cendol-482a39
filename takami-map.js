// takami-map.js — Módulo modular de mapas para Takami
// Utiliza Leaflet (100% gratuito y de código abierto) con capas oscuras de CartoDB

class TakamiMap {
  /**
   * Inicializa el mapa en un elemento del DOM
   * @param {string} containerId - ID del div contenedor del mapa
   * @param {Array} center - [lat, lng] inicial
   * @param {number} zoom - Zoom inicial (ej. 12)
   */
  constructor(containerId, center = [4.62, -74.08], zoom = 12) {
    this.containerId = containerId;
    this.markers = {}; // Almacena los marcadores de los camiones: { truckId: L.Marker }
    this.stopMarkers = []; // Almacena marcadores de paradas actuales
    this.routeLine = null; // Polilínea de la ruta
    this.map = null;

    // Inyectar estilos CSS para animaciones y diseño personalizado de Leaflet
    this._injectStyles();
    
    // Inicializar mapa de Leaflet
    try {
      this.map = L.map(containerId, {
        zoomControl: true,
        attributionControl: false
      }).setView(center, zoom);

      // Capa de mapa oscura (CartoDB Dark Matter) - 100% Gratis, sin API Key
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        subdomains: 'abcd'
      }).addTo(this.map);
      
      // Control de atribución personalizado discreto
      L.control.attribution({ prefix: false })
        .addAttribution('&copy; <a href="https://carto.com/" target="_blank">CARTO</a>')
        .addTo(this.map);

    } catch (e) {
      console.error("Error al inicializar Leaflet:", e);
      document.getElementById(containerId).innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--red); font-family: var(--font); font-size: 14px;">
          ⚠ No se pudo cargar el mapa. Verifica tu conexión a internet.
        </div>
      `;
    }
  }

  /**
   * Inyecta los keyframes de animación en el documento
   */
  _injectStyles() {
    if (document.getElementById('takami-map-styles')) return;
    const style = document.createElement('style');
    style.id = 'takami-map-styles';
    style.innerHTML = `
      @keyframes takamiGlow {
        0%, 100% { transform: scale(1); opacity: 0.15; }
        50% { transform: scale(1.25); opacity: 0.4; }
      }
      @keyframes stopPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(0, 200, 232, 0.4); }
        70% { box-shadow: 0 0 0 6px rgba(0, 200, 232, 0); }
      }
      .custom-truck-div {
        transition: transform 0.2s ease-out;
      }
      .leaflet-popup-content-wrapper {
        background: #062030 !important;
        border: 1px solid rgba(0, 200, 232, 0.3) !important;
        color: #e8f6ff !important;
        font-family: 'Barlow', sans-serif !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 16px rgba(0,0,0,0.5) !important;
      }
      .leaflet-popup-tip {
        background: #062030 !important;
        border-left: 1px solid rgba(0, 200, 232, 0.3) !important;
        border-bottom: 1px solid rgba(0, 200, 232, 0.3) !important;
      }
      .leaflet-popup-close-button {
        color: #7aa8be !important;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Crea o actualiza el marcador de un camión con animación de movimiento fluido
   * @param {Object} truck - Datos del camión de la base de datos (id, nombre, lat, lng, color, etc.)
   * @param {boolean} autoCenter - Si debe centrar el mapa en este camión
   */
  updateTruckMarker(truck, autoCenter = false) {
    if (!this.map || !truck.lat || !truck.lng) return;

    const truckId = truck.id;
    const newLatLng = L.latLng(parseFloat(truck.lat), parseFloat(truck.lng));
    const color = truck.color || '#00c8e8';

    // Generar el icono SVG personalizado de camión con el color correspondiente
    const icon = L.divIcon({
      html: `
        <div class="custom-truck-div" style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
          <!-- Resplandor dinámico de fondo -->
          <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background: ${color}; opacity: 0.15; animation: takamiGlow 2.5s infinite ease-in-out;"></div>
          <!-- Círculo interior oscuro con borde de color brillante -->
          <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; border: 2.2px solid ${color}; background: #041824; box-shadow: 0 0 8px ${color}80; display: flex; align-items: center; justify-content: center; transform: translateZ(0);">
            <!-- Icono SVG de camión -->
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="1" y="3" width="15" height="13" rx="1"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.2" fill="${color}"></circle>
              <circle cx="18.5" cy="18.5" r="2.2" fill="${color}"></circle>
            </svg>
          </div>
        </div>
      `,
      className: '',
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    const popupContent = `
      <div style="font-family: 'Barlow', sans-serif;">
        <strong style="font-size: 14px; font-family: 'Barlow Condensed'; color: ${color}; letter-spacing: 0.5px; text-transform: uppercase;">
          ${truck.nombre}
        </strong>
        <div style="font-size: 11px; color: #7aa8be; margin-top: 2px;">
          Placa: <strong>${truck.placa || '—'}</strong><br>
          Conductor: ${truck.conductor || '—'}<br>
          Temperatura: <span style="color: ${truck.temperatura <= -18 ? '#00e676' : '#ff4d4d'}; font-weight: bold;">${truck.temperatura || '—'}°C</span><br>
          Estado: ${truck.estado === 'en_ruta' ? 'En ruta' : 'Detenido'}
        </div>
      </div>
    `;

    if (this.markers[truckId]) {
      // Si el marcador ya existe, lo movemos con una transición suave (animación de interpolación)
      const marker = this.markers[truckId];
      marker.setPopupContent(popupContent);
      marker.setIcon(icon); // Actualiza el color si cambia
      
      this._animateMarkerMovement(marker, marker.getLatLng(), newLatLng);
    } else {
      // Si es un camión nuevo, crear el marcador
      const marker = L.marker(newLatLng, { icon: icon }).addTo(this.map);
      marker.bindPopup(popupContent);
      this.markers[truckId] = marker;
    }

    if (autoCenter) {
      this.map.panTo(newLatLng);
    }
  }

  /**
   * Elimina un marcador de camión
   */
  removeTruckMarker(truckId) {
    if (this.markers[truckId]) {
      this.map.removeLayer(this.markers[truckId]);
      delete this.markers[truckId];
    }
  }

  /**
   * Anima el movimiento de un marcador desde una posición inicial a una final
   */
  _animateMarkerMovement(marker, startLatLng, endLatLng, duration = 1200) {
    const startTime = performance.now();
    
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing cúbico hacia afuera para suavidad
      const ease = 1 - Math.pow(1 - progress, 3);
      
      const lat = startLatLng.lat + (endLatLng.lat - startLatLng.lat) * ease;
      const lng = startLatLng.lng + (endLatLng.lng - startLatLng.lng) * ease;
      
      marker.setLatLng([lat, lng]);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }

  /**
   * Dibuja la ruta del camión (paradas y líneas de recorrido)
   * @param {Object} truck - Datos del camión
   */
  drawTruckRoute(truck) {
    if (!this.map) return;

    // Limpiar elementos de ruta anteriores
    this.clearRoute();

    const paradas = truck.paradas || [];
    if (!paradas.length) return;

    const latlngs = [];
    const color = truck.color || '#00c8e8';
    const paradaActualIdx = truck.parada_actual || 0;
    const completadas = truck.paradas_completadas || [];

    // Si tenemos coordenadas de inicio del camión, la añadimos a los límites de visualización
    const routePoints = [];

    // Recorrer las paradas configuradas en el JSONB
    paradas.forEach((s, idx) => {
      // Intentar calcular una ubicación ficticia pero estable para cada parada si no tiene lat/lng,
      // o utilizar sus coordenadas si están presentes en el objeto parada.
      // Como el setup de takami crea paradas sin coordenadas nativas en el JSON,
      // usaremos las coordenadas de la parada o las inferiremos basándonos en la posición del camión
      // para crear un trayecto ilustrativo en Bogotá si no hay coordenadas exactas en la parada.
      let pLat, pLng;

      if (s.lat && s.lng) {
        pLat = parseFloat(s.lat);
        pLng = parseFloat(s.lng);
      } else {
        // Generador de coordenadas estables basadas en el nombre de la parada para simular ruta en Bogotá
        // de forma que no cambie de posición aleatoriamente.
        const hash = s.nombre ? s.nombre.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) : idx;
        const seedLat = (hash % 100) / 3000;
        const seedLng = (hash % 80) / 2500;
        
        // Coordenadas base (Bogotá)
        const baseLat = 4.6097;
        const baseLng = -74.0817;
        
        pLat = baseLat + (idx === 0 ? -0.015 : idx === 1 ? 0.015 : idx === 2 ? -0.005 : 0.02) + (seedLat * 0.1);
        pLng = baseLng + (idx === 0 ? -0.02 : idx === 1 ? -0.008 : idx === 2 ? 0.012 : 0.005) + (seedLng * 0.1);
      }

      const pLatLng = [pLat, pLng];
      latlngs.push(pLatLng);

      const isCompleted = completadas.includes(idx);
      const isActive = idx === paradaActualIdx;

      // Crear icono de parada personalizado
      let stopIconHtml = "";
      if (isCompleted) {
        // Parada completada (verde)
        stopIconHtml = `
          <div style="width: 22px; height: 22px; border-radius: 50%; border: 2.2px solid #00e676; background: #041824; color: #00e676; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; box-shadow: 0 0 6px rgba(0, 230, 118, 0.4);">
            ✓
          </div>
        `;
      } else if (isActive) {
        // Parada actual / siguiente destino (cyan dinámico)
        stopIconHtml = `
          <div style="width: 24px; height: 24px; border-radius: 50%; border: 2.5px solid #00c8e8; background: #041824; color: #00c8e8; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; animation: stopPulse 1.8s infinite; box-shadow: 0 0 8px rgba(0, 200, 232, 0.6);">
            ${idx + 1}
          </div>
        `;
      } else {
        // Parada pendiente (gris azulado)
        stopIconHtml = `
          <div style="width: 20px; height: 20px; border-radius: 50%; border: 1.8px solid #3d6880; background: #041824; color: #7aa8be; display: flex; align-items: center; justify-content: center; font-size: 10px; font-family: var(--font);">
            ${idx + 1}
          </div>
        `;
      }

      const stopIcon = L.divIcon({
        html: stopIconHtml,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const tooltipContent = `
        <div style="font-family: 'Barlow', sans-serif; font-size: 12px;">
          <strong style="color: ${isActive ? '#00c8e8' : isCompleted ? '#00e676' : '#7aa8be'};">${s.nombre || s}</strong><br>
          <span style="color: #7aa8be; font-size: 10px;">${s.direccion || ''}</span><br>
          <span class="badge ${isCompleted ? 'bg' : isActive ? 'bc' : 'ba'}" style="font-size: 8px; padding: 1px 5px; margin-top: 3px; display: inline-block;">
            ${isCompleted ? 'COMPLETADA' : isActive ? 'SIGUIENTE PARADA' : 'PENDIENTE'}
          </span>
        </div>
      `;

      const marker = L.marker(pLatLng, { icon: stopIcon }).addTo(this.map);
      marker.bindTooltip(tooltipContent, { direction: 'top', offset: [0, -10] });
      this.stopMarkers.push(marker);
    });

    // Añadir la ubicación actual del camión a la polilínea como el punto de partida activo
    if (truck.lat && truck.lng) {
      // Insertar la posición del camión al principio o intercalarla según el estado
      // Para visualización simple, dibujamos la línea que conecta todas las paradas en orden
    }

    // Dibujar la polilínea que une la ruta
    this.routeLine = L.polyline(latlngs, {
      color: color,
      weight: 3.5,
      opacity: 0.65,
      dashArray: '8, 6', // Línea discontinua cibernética
      lineCap: 'round'
    }).addTo(this.map);

    // Ajustar vista para abarcar toda la ruta con margen
    if (latlngs.length > 0) {
      try {
        const bounds = L.latLngBounds(latlngs);
        if (truck.lat && truck.lng) {
          bounds.extend([parseFloat(truck.lat), parseFloat(truck.lng)]);
        }
        this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      } catch (e) {
        console.warn("No se pudo ajustar límites del mapa:", e);
      }
    }
  }

  /**
   * Limpia los elementos de ruta actuales del mapa
   */
  clearRoute() {
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
      this.routeLine = null;
    }
    this.stopMarkers.forEach(m => this.map.removeLayer(m));
    this.stopMarkers = [];
  }

  /**
   * Inicializa el motor de enrutamiento Leaflet Routing Machine
   * @param {Array} origin - [lat, lng] de inicio (ej. Planta)
   * @param {Array} destination - [lat, lng] de fin (ej. Planta)
   * @param {Array} waypoints - Arreglo de paradas intermedias [{lat, lng, nombre, direccion}]
   * @param {Function} onRouteChanged - Callback cuando cambian los waypoints por arrastre
   */
  initRouting(origin, destination, waypoints, onRouteChanged) {
    if (!this.map) return;

    // Limpiar polilíneas y marcadores estáticos de ruta si existen
    this.clearRoute();

    // Limpiar control de enrutamiento previo si existe
    if (this.routingControl) {
      try {
        this.map.removeControl(this.routingControl);
      } catch (e) {
        console.warn("Error al remover routingControl:", e);
      }
      this.routingControl = null;
    }

    // Convertir waypoints a L.LatLng
    const wpLatLngs = [
      L.latLng(origin[0], origin[1]),
      ...waypoints.map(w => L.latLng(parseFloat(w.lat), parseFloat(w.lng))),
      L.latLng(destination[0], destination[1])
    ];

    try {
      this.routingControl = L.Routing.control({
        waypoints: wpLatLngs,
        router: L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1',
          profile: 'driving'
        }),
        lineOptions: {
          styles: [{ color: '#00c8e8', opacity: 0.8, weight: 5 }]
        },
        show: false, // Ocultar panel de texto lateral nativo
        addWaypoints: false, // Bloquear añadir puntos intermedios haciendo clic en la línea
        draggableWaypoints: true, // Permitir mover los puntos arrastrándolos
        createMarker: (i, wp, n) => {
          const isStart = i === 0;
          const isEnd = i === n - 1;
          
          let iconHtml = "";
          if (isStart) {
            iconHtml = `<div style="width: 26px; height: 26px; border-radius: 50%; border: 2.5px solid #00e676; background: #041824; color: #00e676; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 0 8px rgba(0, 230, 118, 0.6); z-index: 1000;">🏭</div>`;
          } else if (isEnd) {
            iconHtml = `<div style="width: 26px; height: 26px; border-radius: 50%; border: 2.5px solid #ff4d4d; background: #041824; color: #ff4d4d; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 0 8px rgba(255, 77, 77, 0.6); z-index: 1000;">🏁</div>`;
          } else {
            iconHtml = `<div style="width: 22px; height: 22px; border-radius: 50%; border: 2px solid #00c8e8; background: #041824; color: #00c8e8; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; box-shadow: 0 0 6px rgba(0, 200, 232, 0.4);">${i}</div>`;
          }

          const markerIcon = L.divIcon({
            html: iconHtml,
            className: '',
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          });

          // Bloquear origen/destino para que no se puedan arrastrar
          const isDraggable = !isStart && !isEnd;

          const marker = L.marker(wp.latLng, {
            draggable: isDraggable,
            icon: markerIcon
          });

          if (isStart) {
            marker.bindTooltip('Planta (Origen)', { direction: 'top', offset: [0, -10] });
          } else if (isEnd) {
            marker.bindTooltip('Planta (Destino)', { direction: 'top', offset: [0, -10] });
          } else {
            marker.bindTooltip(`Parada ${i}: ${waypoints[i-1]?.nombre || ''}`, { direction: 'top', offset: [0, -10] });
          }

          return marker;
        }
      }).addTo(this.map);

      // Evento al modificar puntos arrastrándolos en el mapa
      this.routingControl.on('waypointschanged', (e) => {
        const newWps = e.waypoints;
        const intermediateWps = [];
        
        for (let i = 1; i < newWps.length - 1; i++) {
          const latlng = newWps[i].latLng;
          if (latlng) {
            const originalWp = waypoints[i - 1];
            intermediateWps.push({
              lat: latlng.lat,
              lng: latlng.lng,
              nombre: originalWp?.nombre || `Parada ${i}`,
              direccion: originalWp?.direccion || `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`,
              hora: originalWp?.hora || '—',
              instrucciones: originalWp?.instrucciones || 'Entrega estándar de cadena de frío.'
            });
          }
        }
        
        if (onRouteChanged) {
          // Detener callbacks recursivos de actualización si no hay diferencias
          const hashBefore = JSON.stringify(waypoints.map(w => [w.lat, w.lng]));
          const hashAfter = JSON.stringify(intermediateWps.map(w => [w.lat, w.lng]));
          if (hashBefore !== hashAfter) {
            onRouteChanged(intermediateWps);
          }
        }
      });

    } catch (e) {
      console.error("Error al configurar Leaflet Routing Machine:", e);
    }
  }

  /**
   * Registra un callback para clics en el mapa
   * @param {Function} callback - Callback que recibe el latlng del clic
   */
  onMapClick(callback) {
    if (!this.map) return;
    this.map.on('click', (e) => {
      callback(e.latlng);
    });
  }
}
