# nasdaq-checklist

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

## Variables de entorno

La configuración de Firebase se lee desde `.env` con variables `VITE_*` de Vite.

Usa `.env.example` como plantilla y crea tu `.env` local con estos valores:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

En GitHub Pages, el workflow de Actions también necesita esas variables durante `npm run build`. En este repositorio quedaron definidas dentro de [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) para que la versión publicada no salga en blanco.

## Alertas Nasdaq manuales

La app permite crear recordatorios manuales para eventos importantes como CPI, FOMC, Powell o earnings y avisarte 15 minutos antes.

Las alertas usan:

- notificaciones del navegador, si el usuario da permiso
- voz, mientras la app esté abierta
- persistencia local y sincronización con Firebase del mismo modo que el resto del tablero

## Firebase Auth

Para que el inicio de sesión con Google funcione, el dominio donde cargas la app debe estar agregado en Firebase Authentication.

En GitHub Pages de proyecto se usa popup con el `authDomain` original de Firebase. No se debe apuntar `authDomain` a `marlonchca3.github.io`, porque Firebase buscaría `__/auth/handler` en la raiz del dominio y esa ruta no existe para este repositorio.

En Firebase Console ve a Authentication > Settings > Authorized domains y agrega, según corresponda:

- localhost
- 127.0.0.1
- marlonchca3.github.io

## Deploy

El repositorio ya incluye un workflow en [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) para publicar automáticamente en GitHub Pages cada vez que haces push a main.

En GitHub solo debes verificar esto una vez:

- Settings > Pages
- Source: GitHub Actions

La URL esperada de publicación es:

- <https://marlonchca3.github.io/nasdaqCheckList.gitgub.io/>

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```
