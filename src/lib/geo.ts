/** Localização do endereço de entrega: GPS do aparelho + endereço pelo OpenStreetMap (Nominatim). */

export interface Posicao {
  latitude: number;
  longitude: number;
  precisao?: number; // metros
}

export function obterPosicao(): Promise<Posicao> {
  return new Promise((ok, falha) => {
    if (!('geolocation' in navigator)) return falha(new Error('Este aparelho não informa a localização. Preencha o endereço manualmente.'));
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ latitude: p.coords.latitude, longitude: p.coords.longitude, precisao: p.coords.accuracy }),
      (e) =>
        falha(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? 'A localização foi bloqueada. Libere o acesso à localização para este site no navegador, ou preencha o endereço.'
              : e.code === e.TIMEOUT
                ? 'Demorou demais para achar a sua localização. Tente de novo perto de uma janela, ou preencha o endereço.'
                : 'Não foi possível achar a sua localização. Verifique se o GPS está ligado, ou preencha o endereço.',
          ),
        ),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 },
    );
  });
}

export interface EnderecoAchado {
  rua: string;
  numero: string;
  bairro: string;
}

/** Endereço aproximado de um ponto (OpenStreetMap). Sem rede ou sem resultado: null. */
export async function enderecoDaPosicao(lat: number, lng: number): Promise<EnderecoAchado | null> {
  try {
    const u = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=pt-BR&lat=${lat}&lon=${lng}`;
    const r = await fetch(u, { headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    const j = (await r.json()) as { address?: Record<string, string> };
    const a = j.address;
    if (!a) return null;
    return {
      rua: a.road || a.pedestrian || a.residential || a.footway || '',
      numero: a.house_number || '',
      bairro: a.suburb || a.neighbourhood || a.quarter || a.city_district || a.village || '',
    };
  } catch {
    return null;
  }
}

export const linkMapa = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
export const linkRota = (lat: number, lng: number, origem?: { latitude: number; longitude: number } | null) =>
  `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${origem ? `${origem.latitude}%2C${origem.longitude}` : ''}%3B${lat}%2C${lng}#map=16/${lat}/${lng}`;
/** Busca do endereço digitado no OpenStreetMap (quando o cliente não marcou a localização). */
export const linkBusca = (endereco: string) => `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${endereco}, Brasil`)}`;
