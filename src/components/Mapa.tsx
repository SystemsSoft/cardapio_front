import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';

const pino = L.divIcon({
  className: '',
  html: '<div class="mapa-pino"><span></span></div>',
  iconSize: [34, 44],
  iconAnchor: [17, 42],
});

/** Mapa do OpenStreetMap com um pino. `editavel`: arrastar o pino ou tocar no mapa muda o ponto. */
export default function Mapa({
  latitude,
  longitude,
  editavel,
  aoMudar,
  className = 'h-56',
}: {
  latitude: number;
  longitude: number;
  editavel?: boolean;
  aoMudar?: (lat: number, lng: number) => void;
  className?: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const marcador = useRef<L.Marker | null>(null);
  const mudar = useRef(aoMudar);
  mudar.current = aoMudar;

  useEffect(() => {
    if (!caixa.current) return;
    const m = L.map(caixa.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([latitude, longitude], 17);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(m);
    m.attributionControl.setPrefix(false);
    const mk = L.marker([latitude, longitude], { icon: pino, draggable: !!editavel, keyboard: false }).addTo(m);
    if (editavel) {
      mk.on('dragend', () => {
        const p = mk.getLatLng();
        mudar.current?.(p.lat, p.lng);
      });
      m.on('click', (ev: L.LeafletMouseEvent) => {
        mk.setLatLng(ev.latlng);
        mudar.current?.(ev.latlng.lat, ev.latlng.lng);
      });
    }
    mapa.current = m;
    marcador.current = mk;
    // Dentro de janelas que abrem com animação o tamanho só fica certo depois.
    const t = setTimeout(() => m.invalidateSize(), 250);
    return () => {
      clearTimeout(t);
      m.remove();
      mapa.current = null;
      marcador.current = null;
    };
    // O mapa é criado uma vez; mudanças de ponto entram pelo efeito abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editavel]);

  useEffect(() => {
    const mk = marcador.current;
    if (!mk || !mapa.current) return;
    const p = mk.getLatLng();
    if (Math.abs(p.lat - latitude) > 1e-7 || Math.abs(p.lng - longitude) > 1e-7) {
      mk.setLatLng([latitude, longitude]);
      mapa.current.setView([latitude, longitude], Math.max(mapa.current.getZoom(), 16));
    }
  }, [latitude, longitude]);

  return <div ref={caixa} className={`relative z-0 w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100 ${className}`} />;
}
