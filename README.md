# P1 - Biggie Inventory Agent | Grupo Azeta

## ① Objetivo de negocio

**Problema:** Biggie opera 200+ sucursales con reposicion manual de inventario. El 8% de productos presentan quiebre de stock en horas pico, generando perdida de ventas por falta de visibilidad predictiva.

**Solucion:** Un agente autonomo con LLM que monitorea niveles de stock en tiempo real via Supabase Realtime, predice quiebres usando velocidad de venta historica, y genera alertas y ordenes de reposicion en lenguaje natural para los encargados de sucursal.

## ② Arquitectura tecnica

```
Usuario (Dashboard Chat)
    |
    v
POST /api/agent  { message, sessionId }
    |
    v
Agent Orchestration (orchestration.ts)
    |--- LLM Call (OpenAI GPT-4o / DeepSeek)
    |       |--- system-prompt.ts (rol + reglas de negocio)
    |       |--- tools definitions (function calling)
    |
    |--- Tool Execution (tools.ts)
    |       |--- Supabase (service_role key)
    |       |       |--- products, branches, inventory, sales, alerts
    |
    |--- Agent Loop (max 5 iteraciones)
    |       |--- LLM decide si llamar mas tools o responder
    |       |--- Cada tool_response se reinyecta en el contexto
    |
    v
Respuesta final + Log en agent_logs (auditoria)
```

## ③ Estructura de carpetas

```
P1-biggie-inventory/
  src/
    app/
      layout.tsx                    # Root layout
      page.tsx                      # Dashboard con chat UI
      globals.css                   # Tailwind
      api/
        agent/route.ts              # POST /api/agent (endpoint principal)
    lib/
      supabase.ts                   # Cliente Supabase (anon key)
      agent/
        system-prompt.ts            # System prompt + tool definitions
        tools.ts                    # Implementacion de cada tool (Supabase)
        orchestration.ts            # Bucle agente + manejo de providers
    types/
      index.ts                      # Interfaces
    middleware.ts                   # Rate limiting
  supabase/
    schema.sql                      # Tablas + RLS + seed data
  .env.example
  package.json
  README.md
```

## ④ Schema de Supabase

Ver `supabase/schema.sql`.

Tablas principales:
- `branches`: Sucursales Biggie (5 registros seed)
- `products`: Catalogo de productos (10 registros seed con min_stock y optimal_stock)
- `inventory`: Stock actual por sucursal x producto
- `sales`: Historial de ventas para prediccion
- `alerts`: Alertas generadas por el agente
- `agent_logs`: Auditoria de conversaciones

RLS: Autenticados leen todo. Solo service_role escribe.

## ⑤ System Prompt - Razonamiento

**Por que este prompt:**
- **Identidad de negocio**: El agente se presenta como empleado de Biggie, no como IA generica. Esto reduce alucinaciones de contexto (no mezcla datos de otros retailers).
- **Restriccion de herramientas**: Le decimos explicitamente que SOLO use las tools definidas. Si pregunta algo fuera de dominio, responde con un mensaje amable pero limitante.
- **Formato accionable**: La respuesta siempre incluye SKU, sucursal y accion recomendada. El frontend puede parsear esto para renderizar cards/graficos.
- **Flujo tipico documentado**: El agente sabe el orden logico de tools (buscar producto -> check stock -> crear alerta).

**Optimizacion de tokens (~600 tokens de system prompt):**
- Espanol tecnico sin redundancias
- Nombres de tools en ingles (convencion OpenAI) pero descripciones en espanol
- Sin ejemplos en el prompt (el LLM infiere del flujo tipico descrito)

## ⑥ Variables de entorno

```
OPENAI_API_KEY=sk-proj-...
DEEPSEEK_API_KEY=sk-...          # Alternativa de menor costo
SUPABASE_SERVICE_ROLE_KEY=...    # Para operaciones admin (tools)
LLM_PROVIDER=openai              # "openai" o "deepseek"
```

## ⑦ Pasos de deploy a produccion

### 1. Supabase
```bash
# Crear proyecto en https://supabase.com
# SQL Editor > pegar schema.sql > Run
# Settings > API > copiar URL, ANON_KEY, SERVICE_ROLE_KEY
```

### 2. Vercel
```bash
# Crear proyecto > conectar repo GitHub
# Framework: Next.js / Root: P1-biggie-inventory
# Environment Variables: todas las de .env.example
# Deploy
```

### 3. Local
```bash
cd P1-biggie-inventory
pnpm install
cp .env.example .env.local
pnpm dev
```

## ⑧ Argumentos de entrevista

### Por que esto impacta a Biggie:
- Reduce quiebres de stock detectando criticos antes de que se agoten
- Los encargados de sucursal reciben alertas en lenguaje natural (sin necesidad de dashboards complejos)
- El historial de velocidad de venta permite prediccion de demanda
- Escala a 200+ sucursales sin cambiar codigo (solo agregar registros en `branches`)

### Decisiones tecnicas:
- **Function calling sobre RAG**: Para inventario, los datos son estructurados (SQL). Function calling es mas preciso que RAG vectorial.
- **DeepSeek como alternativa a OpenAI**: Misma API, menor costo. Ideal para llamadas frecuentes de monitoreo.
- **Supabase Realtime**: El inventario se actualiza en tiempo real, pero el agente consulta via SQL para consistencia. Realtime alimenta el dashboard visual.
- **Rate limiting en middleware**: Protege contra abuso de API keys del LLM. 5 requests/min en /api/agent.
- **Logging en Supabase**: Cada conversacion se guarda en agent_logs para auditoria y mejora continua del prompt.

### Que diferencia este agente de un dashboard generico:
- **Lenguaje natural**: El encargado no necesita aprender SQL o filtros. Pregunta "que productos estan bajos en Centro?" y el agente responde con datos accionables.
- **Proactividad**: Si el stock baja del minimo, el agente genera alertas automaticas sin intervencion humana.
- **Memoria de sesion**: El historial de conversacion se mantiene para consultas de seguimiento ("y de esos, cual tiene mejor margen?").
