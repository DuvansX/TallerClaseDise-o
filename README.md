# Versión 1 - Servidor en Memoria con JWT

Esta es la copia de respaldo de la versión anterior a la integración con MySQL y MVC.

## Características de la V1:
- Servidor en memoria (`personas = []`, `usuarios = []`).
- Autenticación con JWT nativo (módulo `crypto`).
- Contraseñas encriptadas con `scrypt` + `salt`.
- Frontend en HTML, CSS y JavaScript Vanilla.

## Ejecución de esta versión:
```bash
cd V1
npm start
```

