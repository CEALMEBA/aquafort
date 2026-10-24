const TELEFONO_WHATSAPP = "5212711482917";
const CLAVE_DATOS = "aquafort-datos-cliente";
// Registra el pedido como "pendiente" en el sistema de la purificadora; un empleado lo confirma después
const API_PEDIDOS = "https://aquafort.lealtaddigital.app/api/public/orders";
const ESPERA_API_MS = 8000;

// Coordenadas del GPS (se envían al sistema para ubicar al cliente en el mapa de rutas)
let coordenadas = null;

const $ = (id) => document.getElementById(id);

/* ---------- RECORDAR DATOS DEL CLIENTE ---------- */
function guardarDatos() {
    try {
        localStorage.setItem(CLAVE_DATOS, JSON.stringify({
            nombre: $("nombre").value.trim(),
            telefono: $("telefono").value.trim(),
            direccion: $("direccion").value.trim(),
            linkMapa: $("linkMapa").value.trim(),
            coordenadas
        }));
    } catch (e) { /* almacenamiento no disponible: se ignora */ }
}

function cargarDatos() {
    try {
        const datos = JSON.parse(localStorage.getItem(CLAVE_DATOS) || "null");
        if (!datos) return;
        $("nombre").value = datos.nombre || "";
        $("telefono").value = datos.telefono || "";
        if (datos.coordenadas && typeof datos.coordenadas.lat === "number") coordenadas = datos.coordenadas;
        $("direccion").value = datos.direccion || "";
        $("linkMapa").value = datos.linkMapa || "";
    } catch (e) { /* datos corruptos o sin acceso: se ignoran */ }
}

/* ---------- SELECTOR DE PRODUCTO ---------- */
function seleccionarProducto(elemento) {
    document.querySelectorAll(".product-option").forEach((opt) => {
        const activo = opt === elemento;
        opt.classList.toggle("selected", activo);
        opt.setAttribute("aria-checked", activo);
    });

    const valor = elemento.dataset.valor;
    $("producto").value = valor;

    const esDoble = valor.includes("Ambos");
    $("bloque-cantidad-simple").hidden = esDoble;
    $("bloque-cantidad-doble").hidden = !esDoble;
    limpiarErrores();
}

/* Teléfono a 10 dígitos (acepta +52, espacios y guiones); null si no es válido */
function telefonoLimpio(valor) {
    let digitos = valor.replace(/\D/g, "");
    if (digitos.length === 13 && digitos.startsWith("521")) digitos = digitos.slice(3);
    if (digitos.length === 12 && digitos.startsWith("52")) digitos = digitos.slice(2);
    return digitos.length === 10 ? digitos : null;
}

/* ---------- VALIDACIÓN EN LÍNEA ---------- */
function mostrarError(idCampo, mensaje) {
    const campo = $(idCampo);
    const aviso = $("error-" + idCampo);
    if (mensaje) {
        campo.setAttribute("aria-invalid", "true");
        aviso.textContent = mensaje;
    } else {
        campo.removeAttribute("aria-invalid");
        aviso.textContent = "";
    }
}

function limpiarErrores() {
    ["cantidad", "cantidadAgua", "cantidadHielo", "direccion", "nombre", "telefono"].forEach((id) => mostrarError(id, ""));
    $("error-cantidad-doble").textContent = "";
}

function esEnteroValido(valor, minimo) {
    return /^\d+$/.test(valor) && parseInt(valor, 10) >= minimo;
}

