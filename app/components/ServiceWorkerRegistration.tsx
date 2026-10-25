'use client';
import { useEffect } from 'react';

// Só em produção: em dev o service worker atrapalharia o HMR
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(err => console.error('Service worker não registrado', err));
  }, []);

  return null;
}
