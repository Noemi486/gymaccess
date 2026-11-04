import { configure } from '@testing-library/react';

// Configuración común de las pruebas del frontend. Con más de 25 archivos corriendo en paralelo en una laptop,
// 1 segundo (el valor por defecto de findBy/waitFor) no alcanza a veces y las pruebas fallan de forma intermitente.
configure({ asyncUtilTimeout: 4000 });
