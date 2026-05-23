/**
 * P1 - Biggie Inventory Agent: System Prompt
 *
 * Razonamiento del prompt:
 * - Identidad clara: el agente sabe que es un empleado de Biggie,
 *   no un chatbot generico. Esto reduce alucinaciones en contexto equivocado.
 * - Restriccion de herramientas: el agente SOLO puede usar las tools
 *   definidas. Si el usuario pregunta algo fuera de dominio (clima, politica),
 *   responde educadamente que solo maneja inventario.
 * - Optimizacion de tokens: el prompt esta en espanol tecnico (lenguaje
 *   del negocio en Paraguay). Los nombres de tools son en ingles (convencion
 *   de OpenAI function calling) pero las descripciones en espanol para que
 *   el LLM las entienda en contexto.
 * - Formato de respuesta: siempre devuelve datos concretos (SKU, cantidades,
 *   sucursales) para que el frontend pueda renderizar cards/tablas.
 */

export const SYSTEM_PROMPT = `Eres el Inventory Agent de Biggie (Grupo Azeta, Paraguay). 
Tu funcion exclusiva es gestionar el inventario de las sucursales Biggie.

REGLAS:
1. SOLO puedes usar las herramientas (tools) que se te proporcionan.
2. NUNCA inventes datos de stock, precios o sucursales. Siempre consulta primero.
3. Si el usuario pregunta algo fuera de inventario, responde: 
   "Soy el agente de inventario de Biggie. Solo puedo ayudarte con consultas de stock, 
   productos, sucursales y alertas de reposicion."
4. Responde siempre en espanol, en formato claro y accionable.
5. Cuando detectes stock critico (por debajo del minimo), genera una alerta automaticamente.
6. Menciona SIEMPRE el SKU del producto y la sucursal en tus respuestas.
7. Si el usuario pide "revisar todo", consulta TODAS las sucursales activas primero.

FLUJO TIPICO:
1. El usuario describe una necesidad (ej: "revisa stock de Coca-Cola en Centro")
2. Usas get_product_by_sku o search_products para encontrar el producto
3. Usas check_stock para ver el inventario en la sucursal
4. Si el stock esta bajo min_stock, usas create_alert
5. Respondes con un resumen claro de la situacion y accion recomendada

Recuerda: Biggie tiene 5 sucursales activas y 10 productos en catalogo base.
El objetivo es evitar quiebres de stock y mantener niveles optimos de inventario.`;

/**
 * Tool definitions para OpenAI function calling.
 *
 * Cada tool mapea a una funcion real en tools.ts.
 * Los parametros son tipados estrictamente para que OpenAI
 * siempre devuelva JSON valido.
 */
export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_products',
      description:
        'Busca productos en el catalogo de Biggie por nombre o categoria. ' +
        'Usa esta tool cuando el usuario mencione un producto sin dar el SKU exacto.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Termino de busqueda (nombre parcial o categoria)',
          },
          category: {
            type: 'string',
            description: 'Filtrar por categoria: Bebidas, Lacteos, Panaderia, Almacen, Carnes',
            enum: ['Bebidas', 'Lacteos', 'Panaderia', 'Almacen', 'Carnes'],
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_product_by_sku',
      description:
        'Obtiene un producto especifico por su SKU. Usa esta tool cuando el usuario proporcione un SKU exacto.',
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string', description: 'SKU del producto (ej: BIG001)' },
        },
        required: ['sku'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'check_stock',
      description:
        'Consulta el stock actual de un producto en una sucursal especifica. ' +
        'Tambien devuelve el stock minimo y optimo para comparacion.',
      parameters: {
        type: 'object',
        properties: {
          product_id: {
            type: 'string',
            description: 'UUID del producto (obtenido de search_products o get_product_by_sku)',
          },
          branch_id: {
            type: 'string',
            description: 'UUID de la sucursal. Si no se especifica, consulta todas.',
          },
        },
        required: ['product_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_sales_velocity',
      description:
        'Calcula la velocidad de venta promedio diaria de un producto en los ultimos 7, 14 y 30 dias. ' +
        'Usa esta tool para predecir cuando se agotara el stock.',
      parameters: {
        type: 'object',
        properties: {
          product_id: {
            type: 'string',
            description: 'UUID del producto',
          },
          branch_id: {
            type: 'string',
            description: 'UUID de la sucursal (opcional, si no se da: todas)',
          },
        },
        required: ['product_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_branches',
      description:
        'Lista todas las sucursales activas de Biggie con sus IDs. ' +
        'Usa esta tool al inicio cuando el usuario pide "revisar todo".',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_alert',
      description:
        'Genera una alerta en el sistema cuando un producto esta por debajo del stock minimo. ' +
        'Siempre usa esta tool despues de check_stock si current_stock < min_stock.',
      parameters: {
        type: 'object',
        properties: {
          branch_id: {
            type: 'string',
            description: 'UUID de la sucursal',
          },
          product_id: {
            type: 'string',
            description: 'UUID del producto',
          },
          alert_type: {
            type: 'string',
            enum: ['low_stock', 'stockout', 'overstock', 'trend_warning'],
            description: 'Tipo de alerta',
          },
          severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description:
              'Critico: stock 0. Alto: < 25% del minimo. Medio: < 50% del minimo. Bajo: < minimo.',
          },
          message: {
            type: 'string',
            description: 'Mensaje descriptivo de la alerta',
          },
        },
        required: ['branch_id', 'product_id', 'alert_type', 'severity', 'message'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_pending_alerts',
      description:
        'Obtiene todas las alertas no resueltas, opcionalmente filtradas por sucursal o severidad.',
      parameters: {
        type: 'object',
        properties: {
          branch_id: {
            type: 'string',
            description: 'UUID de sucursal (opcional)',
          },
          severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Filtrar por severidad',
          },
        },
        required: [],
      },
    },
  },
];
