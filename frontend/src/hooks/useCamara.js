import { useCallback, useEffect, useRef, useState } from 'react';

// Cámara frontal del equipo. Estados: inactiva | solicitando | activa | denegada | sin_camara | ocupada.
// Solo muestra el vídeo: nunca captura ni guarda imágenes. Todas las pistas se detienen al desmontar.
function estadoDeError(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denegada';
    case 'NotReadableError':
    case 'AbortError':
    case 'TrackStartError':
      return 'ocupada';
    default:
      return 'sin_camara'; // NotFoundError, OverconstrainedError, sin soporte…
  }
}

export function useCamara() {
  const videoRef = useRef(null);
  const flujoRef = useRef(null);
  const montado = useRef(true);
  const [estado, setEstado] = useState('inactiva');

  const detener = useCallback(() => {
    flujoRef.current?.getTracks().forEach((pista) => pista.stop());
    flujoRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (montado.current) setEstado('inactiva');
  }, []);

  const iniciar = useCallback(async () => {
    if (flujoRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setEstado('sin_camara');
      return;
    }
    setEstado('solicitando');
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false,
      });
      if (!montado.current) {
        flujo.getTracks().forEach((pista) => pista.stop());
        return;
      }
      flujoRef.current = flujo;
      if (videoRef.current) {
        videoRef.current.srcObject = flujo;
        Promise.resolve(videoRef.current.play?.()).catch(() => {});
      }
      setEstado('activa');
    } catch (error) {
      if (montado.current) setEstado(estadoDeError(error));
    }
  }, []);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      flujoRef.current?.getTracks().forEach((pista) => pista.stop());
      flujoRef.current = null;
    };
  }, []);

  return { videoRef, estado, iniciar, detener };
}
