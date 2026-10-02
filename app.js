const TELEFONO_WHATSAPP = "5212711482917";
const CLAVE_DATOS = "aquafort-datos-cliente";

const $ = (id) => document.getElementById(id);

/* ---------- RECORDAR DATOS DEL CLIENTE ---------- */
function guardarDatos() {
    try {
        localStorage.setItem(CLAVE_DATOS, JSON.stringify({
            nombre: $("nombre").value.trim(),
            direccion: $("direccion").value.trim(),
            linkMapa: $("linkMapa").value.trim()
        }));
    } catch (e) { /* almacenamiento no disponible: se ignora */ }
}

function cargarDatos() {
    try {
        const datos = JSON.parse(localStorage.getItem(CLAVE_DATOS) || "null");
        if (!datos) return;
        $("nombre").value = datos.nombre || "";
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
    ["cantidad", "cantidadAgua", "cantidadHielo", "direccion", "nombre"].forEach((id) => mostrarError(id, ""));
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

/* ---------- ENVIAR PEDIDO A WHATSAPP ---------- */
function enviarWhatsApp() {
    if (!validarFormulario()) return;

    const producto  = $("producto").value;
    const direccion = $("direccion").value.trim();
    const nombre    = $("nombre").value.trim();
    const mapa      = $("linkMapa").value.trim();

    const lineas = ["¡Hola! Quisiera hacer un pedido:", ""];

    if (producto.includes("Ambos")) {
        const agua  = parseInt($("cantidadAgua").value, 10);
        const hielo = parseInt($("cantidadHielo").value, 10);

        lineas.push("🛒 Producto: Agua + Hielo");
        if (agua  > 0) lineas.push(`💧 Garrafones de agua: ${agua}`);
        if (hielo > 0) lineas.push(`🧊 Bolsas de hielo: ${hielo}`);
    } else {
        const iconoProducto = producto.includes("Hielo") ? "🧊" : "💧";
        lineas.push(`${iconoProducto} Producto: ${producto}`);
        lineas.push(`📦 Cantidad: ${parseInt($("cantidad").value, 10)}`);
    }

    lineas.push(`📍 Dirección: ${direccion}`);
    if (mapa) lineas.push(`🗺️ Ubicación exacta: ${mapa}`);
    lineas.push("");
    lineas.push("📷 Si puedes, pasa una foto de la fachada de tu casa para mayor seguridad. Envíala directamente en este chat. Si no, nos comunicaremos contigo cuando estemos cerca de tu domicilio.");
    lineas.push("");
    lineas.push(`👤 A nombre de: ${nombre}`);

    guardarDatos();

    const urlWhatsApp = `https://api.whatsapp.com/send?phone=${TELEFONO_WHATSAPP}&text=${encodeURIComponent(lineas.join("\n"))}`;
    window.open(urlWhatsApp, "_blank", "noopener");
}

/* ---------- INICIO ---------- */
document.querySelectorAll(".product-option").forEach((opt) => {
    opt.addEventListener("click", () => seleccionarProducto(opt));
});
$("btn-ubicacion").addEventListener("click", obtenerUbicacion);
$("btn-enviar").addEventListener("click", enviarWhatsApp);
["nombre", "direccion", "linkMapa"].forEach((id) => $(id).addEventListener("change", guardarDatos));
["cantidad", "cantidadAgua", "cantidadHielo", "direccion", "nombre"].forEach((id) =>
    $(id).addEventListener("input", () => mostrarError(id, ""))
);
cargarDatos();
