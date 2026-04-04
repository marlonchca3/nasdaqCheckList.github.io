# Google Cloud Text-to-Speech Setup

## 📋 Pasos para configurar la voz natural con Google Cloud

### 1. Crear una cuenta de Google Cloud
- Ve a [https://console.cloud.google.com](https://console.cloud.google.com)
- Inicia sesión o crea una cuenta gratuita

### 2. Crear un nuevo proyecto
- Click en "Select a Project" → "NEW PROJECT"
- Nombre: "nasdaq-checklist" (o lo que prefieras)
- Click "CREATE"

### 3. Habilitar Text-to-Speech API
- Ve a "APIs & Services" → "Enable APIs and Services"
- Busca "Cloud Text-to-Speech API"
- Click en el resultado y luego "ENABLE"

### 4. Crear una API Key
- Ve a "APIs & Services" → "Credentials"
- Click "+ CREATE CREDENTIALS" → "API Key"
- Se mostrará tu API key (cópiala)

### 5. Configurar la API Key en tu proyecto
- Abre el archivo `.env` en la raíz del proyecto
- Pega tu API key:
```
VITE_GOOGLE_TTS_API_KEY=tu_api_key_aqui
```

### 6. Reinicia el servidor
```bash
npm run dev
```

## 🎤 Voces disponibles en Google Cloud para español

- **es-MX-Standard-A** (Femenina) - Recomendada
- **es-MX-Standard-B** (Masculina)
- **es-MX-Standard-C** (Femenina)
- **es-MX-Neural2-A** (Femenina, más natural - requiere más créditos)
- **es-ES-Standard-A** (España, Femenina)
- **es-ES-Standard-B** (España, Masculina)

Puedes cambiar la voz editando `utterance.name` en `NasdaqFiboChecklistLogic.js`

## 💰 Precios
- **Primeros 500,000 caracteres/mes**: GRATIS
- Después: ~$16 por millón de caracteres

Para una app de trading, los 500k caracteres mensuales gratuitos son más que suficientes.

## ⚠️ Seguridad
- **NO** publiques tu API key en GitHub
- El `.env` está en `.gitignore` para proteger tus credenciales
- Si expones la API key accidentalmente, regénérala en Google Cloud

## Fallback
Si la API key no está configurada o Google Cloud falla, la app automáticamente usa Web Speech API (voz menos natural pero sin requerimientos).