function validarFormulario() {
    limpiarErrores();
    let primerInvalido = null;
    const marcar = (id, msg) => { mostrarError(id, msg); primerInvalido = primerInvalido || $(id); };

    if ($("producto").value.includes("Ambos")) {
        const agua = $("cantidadAgua").value.trim();
        const hielo = $("cantidadHielo").value.trim();
        const aguaOk = esEnteroValido(agua, 0);
        const hieloOk = esEnteroValido(hielo, 0);

        if (!aguaOk) marcar("cantidadAgua", "Número inválido.");
        if (!hieloOk) marcar("cantidadHielo", "Número inválido.");
        if (aguaOk && hieloOk && parseInt(agua, 10) + parseInt(hielo, 10) === 0) {
            $("error-cantidad-doble").textContent = "Indica al menos 1 garrafón de agua o 1 bolsa de hielo.";
            primerInvalido = primerInvalido || $("cantidadAgua");
        }
    } else if (!esEnteroValido($("cantidad").value.trim(), 1)) {
        marcar("cantidad", "Indica una cantidad de 1 o más.");
    }

    if (!$("direccion").value.trim()) marcar("direccion", "Escribe tu dirección de entrega.");
    if (!$("nombre").value.trim()) marcar("nombre", "Escribe tu nombre.");
    if (!telefonoLimpio($("telefono").value)) marcar("telefono", "Escribe tu teléfono a 10 dígitos.");

    if (primerInvalido) {
        primerInvalido.focus();
        return false;
    }
    return true;
}

/* ---------- OBTENER UBICACIÓN GPS ---------- */
function obtenerUbicacion() {
    const estado = $("ubicacion-estado");

    if (!navigator.geolocation) {
        estado.textContent = "⚠️ Tu navegador no permite obtener la ubicación. Pega tu enlace de Google Maps abajo.";
        estado.className = "ubicacion-estado error";
        return;
    }

    estado.textContent = "⏳ Obteniendo tu ubicación, acepta el permiso...";
    estado.className = "ubicacion-estado cargando";

    navigator.geolocation.getCurrentPosition(
        (posicion) => {
            const lat = posicion.coords.latitude.toFixed(6);
            const lng = posicion.coords.longitude.toFixed(6);
            const enlace = `https://www.google.com/maps?q=${lat},${lng}`;
            coordenadas = { lat: Number(lat), lng: Number(lng) };

            $("linkMapa").value = enlace;
            guardarDatos();

            estado.innerHTML = `✅ ¡Ubicación capturada! <a href="${enlace}" target="_blank" rel="noopener">Ver en el mapa</a>`;
            estado.className = "ubicacion-estado ok";
        },
        (error) => {
            let mensaje = "⚠️ No pudimos obtener tu ubicación. ";
            if (error.code === error.PERMISSION_DENIED) {
                mensaje += "Permiso denegado: actívalo en tu navegador o pega el enlace de Google Maps abajo.";
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                mensaje += "Señal no disponible. Pega el enlace de Google Maps abajo.";
            } else {
                mensaje += "Intenta de nuevo o pega el enlace de Google Maps abajo.";
            }
            estado.textContent = mensaje;
            estado.className = "ubicacion-estado error";
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
}

/* ---------- REGISTRAR PEDIDO EN EL SISTEMA ---------- */
// Devuelve el número de pedido, o null si no se pudo registrar (el pedido igual se manda por WhatsApp)
async function registrarPedido(datos) {
    const control = new AbortController();
    const espera = setTimeout(() => control.abort(), ESPERA_API_MS);
    try {
        const respuesta = await fetch(API_PEDIDOS, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datos),
            signal: control.signal
        });
        const cuerpo = await respuesta.json().catch(() => ({}));
        return respuesta.ok && cuerpo.id ? cuerpo.id : null;
    } catch (e) {
        return null; // sin conexión o el sistema no respondió a tiempo
    } finally {
        clearTimeout(espera);
    }
}

