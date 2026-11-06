const BASE_URL = window.location.protocol === 'file:' 
  ? 'http://localhost:3000' 
  : '';
const API_URL = `${BASE_URL}/personas`;
const AUTH_URL = `${BASE_URL}/login`;

// Elementos de autenticación
const formLogin = document.getElementById('formLogin');
const loginUsuario = document.getElementById('loginUsuario');
const loginPass = document.getElementById('loginPass');
const contenedorLogin = document.getElementById('contenedorLogin');
const contenedorSesion = document.getElementById('contenedorSesion');
const lblUsuario = document.getElementById('lblUsuario');
const btnCerrarSesion = document.getElementById('btnCerrarSesion');
const authMensaje = document.getElementById('authMensaje');

// Elementos de personas
const formCrear = document.getElementById('formCrear');
const inputCrearNombre = document.getElementById('crearNombre');
const inputCrearEdad = document.getElementById('crearEdad');

const inputBuscarId = document.getElementById('buscarId');
const btnBuscarId = document.getElementById('btnBuscarId');

const inputBuscarNombre = document.getElementById('buscarNombre');
const btnBuscarNombre = document.getElementById('btnBuscarNombre');

const btnListarTodos = document.getElementById('btnListarTodos');
const listaCuerpo = document.getElementById('listaCuerpo');
const mensajeAlerta = document.getElementById('mensajeAlerta');

// Manejo de estado de sesión JWT
function actualizarEstadoAuth() {
  const token = localStorage.getItem('jwt_token');
  const usuario = localStorage.getItem('jwt_usuario');

  if (token && usuario) {
    contenedorLogin.classList.add('oculto');
    contenedorSesion.classList.remove('oculto');
    lblUsuario.textContent = usuario;
  } else {
    contenedorLogin.classList.remove('oculto');
    contenedorSesion.classList.add('oculto');
    lblUsuario.textContent = '';
  }
}

// Login
if (formLogin) {
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    authMensaje.classList.add('oculto');

    try {
      const res = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: loginUsuario.value.trim(),
          contrasena: loginPass.value.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        authMensaje.textContent = data.error || 'Credenciales inválidas';
        authMensaje.classList.remove('oculto');
        return;
      }

      // Guardar token y usuario
      localStorage.setItem('jwt_token', data.token);
      localStorage.setItem('jwt_usuario', data.usuario);
      loginUsuario.value = '';
      loginPass.value = '';
      actualizarEstadoAuth();
    } catch (err) {
      authMensaje.textContent = 'Error de conexión con el servidor.';
      authMensaje.classList.remove('oculto');
    }
  });
}

// Cerrar sesión
if (btnCerrarSesion) {
  btnCerrarSesion.addEventListener('click', () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('jwt_usuario');
    actualizarEstadoAuth();
  });
}

actualizarEstadoAuth();

function mostrarError(mensaje) {
  mensajeAlerta.textContent = mensaje;
  mensajeAlerta.classList.remove('oculto');
}

function limpiarError() {
  mensajeAlerta.textContent = '';
  mensajeAlerta.classList.add('oculto');
}

function renderizarTabla(datos) {
  listaCuerpo.innerHTML = '';
  if (!datos || datos.length === 0) {
    listaCuerpo.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay personas registradas</td></tr>';
    return;
  }

  datos.forEach((persona) => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${persona.id}</td>
      <td>${persona.nombre}</td>
      <td>${persona.edad}</td>
      <td>
        <button class="btn-eliminar" onclick="eliminarPersona(${persona.id})">Eliminar</button>
      </td>
    `;
    listaCuerpo.appendChild(fila);
  });
}

// 1. Obtener y listar todas las personas (GET /personas o /listar-personas)
async function cargarPersonas() {
  limpiarError();
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    renderizarTabla(data);
  } catch (error) {
    mostrarError('Error al conectar con el servidor para listar las personas.');
  }
}

// 2. Crear nueva persona (POST)
formCrear.addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarError();

  const nombre = inputCrearNombre.value.trim();
  const edad = Number(inputCrearEdad.value);

  if (!nombre) {
    mostrarError('El nombre es obligatorio.');
    return;
  }

  if (Number.isNaN(edad) || edad < 0) {
    mostrarError('La edad debe ser un número entero mayor o igual a 0.');
    return;
  }

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nombre, edad })
    });

    const data = await res.json();

    if (!res.ok) {
      mostrarError(data.error || 'Error al agregar la persona.');
      return;
    }

    inputCrearNombre.value = '';
    inputCrearEdad.value = '';
    await cargarPersonas();
  } catch (error) {
    mostrarError('Error de red al intentar agregar la persona. Verifica que el servidor esté encendido.');
  }
});

// 3. Buscar persona por ID (GET /personas/:id)
btnBuscarId.addEventListener('click', async () => {
  limpiarError();
  const id = inputBuscarId.value.trim();
  if (!id) return;

  try {
    const res = await fetch(`${API_URL}/${id}`);
    const data = await res.json();

    if (!res.ok) {
      mostrarError(data.error || 'Persona no encontrada.');
      renderizarTabla([]);
      return;
    }

    renderizarTabla([data]);
  } catch (error) {
    mostrarError('Error al buscar por ID.');
  }
});

// 4. Filtrar persona por nombre (GET /personas/nombre/:nombre)
btnBuscarNombre.addEventListener('click', async () => {
  limpiarError();
  const nombre = inputBuscarNombre.value.trim();
  if (!nombre) return;

  try {
    const res = await fetch(`${API_URL}/nombre/${encodeURIComponent(nombre)}`);
    const data = await res.json();

    if (!res.ok) {
      mostrarError(data.error || 'No se encontraron coincidencias.');
      renderizarTabla([]);
      return;
    }

    renderizarTabla(data);
  } catch (error) {
    mostrarError('Error al buscar por nombre.');
  }
});

// 5. Eliminar persona (DELETE /personas/:id)
async function eliminarPersona(id) {
  limpiarError();
  try {
    const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    if (res.ok) {
      cargarPersonas();
    } else {
      const data = await res.json();
      mostrarError(data.error || 'No se pudo eliminar.');
    }
  } catch (error) {
    mostrarError('Error al intentar eliminar la persona.');
  }
}

// 6. Botón Ver Todos
btnListarTodos.addEventListener('click', () => {
  inputBuscarId.value = '';
  inputBuscarNombre.value = '';
  cargarPersonas();
});

// Carga inicial
cargarPersonas();

