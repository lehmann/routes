import { useEffect, useState } from 'react';

export interface UserPosition {
  lon: number;
  lat: number;
  accuracy: number;
}

// O watch só começa após clique do usuário (start), o que dispara o prompt de permissão
export function useUserLocation() {
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!active) return;
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setError('');
        setPosition({ lon: coords.longitude, lat: coords.latitude, accuracy: coords.accuracy });
      },
      err => setError(err.code === err.PERMISSION_DENIED
        ? 'Permissão de localização negada.'
        : 'Não foi possível obter sua posição.'),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [active]);

  const start = () => {
    if (!('geolocation' in navigator)) {
      setError('Geolocalização indisponível (é preciso HTTPS ou localhost).');
      return;
    }
    setError('');
    setActive(true);
  };

  const stop = () => {
    setActive(false);
    setPosition(null);
    setError('');
  };

  return { active, position, error, start, stop };
}
