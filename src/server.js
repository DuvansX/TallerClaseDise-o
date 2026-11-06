const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'clave_secreta_super_segura_jwt_123';

// Funciones nativas de JWT y Encriptación (utilizando módulo nativo crypto de Node.js)
function base64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function generarJWT(payload, secreto, duracionSegundos = 7200) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + duracionSegundos;
  const data = base64url(JSON.stringify({ ...payload, exp }));
  const signature = crypto
    .createHmac('sha256', secreto)
    .update(`${header}.${data}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${header}.${data}.${signature}`;
}

function verificarJWT(token, secreto) {
  try {
    const partes = token.split('.');
    if (partes.length !== 3) return null;
    const [header, data, signature] = partes;
    const firmaEsperada = crypto
      .createHmac('sha256', secreto)
      .update(`${header}.${data}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (signature !== firmaEsperada) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function encriptarPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function compararPassword(password, storedHash) {
  try {
    const [salt, key] = storedHash.split(':');
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

// Base de datos de usuarios en memoria (admin / 123456 precargado y encriptado)
const usuarios = [
  {
    id: 1,
    usuario: 'admin',
    contrasena: encriptarPassword('123456')
  }
];

// Middleware para habilitar CORS (permite peticiones si abres el HTML directo con doble clic)
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (_req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Middleware para verificar el token JWT
function autenticarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }

  const payload = verificarJWT(token, JWT_SECRET);
  if (!payload) {
    return res.status(403).json({ error: 'Token inválido o expirado.' });
  }

  req.usuario = payload;
  next();
}

// ============================================================================
// ENDPOINTS DE AUTENTICACIÓN (LOGIN Y REGISTRO CON JWT Y CONTRASEÑAS ENCRIPTADAS)
// ============================================================================

// Soporte para GET /login en el navegador
app.get(['/login', '/auth/login', '/iniciar-sesion'], (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Registro de usuario con contraseña encriptada
app.post('/registro', (req, res) => {
  const { usuario, contrasena } = req.body;

  if (!usuario || !contrasena) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
  }

  const existe = usuarios.find((u) => u.usuario === usuario.trim());
  if (existe) {
    return res.status(400).json({ error: 'El usuario ya existe.' });
  }

  const passwordEncriptada = encriptarPassword(contrasena);
  const nuevoUsuario = {
    id: usuarios.length + 1,
    usuario: usuario.trim(),
    contrasena: passwordEncriptada
  };

  usuarios.push(nuevoUsuario);
  res.status(201).json({ mensaje: 'Usuario registrado con éxito.' });
});

// Inicio de sesión y generación de JWT (soporta /login, /auth/login y /personas/login)
app.post(['/login', '/auth/login', '/personas/login', '/api/login'], (req, res) => {
  const { usuario, contrasena } = req.body;

  if (!usuario || !contrasena) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
  }

  const user = usuarios.find((u) => u.usuario === usuario.trim());
  if (!user) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }

  const passValida = compararPassword(contrasena, user.contrasena);
  if (!passValida) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }

  // Generar token JWT estándar firmado
  const token = generarJWT(
    { id: user.id, usuario: user.usuario },
    JWT_SECRET,
    7200 // 2 horas
  );

  res.json({
    mensaje: 'Inicio de sesión exitoso',
    token,
    usuario: user.usuario
  });
});

let nextId = 4;
const personas = [
  { id: 1, nombre: 'Ana Gómez', edad: 25 },
  { id: 2, nombre: 'Carlos Pérez', edad: 30 },
  { id: 3, nombre: 'María López', edad: 22 }
];

function validarPersona({ nombre, edad }) {
  if (typeof nombre !== 'string' || nombre.trim().length === 0) {
    return 'El campo "nombre" es obligatorio y debe ser texto.';
  }

  if (!Number.isInteger(edad) || edad < 0) {
    return 'El campo "edad" es obligatorio y debe ser un entero mayor o igual a 0.';
  }

  return null;
}

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ============================================================================
// RETO: Endpoint que lista todas las personas
// ============================================================================
app.get('/personas', (req, res) => {
  const { nombre } = req.query;

  // Filtrado opcional por query parameter: /personas?nombre=Ana
  if (nombre) {
    const filtradas = personas.filter((p) =>
      p.nombre.toLowerCase().includes(nombre.toLowerCase().trim())
    );
    return res.json(filtradas);
  }

  res.json(personas);
});

// Alias explícito para listar personas: GET /listar-personas
app.get('/listar-personas', (_req, res) => {
  res.json(personas);
});

// ============================================================================
// Endpoint para filtrar personas por nombre (Ruta: /personas/nombre/:nombre)
// ============================================================================
app.get('/personas/nombre/:nombre', (req, res) => {
  const nombre = req.params.nombre.toLowerCase().trim();
  const resultados = personas.filter((item) =>
    item.nombre.toLowerCase().includes(nombre)
  );

  if (resultados.length === 0) {
    return res.status(404).json({ error: 'No se encontraron personas con ese nombre.' });
  }

  res.json(resultados);
});

// Soporte también para ruta en singular: /persona/nombre/:nombre
app.get('/persona/nombre/:nombre', (req, res) => {
  const nombre = req.params.nombre.toLowerCase().trim();
  const resultados = personas.filter((item) =>
    item.nombre.toLowerCase().includes(nombre)
  );

  if (resultados.length === 0) {
    return res.status(404).json({ error: 'No se encontraron personas con ese nombre.' });
  }

  res.json(resultados);
});

// ============================================================================
// RETO: Endpoint que trae a una persona con el ID específico
// ============================================================================
app.get('/personas/:id', (req, res) => {
  const id = Number(req.params.id);

  // Validación: verificar que el ID enviado sea un número
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'El ID debe ser un número válido.' });
  }

  // Buscar la persona en la lista por su ID
  const persona = personas.find((item) => item.id === id);

  // Si no se encuentra, retornar 404
  if (!persona) {
    return res.status(404).json({ error: 'Persona no encontrada.' });
  }

  // Retornar la persona encontrada
  res.json(persona);
});

// Soporte también para la ruta singular: GET /persona/:id
app.get('/persona/:id', (req, res) => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'El ID debe ser un número válido.' });
  }

  const persona = personas.find((item) => item.id === id);

  if (!persona) {
    return res.status(404).json({ error: 'Persona no encontrada.' });
  }

  res.json(persona);
});

app.post('/personas', (req, res) => {
  const error = validarPersona(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const persona = {
    id: nextId++,
    nombre: req.body.nombre.trim(),
    edad: req.body.edad
  };

  personas.push(persona);
  res.status(201).json(persona);
});

app.put('/personas/:id', (req, res) => {
  const id = Number(req.params.id);
  const persona = personas.find((item) => item.id === id);

  if (!persona) {
    return res.status(404).json({ error: 'Persona no encontrada.' });
  }

  const error = validarPersona(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  persona.nombre = req.body.nombre.trim();
  persona.edad = req.body.edad;
  res.json(persona);
});

app.delete('/personas/:id', (req, res) => {
  const id = Number(req.params.id);
  const indice = personas.findIndex((item) => item.id === id);

  if (indice === -1) {
    return res.status(404).json({ error: 'Persona no encontrada.' });
  }

  personas.splice(indice, 1);
  res.status(204).send();
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

app.listen(port, () => {
  console.log(`Servidor V1 (En Memoria) disponible en http://localhost:${port}`);
});

