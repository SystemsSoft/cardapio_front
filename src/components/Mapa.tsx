import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';

const pino = L.divIcon({
  className: '',
  html: '<div class="mapa-pino"><span></span></div>',
  iconSize: [34, 44],
  iconAnchor: [17, 42],
});

export interface CirculoMapa {
  raioKm: number;
  cor: string;
}

/**
 * Mapa do OpenStreetMap com um pino. `editavel`: arrastar o pino ou tocar no mapa muda o ponto.
 * `circulos`: raios em volta do pino (ex.: faixas de entrega); o mapa enquadra o maior.
 */
export default function Mapa({
  latitude,
  longitude,
  editavel,
  aoMudar,
  circulos,
  className = 'h-56',
}: {
  latitude: number;
  longitude: number;
  editavel?: boolean;
  aoMudar?: (lat: number, lng: number) => void;
  circulos?: CirculoMapa[];
  className?: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const marcador = useRef<L.Marker | null>(null);
  const aneis = useRef<L.LayerGroup | null>(null);
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
    aneis.current = L.layerGroup().addTo(m);
    const mk = L.marker([latitude, longitude], { icon: pino, draggable: !!editavel, keyboard: false, zIndexOffset: 1000 }).addTo(m);
    const moverAneis = (p: L.LatLng) => aneis.current?.eachLayer((c) => (c as L.Circle).setLatLng(p));
    if (editavel) {
      mk.on('drag', () => moverAneis(mk.getLatLng()));
      mk.on('dragend', () => {
        const p = mk.getLatLng();
        mudar.current?.(p.lat, p.lng);
      });
      m.on('click', (ev: L.LeafletMouseEvent) => {
        mk.setLatLng(ev.latlng);
        moverAneis(ev.latlng);
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
      aneis.current = null;
    };
    // O mapa é criado uma vez; mudanças de ponto e de círculos entram pelos efeitos abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editavel]);

  useEffect(() => {
    const mk = marcador.current;
    if (!mk || !mapa.current) return;
    const p = mk.getLatLng();
    if (Math.abs(p.lat - latitude) > 1e-7 || Math.abs(p.lng - longitude) > 1e-7) {
      mk.setLatLng([latitude, longitude]);
      aneis.current?.eachLayer((c) => (c as L.Circle).setLatLng([latitude, longitude]));
      if (!circulos?.length) mapa.current.setView([latitude, longitude], Math.max(mapa.current.getZoom(), 16));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  // Desenha os anéis (do maior para o menor, para o menor ficar por cima) e enquadra o maior.
  const chave = JSON.stringify(circulos ?? []);
  useEffect(() => {
    const m = mapa.current;
    const g = aneis.current;
    if (!m || !g) return;
    g.clearLayers();
    const lista = [...(circulos ?? [])].sort((a, b) => b.raioKm - a.raioKm);
    for (const c of lista) {
      L.circle([latitude, longitude], { radius: c.raioKm * 1000, color: c.cor, weight: 2, fillColor: c.cor, fillOpacity: 0.07, interactive: false }).addTo(g);
    }
    if (lista.length) {
      const maior = L.circle([latitude, longitude], { radius: lista[0].raioKm * 1000 });
      maior.addTo(m);
      m.fitBounds(maior.getBounds(), { padding: [16, 16] });
      maior.remove();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, latitude, longitude]);

  return <div ref={caixa} className={`relative z-0 w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100 ${className}`} />;
}