/* ---------- ENVIAR PEDIDO (SISTEMA + WHATSAPP) ---------- */
async function enviarWhatsApp() {
    if (!validarFormulario()) return;

    // La pestaña se abre antes de esperar al sistema: si se abre después, el navegador la bloquea como ventana emergente
    const ventana = window.open("", "_blank");
    if (ventana) ventana.opener = null;

    const boton = $("btn-enviar");
    const estado = $("estado-envio");
    boton.disabled = true;
    estado.textContent = "⏳ Registrando tu pedido...";

    const producto  = $("producto").value;
    const direccion = $("direccion").value.trim();
    const nombre    = $("nombre").value.trim();
    const telefono  = telefonoLimpio($("telefono").value);
    const mapa      = $("linkMapa").value.trim();

    let agua = 0;
    let hielo = 0;
    if (producto.includes("Ambos")) {
        agua  = parseInt($("cantidadAgua").value, 10);
        hielo = parseInt($("cantidadHielo").value, 10);
    } else if (producto.includes("Hielo")) {
        hielo = parseInt($("cantidad").value, 10);
    } else {
        agua = parseInt($("cantidad").value, 10);
    }

    guardarDatos();

    const numeroPedido = await registrarPedido({
        name: nombre,
        phone: telefono,
        address: direccion,
        latitude: coordenadas ? coordenadas.lat : null,
        longitude: coordenadas ? coordenadas.lng : null,
        mapLink: mapa.startsWith("https://") ? mapa : null,
        water: agua,
        ice: hielo,
        website: $("sitioWeb").value
    });

    const lineas = ["¡Hola! Quisiera hacer un pedido:", ""];
    if (numeroPedido) lineas.push(`🧾 Pedido #${numeroPedido}`);

    if (producto.includes("Ambos")) {
        lineas.push("🛒 Producto: Agua + Hielo");
        if (agua  > 0) lineas.push(`💧 Garrafones de agua: ${agua}`);
        if (hielo > 0) lineas.push(`🧊 Bolsas de hielo: ${hielo}`);
    } else {
        const iconoProducto = producto.includes("Hielo") ? "🧊" : "💧";
        lineas.push(`${iconoProducto} Producto: ${producto}`);
        lineas.push(`📦 Cantidad: ${agua + hielo}`);
    }

    lineas.push(`📍 Dirección: ${direccion}`);
    if (mapa) lineas.push(`🗺️ Ubicación exacta: ${mapa}`);
    lineas.push("");
    lineas.push("📷 Si puedes, pasa una foto de la fachada de tu casa para mayor seguridad. Envíala directamente en este chat. Si no, nos comunicaremos contigo cuando estemos cerca de tu domicilio.");
    lineas.push("");
    lineas.push(`👤 A nombre de: ${nombre}`);
    lineas.push(`📞 Teléfono: ${telefono}`);

    const urlWhatsApp = `https://api.whatsapp.com/send?phone=${TELEFONO_WHATSAPP}&text=${encodeURIComponent(lineas.join("\n"))}`;
    if (ventana) {
        ventana.location.href = urlWhatsApp;
    } else {
        window.location.href = urlWhatsApp; // ventanas emergentes bloqueadas: se abre en esta misma pestaña
    }

    estado.textContent = numeroPedido
        ? `✅ Pedido #${numeroPedido} registrado. Termina de enviarlo en WhatsApp.`
        : "Termina de enviar tu pedido en WhatsApp.";
    boton.disabled = false;
}

/* ---------- INICIO ---------- */
document.querySelectorAll(".product-option").forEach((opt) => {
    opt.addEventListener("click", () => seleccionarProducto(opt));
});
$("btn-ubicacion").addEventListener("click", obtenerUbicacion);
$("btn-enviar").addEventListener("click", enviarWhatsApp);
["nombre", "telefono", "direccion", "linkMapa"].forEach((id) => $(id).addEventListener("change", guardarDatos));
// Si el cliente cambia el enlace a mano, las coordenadas del GPS ya no corresponden (el sistema las saca del enlace)
$("linkMapa").addEventListener("input", () => { coordenadas = null; });
["cantidad", "cantidadAgua", "cantidadHielo", "direccion", "nombre", "telefono"].forEach((id) =>
    $(id).addEventListener("input", () => mostrarError(id, ""))
);
cargarDatos();
