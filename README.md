# OpsPilot for New Relic

**OpsPilot for New Relic** es una aplicación web full-stack que convierte datos reales de observabilidad en respuestas, gráficas y análisis accionables mediante un copiloto de IA. Está diseñada para conectar una cuenta de New Relic, descubrir aplicaciones APM, consultar métricas con lenguaje natural, generar visualizaciones y exportar conversaciones completas en PDF.

Demo: [https://opspilot-newrelic.vercel.app]

Proyecto desarrollado por **Farid Stiven Prado Hoyos**, ingeniero multimedia.  
LinkedIn: [linkedin.com/in/faridprado](https://www.linkedin.com/in/faridprado/)

> Este proyecto no es un producto oficial de New Relic. Es una integración independiente construida con FastAPI, Next.js y NerdGraph.

---

## ¿Qué es New Relic?

New Relic es una plataforma de observabilidad que permite monitorear aplicaciones, infraestructura, logs, errores, trazas, despliegues y experiencia de usuario en tiempo real. En equipos de tecnología se utiliza para responder preguntas como:

- ¿Mi aplicación está más lenta de lo normal?
- ¿Qué transacciones concentran más errores?
- ¿Cuándo empezó una degradación?
- ¿Qué servicios, bases de datos o dependencias externas están afectando el rendimiento?
- ¿Qué ocurrió durante las últimas horas después de un cambio o despliegue?

New Relic ofrece mucha información, pero para usuarios no expertos puede ser difícil saber qué métrica consultar, qué query NRQL escribir o cómo interpretar una gráfica. OpsPilot busca reducir esa fricción.

---

## Problema que soluciona

Las herramientas de observabilidad suelen exigir conocimiento técnico avanzado: NRQL, entidades, GUIDs, ventanas de tiempo, eventos, atributos y lectura de dashboards. Esto genera una brecha entre los datos disponibles y las decisiones que se necesitan tomar.

OpsPilot soluciona ese problema con una interfaz conversacional y visual que permite:

- Preguntar en lenguaje natural sobre APMs y métricas.
- Listar aplicaciones disponibles automáticamente.
- Seleccionar una APM como contexto de conversación.
- Cambiar el rango de tiempo desde la UI y reutilizarlo en nuevas preguntas.
- Ejecutar consultas seguras contra New Relic sin exponer la API key al navegador.
- Visualizar métricas en gráficas interactivas.
- Revisar NRQL y datos crudos cuando se necesita trazabilidad técnica.
- Exportar el chat completo como PDF para análisis, documentación o reporte.

---

## Valor diferencial

OpsPilot no es solamente un dashboard ni un chat genérico. Su valor está en la combinación de:

1. **IA con herramientas controladas**  
   El LLM interpreta la intención del usuario, pero solo puede elegir acciones permitidas. El backend valida y ejecuta herramientas seguras y de solo lectura.

2. **Datos reales de New Relic**  
   Las respuestas operativas se basan en NerdGraph y NRQL reales, no en datos simulados ni en inferencias inventadas por la IA.

3. **Seguridad por diseño**  
   La User API Key se procesa en backend, puede guardarse cifrada y nunca se envía al navegador ni al prompt del LLM.

4. **Visualización automática**  
   El backend transforma resultados NRQL en especificaciones normalizadas para gráficas, detectando ejes temporales, unidades y columnas numéricas seguras.

5. **Experiencia de producto completa**  
   Incluye landing, conexión privada, dashboard, chat persistente, historial, renombrado/eliminación de conversaciones, tema claro/oscuro, exportación PDF, NRQL desplegable y datos crudos desplegables.

---

## Funcionalidades principales

- Conexión segura con New Relic mediante User API Key.
- Descubrimiento automático de cuentas y APMs accesibles.
- Chat con agente IA orientado a New Relic, APM, NRQL y observabilidad.
- Router LLM-first compatible con Gemini y OpenAI.
- Fallback seguro cuando el proveedor LLM no está configurado.
- Generación de gráficas para throughput, tiempo de respuesta, errores, Apdex, percentiles, transacciones, logs, trazas, dependencias, base de datos e infraestructura.
- Ajuste global de rango de tiempo.
- Soporte para rangos rápidos y rangos personalizados.
- Manejo robusto de intervalos `TIMESERIES` para evitar errores de GraphQL/NRQL en ventanas largas.
- Historial de chats con crear, limpiar, renombrar, eliminar y cargar conversaciones.
- Exportación del chat completo a PDF desde el navegador.
- Exportación de datos de gráficas en CSV y PNG.
- Secciones desplegables para NRQL, datos crudos y trazas de herramientas.
- Tema oscuro y claro con estética inspirada en los tonos verdes de New Relic.
- Backend con FastAPI, Pydantic v2, httpx async y tests.
- Frontend con Next.js App Router, React, TypeScript, Tailwind y ECharts.

---

## Stack técnico

### Frontend

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Zustand
- TanStack Query
- ECharts
- Lucide React
- Vitest

### Backend

- Python 3.11
- FastAPI
- Pydantic v2
- pydantic-settings
- httpx async
- cryptography
- pytest
- New Relic NerdGraph / NRQL

### IA

- Gemini mediante `google-genai`
- OpenAI mediante SDK oficial
- Servicio `SafeLLMService` para routing, explicación y sanitización del contexto

---

## Arquitectura

```text
Usuario
  |
  v
Frontend Next.js
  - UI de conexión
  - Dashboard
  - Chat
  - Gráficas
  - Exportación PDF/CSV/PNG
  |
  | HTTP interno
  v
Backend FastAPI
  - Sesión y credenciales cifradas
  - Agente IA seguro
  - Validador de herramientas
  - NRQL builder
  - Cliente NerdGraph
  - Motor de visualización
  |
  | GraphQL / NRQL
  v
New Relic NerdGraph
```

Regla principal: **el frontend nunca llama directamente a New Relic y nunca recibe la API key después de guardarla o validarla**.

---

## Flujo del agente IA

```text
Mensaje del usuario
  -> SafeLLMService interpreta intención
  -> El LLM elige una acción permitida
  -> AgentService valida la decisión
  -> NewRelicTools ejecuta consultas read-only si hacen falta
  -> VisualizationEngine crea gráficas seguras
  -> El LLM explica resultados sanitizados
  -> Frontend renderiza respuesta, gráficas, NRQL y datos
```

El LLM no recibe secretos. El contexto enviado se limita a información sanitizada: pregunta, rango de tiempo, APM seleccionada, resumen de filas, NRQL y metadatos de visualización.

---

## Seguridad

- La API key de New Relic no se guarda en el navegador.
- Las credenciales pueden mantenerse cifradas en backend o usarse solo durante la sesión actual.
- El backend elimina el acceso al cerrar sesión.
- La API key no se envía al LLM.
- El backend redacta campos sensibles en respuestas y errores.
- NRQL se trata como consulta de solo lectura.
- CORS configurable mediante `.env`.
- Rate limiting básico en memoria.
- Headers de seguridad configurados desde FastAPI.
- `.env`, bases SQLite locales, entornos virtuales y `node_modules` están excluidos de Git.

Para producción real se recomienda usar PostgreSQL, Redis, autenticación multiusuario y gestión de secretos del proveedor cloud.

---

## Requisitos locales

- Python 3.11.x, recomendado 3.11.9
- Node.js 20+
- npm
- Una User API Key de New Relic con acceso a NerdGraph
- Una API key de Gemini u OpenAI si quieres activar el LLM

---

## Variables de entorno

Copia el archivo de ejemplo:

```bash
cp .env.example .env
```

Variables principales:

```env
APP_ENV=development
APP_SECRET_KEY=change-me-generate-a-long-random-secret
DATABASE_URL=sqlite:///./opspilot.db

NEW_RELIC_REGION=US
NEW_RELIC_API_KEY=
NEW_RELIC_ACCOUNT_ID=

LLM_PROVIDER=none
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o

CORS_ORIGINS=http://localhost:3000,http://localhost:8080
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Notas:

- `NEW_RELIC_ACCOUNT_ID` es opcional para la UI. La aplicación puede descubrir cuentas disponibles automáticamente.
- Si activas Gemini, usa:

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=tu_clave
GEMINI_MODEL=gemini-2.5-flash
```

- Si activas OpenAI, usa:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=tu_clave
OPENAI_MODEL=gpt-4o
```

No subas tu archivo `.env` a GitHub.

---

## Ejecución rápida en Windows

Desde la raíz del proyecto:

```powershell
.\start.bat
```

El script:

- Crea `.env` desde `.env.example` si no existe.
- Busca Python 3.11.
- Crea `backend\.venv`.
- Instala dependencias del backend.
- Instala dependencias del frontend.
- Levanta FastAPI en `http://localhost:8000`.
- Levanta Next.js en `http://localhost:3000`.

---

## Ejecución rápida en macOS/Linux

```bash
chmod +x start.sh
./start.sh
```

---

## Ejecución manual

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade "pip==25.3"
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

En Windows PowerShell:

```powershell
cd backend
.\.venv\Scripts\activate
python -m pip install --upgrade "pip==25.3"
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Abre:

```text
http://localhost:3000
```

Health check del backend:

```text
http://localhost:8000/api/health
```

---

## Docker

```bash
cp .env.example .env
docker compose up --build
```

Servicios:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- Health: `http://localhost:8000/api/health`

---

## Scripts útiles

Backend:

```bash
cd backend
python -m pytest -q
```

Frontend:

```bash
cd frontend
npm run typecheck
npm test
```

Secret scan local:

```bash
python scripts/check_no_secrets.py
```

---

## Estructura del repositorio

```text
opspilot-newrelic/
  backend/
    app/
      db/
      models/
      routes/
      schemas/
      services/
      tools/
      tests/
    requirements.txt
    pyproject.toml
  frontend/
    app/
    charts/
    components/
    lib/
    stores/
    types/
    package.json
  scripts/
  .env.example
  .gitignore
  docker-compose.yml
  start.bat
  start.sh
  README.md
```

---

## Endpoints principales

- `GET /api/health`
- `POST /api/credentials/validate`
- `POST /api/credentials/save`
- `GET /api/credentials/current`
- `DELETE /api/credentials`
- `GET /api/accounts`
- `GET /api/entities/apm`
- `GET /api/entities/search?q=`
- `GET /api/entities/{guid}`
- `POST /api/nrql/run`
- `POST /api/charts/build`
- `POST /api/chat`
- `GET /api/chat/sessions`
- `POST /api/chat/sessions`
- `GET /api/chat/sessions/{id}`
- `PATCH /api/chat/sessions/{id}`
- `DELETE /api/chat/sessions/{id}`

---

## Casos de uso

- Analizar rendimiento de una APM durante las últimas horas.
- Comparar throughput y tiempo de respuesta.
- Revisar errores recientes por clase o mensaje.
- Detectar transacciones lentas.
- Explorar fuentes de datos y atributos disponibles.
- Generar reportes PDF desde una conversación técnica.
- Ayudar a perfiles no expertos a consultar observabilidad sin escribir NRQL manualmente.

---

## Autor

**Farid Stiven Prado Hoyos**  
Ingeniero multimedia  
LinkedIn: [https://www.linkedin.com/in/faridprado/](https://www.linkedin.com/in/faridprado/)

