# Estudio IA — videos animados con un agente, en local

Herramienta local inspirada en los editores "con agentes" (tipo Lugh Xtudio): eliges un **estilo**, el **agente** te hace
preguntas sobre lo que quieres ver, eliges una **voz open source**, el agente **escribe (o adapta) el guion** con personajes
y escenas, y exportas un **MP4**.

## Flujo

1. **Plantilla** — Low Poly · Animación 3D cinematográfica (tipo Pixar) · Flat 2D Motion · Neón/Synthwave · Plastilina.
2. **Idea** — escribes la idea o pides sugerencias; el agente hace 4–6 preguntas con opciones (público, duración, tono,
   protagonistas, lugares, mensaje final).
3. **Voz** — Kokoro‑82M (Apache 2.0; español, inglés, portugués, francés, italiano) y Piper (MIT; acentos México,
   Argentina, España; se descargan al primer uso). Velocidad ajustable; el agente modula según la emoción de cada escena.
4. **Guion** — "que lo sugiera el agente" o "lo escribo yo" (el agente lo divide en escenas sin cambiar tu texto).
   Editor de personajes, escenas, cámara, escenario, props, y "pídele cambios al agente" en lenguaje natural.
5. **Exportar** — locución por escena, vista previa con audio, formato 16:9 / 9:16 / 1:1, subtítulos quemados,
   MP4 borrador o HD y `.srt`.

## Calidad: gancho, zona segura y revisión del director

- **Gancho (primeros 3 s):** la escena 1 tiene máx. ~8 palabras, abre con pregunta/dato/promesa/conflicto (nunca "Hola" o
  "En este video"), entra sin fundido, con texto grande y un punch-in de cámara.
- **Zona segura 9:16:** subtítulos y títulos se dibujan fuera de lo que tapa la app (14 % arriba, 35 % abajo, 15 % a la
  derecha por los botones). En la vista previa puedes mostrar esas franjas.
- **Chequeos automáticos** (`shared/checks.ts`): personajes en la misma posición, props que chocan, gancho largo o débil, etc.
- **Revisión del director** (`server/review.ts`): el agente renderiza un fotograma por escena, los mira, califica el
  gancho y corrige el guion (hasta 2 rondas). Se ejecuta sola al generar el guion o con el botón.

## Cómo funciona

```
UI (React + Vite) ──► API (Express, :3210)
                        ├─ agente: Claude Code CLI (`claude -p --json-schema`) o Claude API
                        │          → JSON validado (VideoSpec) con vocabulario visual cerrado
                        ├─ voz:    sherpa-onnx (ONNX en CPU, sin Python) → WAV por escena
                        └─ render: Remotion + React Three Fiber → Chrome headless + FFmpeg → MP4
```

El agente nunca escribe código: produce un **VideoSpec** (escenas, personajes, acciones, cámara, props) y un motor 3D
procedural lo dibuja con el "kit" de materiales y luces de cada plantilla. Así el mismo guion se ve distinto en cada estilo
y nunca se rompe el render.

## Requisitos

- Node 20+ (probado con Node 24) · Windows, macOS o Linux. No requiere GPU ni Python.
- **Agente**: Claude Code instalado y con sesión iniciada (se usa automáticamente), **o** `ANTHROPIC_API_KEY` en `.env`.

## Arranque

```bash
npm install
npm run setup:voices            # Kokoro (~350 MB). Añade -- --latam para las voces Piper latinas
npm run dev                     # UI en http://localhost:5173 , API en :3210
```

Copia `.env.example` a `.env` para cambiar el modelo (`LLM_MODEL`), los hilos de TTS o conectar un servidor de voz externo.

## Voces más expresivas (GPU)

Los modelos con control de emoción más avanzado (Chatterbox Multilingual, IndexTTS‑2.5, CosyVoice 3) necesitan GPU para ir
a velocidad útil. Si los corres en otra máquina con un servidor compatible con OpenAI (`/v1/audio/speech`), configúralo en
`.env` (`TTS_REMOTE_URL`, `TTS_REMOTE_VOICES`) y aparecerán en el paso de Voz como "Externo".

## Estructura

- `shared/spec.ts` — esquema del VideoSpec (zod) y vocabulario visual.
- `shared/templates.ts` — plantillas de estilo y dirección de arte para el agente.
- `server/agent.ts` — prompts: ideas, preguntas, guion+storyboard, revisiones.
- `server/llm.ts` — backend del agente (Claude Code CLI / Claude API).
- `server/tts.ts` — catálogo de voces y síntesis con sherpa-onnx.
- `server/render.ts` — render MP4 con Remotion.
- `remotion/` — composición: kit de estilos, personajes, props, escenarios, cámara, subtítulos.
- `data/projects/<id>/` — proyecto, audio y exportaciones.

## Notas

- Remotion es gratis para personas y empresas pequeñas; empresas más grandes necesitan licencia (remotion.dev/license).
- Kokoro y Piper son open source; revisa la licencia de cada voz Piper si vas a usarla comercialmente.
