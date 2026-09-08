# ☕ Coffee Date

App privada para 2 personas: cada día subís fotos de los cafés que os tomáis
y votáis cuál es la mejor. Se guarda un calendario con la foto ganadora de
cada día y un marcador de quién va ganando. Sin cuentas, sin tienda de apps:
se instala en el móvil como PWA directamente desde el navegador.

## Cómo funciona

- Al entrar, cada dispositivo elige quién es ("Persona A" / "Persona B",
  con los nombres que le pongáis). Esa elección se guarda solo en ese móvil
  (`localStorage`), no hace falta usuario ni contraseña.
- Durante el día, cada persona sube las fotos de sus cafés desde la pestaña
  **Hoy**.
- Cada persona vota, una vez al día, su foto favorita entre todas las
  subidas (las suyas y las de la otra persona). Los votos quedan ocultos
  hasta que las dos personas han votado, para no influenciar el voto.
- Cuando ambas han votado, se revela la foto ganadora del día (o empate) y
  suma un punto en el marcador.
- La pestaña **Calendario** muestra la foto ganadora de cada día del mes.
- La pestaña **Marcador** muestra el resultado acumulado y permite cambiar
  los nombres de las dos personas.

Todo el mundo que entre a la URL ve los mismos datos: no hay control de
acceso más allá de que la URL no sea pública, así que no la compartáis.

## Desarrollo local

```bash
npm install
npm run generate-icons   # solo hace falta una vez (ya están generados en public/icons)
npm start
```

Abre `http://localhost:3000`.

Los datos (fotos y votos) se guardan en `data/db.json` y `data/uploads/`,
que no se suben al repositorio.

## Desplegar para que los dos móviles puedan usarla

Necesitas que el servidor esté accesible por internet (no vale con
`localhost`, porque cada persona está en un móvil distinto). La forma más
sencilla y gratuita:

### Opción A: Render.com (recomendada)

1. Crea una cuenta en [render.com](https://render.com) y conecta este
   repositorio de GitHub.
2. "New Web Service" → selecciona el repo `coffee-date`.
3. Build command: `npm install`. Start command: `npm start`.
4. Añade un **disco persistente** (Render → "Disks") montado en `/opt/render/project/src/data`
   para que las fotos y votos no se borren en cada despliegue.
5. Cuando termine el despliegue, tendrás una URL tipo
   `https://coffee-date-xxxx.onrender.com`.

### Opción B: Railway / Fly.io

Ambos soportan Dockerfile directamente (incluido en este repo) y disco
persistente para la carpeta `data/`. Sube el repo y monta un volumen en
`/app/data`.

### Opción C: Docker en tu propio servidor / VPS / Raspberry Pi

```bash
docker build -t coffee-date .
docker run -d -p 3000:3000 -v coffee-date-data:/app/data coffee-date
```

Pon un proxy (Caddy, nginx, Cloudflare Tunnel...) delante para servir con
HTTPS en tu dominio o subdominio — hace falta HTTPS para que la PWA (y la
cámara del móvil) funcionen bien.

## Instalar en el móvil (sin tienda de apps)

Una vez desplegada la app en una URL con HTTPS:

- **Android (Chrome)**: abre la URL → menú (⋮) → "Añadir a pantalla de
  inicio" / "Instalar aplicación".
- **iPhone (Safari)**: abre la URL → botón compartir (□↑) → "Añadir a
  pantalla de inicio".

Queda como un icono más en el móvil, a pantalla completa, sin barra de
navegador.

## Estructura del proyecto

```
server.js           servidor Express + rutas de la API
lib/store.js         lógica de datos (fotos, votos, calendario, marcador)
lib/png.js            generador mínimo de PNG (sin dependencias) para los iconos
scripts/generate-icons.js
public/               frontend (HTML/CSS/JS vanilla) + manifest PWA + service worker
data/                 (no versionado) fotos subidas y base de datos JSON
```
