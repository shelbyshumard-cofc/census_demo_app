// components/DemographicsMap.js
import { useEffect, useRef } from 'react';

export default function DemographicsMap({ lat, lng, radiusMiles, onReady }) {
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const circleRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (mapRef.current && leafletRef.current) return; // already initialized

    import('leaflet').then(L => {
      // Fix default icon paths broken by webpack
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const initialLat = lat || 32.7765;
      const initialLng = lng || -79.9311;

      const map = L.map('map', {
        center: [initialLat, initialLng],
        zoom: lat ? getZoomForRadius(radiusMiles || 5) : 10,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      leafletRef.current = L;

      if (onReady) onReady(map, L);

      if (lat && lng) {
        addMarkerAndCircle(L, map, lat, lng, radiusMiles || 5);
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        leafletRef.current = null;
        circleRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Update marker & circle when lat/lng/radius changes
  useEffect(() => {
    if (!mapRef.current || !leafletRef.current || !lat || !lng) return;
    const L = leafletRef.current;
    const map = mapRef.current;

    if (circleRef.current) circleRef.current.remove();
    if (markerRef.current) markerRef.current.remove();

    addMarkerAndCircle(L, map, lat, lng, radiusMiles || 5);
  }, [lat, lng, radiusMiles]);

  function addMarkerAndCircle(L, map, lat, lng, miles) {
    const radiusMeters = miles * 1609.34;
    const zoom = getZoomForRadius(miles);

    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: '',
        html: `<div style="
          width:12px;height:12px;border-radius:50%;
          background:#2563eb;border:2.5px solid white;
          box-shadow:0 1px 6px rgba(0,0,0,0.35)">
        </div>`,
        iconAnchor: [6, 6],
      })
    }).addTo(map);

    const circle = L.circle([lat, lng], {
      radius: radiusMeters,
      color: '#2563eb',
      fillColor: '#2563eb',
      fillOpacity: 0.08,
      weight: 2,
      dashArray: '6 4',
    }).addTo(map);

    markerRef.current = marker;
    circleRef.current = circle;

    map.setView([lat, lng], zoom, { animate: true, duration: 0.6 });
  }

  return <div id="map" style={{ width: '100%', height: '100%' }} />;
}

function getZoomForRadius(miles) {
  if (miles <= 1) return 13;
  if (miles <= 5) return 11;
  return 10;
}
