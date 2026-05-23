/**
 * P1 - Biggie Inventory Agent: Orchestration Layer
 *
 * Implementa un bucle agente clasico:
 * 1. Enviar mensaje + tools al LLM
 * 2. Si el LLM responde con tool_calls, ejecutarlos
 * 3. Enviar resultados de tools de vuelta al LLM
 * 4. Repetir hasta que el LLM de una respuesta final (sin tool_calls)
 *
 * Soporta dos providers: OpenAI y DeepSeek.
 * El provider se elige via LLM_PROVIDER en .env.local
 */
import OpenAI from 'openai';
import { SYSTEM_PROMPT, TOOL_DEFINITIONS } from './system-prompt';
import {
  searchProducts,
  getProductBySku,
  checkStock,
  getSalesVelocity,
  listBranches,
  createAlert,
  getPendingAlerts,
} from './tools';

// Mapa de tool name -> implementacion
const TOOL_MAP: Record<string, (args: any) => Promise<any>> = {
  search_products: searchProducts,
  get_product_by_sku: getProductBySku,
  check_stock: checkStock,
  get_sales_velocity: getSalesVelocity,
  list_branches: listBranches,
  create_alert: createAlert,
  get_pending_alerts: getPendingAlerts,
};

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

interface AgentResponse {
  message: string;
  toolCalls: Array<{ name: string; result: any }>;
  tokensUsed: number;
  provider: string;
}

function getOpenAIClient(): OpenAI {
  const provider = process.env.LLM_PROVIDER || 'openai';

  if (provider === 'deepseek') {
    return new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com/v1',
    });
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

function getModel(): string {
  const provider = process.env.LLM_PROVIDER || 'openai';
  if (provider === 'deepseek') {
    return process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  }
  return process.env.OPENAI_MODEL || 'gpt-4o';
}

export async function runAgent(
  userMessage: string,
  conversationHistory: ChatMessage[] = []
): Promise<AgentResponse> {
  const client = getOpenAIClient();
  const model = getModel();
  const provider = process.env.LLM_PROVIDER || 'openai';

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  let totalTokens = 0;
  const allToolCalls: Array<{ name: string; result: any }> = [];
  let finalMessage = '';

  // Bucle agente: maximo 5 iteraciones para evitar loops infinitos
  for (let iteration = 0; iteration < 5; iteration++) {
    const response = await client.chat.completions.create({
      model,
      messages: messages as any,
      tools: TOOL_DEFINITIONS,
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 1000,
    });

    const choice = response.choices[0];
    totalTokens += response.usage?.total_tokens || 0;

    // Si no hay tool calls, tenemos respuesta final
    if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
      finalMessage = choice.message.content || 'No pude generar una respuesta.';
      break;
    }

    // Ejecutar cada tool call
    messages.push({
      role: 'assistant',
      content: choice.message.content,
      tool_calls: choice.message.tool_calls,
    });

    for (const toolCall of choice.message.tool_calls) {
      const fnName = toolCall.function.name;
      const fnArgs = JSON.parse(toolCall.function.arguments);

      console.log(`[agent] Calling tool: ${fnName}`, fnArgs);

      const fn = TOOL_MAP[fnName];
      if (!fn) {
        allToolCalls.push({
          name: fnName,
          result: { error: `Tool "${fnName}" no encontrada.` },
        });
        continue;
      }

      try {
        const result = await fn(fnArgs);
        allToolCalls.push({ name: fnName, result });

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      } catch (err: any) {
        allToolCalls.push({
          name: fnName,
          result: { error: err.message },
        });

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: err.message }),
        });
      }
    }

    // Segunda pasada sin tool_choice forzado para que el LLM decida
    const followUp = await client.chat.completions.create({
      model,
      messages: messages as any,
      tools: TOOL_DEFINITIONS,
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 1000,
    });

    totalTokens += followUp.usage?.total_tokens || 0;
    const followChoice = followUp.choices[0];

    if (
      !followChoice.message.tool_calls ||
      followChoice.message.tool_calls.length === 0
    ) {
      finalMessage =
        followChoice.message.content || 'Procesamiento completado.';
      break;
    }
  }

  if (!finalMessage) {
    finalMessage = 'El agente alcanzo el limite de iteraciones. Resume de lo procesado.';
  }

  return {
    message: finalMessage,
    toolCalls: allToolCalls,
    tokensUsed: totalTokens,
    provider,
  };
}
