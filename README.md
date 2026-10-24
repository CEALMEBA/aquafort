# Aquafort – Página de pedidos

Página pública de la purificadora Aquafort (Fortín, Ver.) para que los clientes pidan garrafones de agua y bolsas de hielo a domicilio.

Publicada en GitHub Pages: **https://cealmeba.github.io/aquafort/**

Es HTML, CSS y JavaScript sin dependencias ni compilación: `index.html`, `styles.css` y `app.js`.

## Cómo funciona un pedido
1. El cliente elige producto (agua, hielo o ambos) y cantidades, escribe su dirección, comparte su ubicación (botón de GPS o enlace de Google Maps), su nombre y su **teléfono a 10 dígitos**.
2. Al pulsar **Enviar Pedido por WhatsApp**, la página manda el pedido al sistema de la purificadora (`POST https://aquafort.lealtaddigital.app/api/public/orders`). Ahí queda como **pendiente**.
3. Después abre WhatsApp con el mensaje armado, que incluye el número de pedido (`🧾 Pedido #N`) y el teléfono. El cliente termina de enviarlo.
4. Un empleado confirma o rechaza el pedido en el panel de AQUAFORT (**Pedidos Web**). Al confirmar se da de alta al cliente y se registra la venta.

Si el sistema no responde en 8 segundos o no hay conexión, WhatsApp se abre de todos modos (sin número de pedido): el pedido nunca se pierde, solo no queda registrado y el personal lo captura a mano.

La pestaña de WhatsApp se abre **antes** de esperar al sistema, para que el navegador no la bloquee como ventana emergente; si aun así se bloquea, WhatsApp se abre en la misma pestaña.

## Configuración (`app.js`)
| Constante | Para qué | Valor |
|---|---|---|
| `TELEFONO_WHATSAPP` | Número que recibe los pedidos (con `521` delante) | `5212711482917` |
| `API_PEDIDOS` | Endpoint del sistema que registra el pedido | `https://aquafort.lealtaddigital.app/api/public/orders` |
| `ESPERA_API_MS` | Tiempo máximo de espera al sistema antes de abrir WhatsApp | `8000` |

Los teléfonos de la sección de contacto y de los datos para Google (`index.html`) son aparte y no cambian con `TELEFONO_WHATSAPP`.

## Datos que se envían al sistema
```json
{ "name": "...", "phone": "2711234567", "address": "...", "latitude": 18.90, "longitude": -96.99,
  "mapLink": "https://www.google.com/maps?q=...", "water": 2, "ice": 1, "website": "" }
```
- `latitude`/`longitude` salen del GPS. Si el cliente pega o edita el enlace a mano, se envían vacías y el sistema saca las coordenadas del enlace (los enlaces cortos `maps.app.goo.gl` no las traen).
- `website` es un campo trampa invisible (`.campo-trampa`): una persona no lo ve; si un robot lo llena, el sistema descarta el pedido.
- El sistema acepta como máximo 5 pedidos por conexión por hora y de 0 a 50 unidades por producto.

El navegador recuerda nombre, teléfono, dirección, enlace y ubicación del cliente (`localStorage`, clave `aquafort-datos-cliente`) para el siguiente pedido.

## Requisitos del lado del sistema
La API debe permitir el origen de esta página: `APP_CORS_PUBLIC_ORIGINS=https://cealmeba.github.io` (ya configurado en producción, repo `api_aqua`, `deploy/k8s/prod/kustomization.yaml`). Si cambias el dominio de la página, actualiza esa variable.

## Probar en local
```bash
python -m http.server 5500
```
Abre `http://localhost:5500`. Para registrar pedidos contra una API local, cambia temporalmente `API_PEDIDOS` a `http://localhost:8080/api/public/orders` y arranca la API con `APP_CORS_PUBLIC_ORIGINS=http://localhost:5500`. No subas ese cambio.
