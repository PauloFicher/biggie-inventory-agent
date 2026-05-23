/**
 * P1 - Biggie Inventory Agent: API Route
 *
 * POST /api/agent
 * Body: { message: string, sessionId: string }
 * Response: { message: string, toolCalls: [...], tokensUsed: number }
 *
 * Rate limiting: 10 requests/min por IP (via middleware)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runAgent } from '@/lib/agent/orchestration';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.message || typeof body.message !== 'string' || body.message.length < 3) {
      return NextResponse.json(
        { error: 'El mensaje debe tener al menos 3 caracteres.' },
        { status: 400 }
      );
    }

    if (body.message.length > 2000) {
      return NextResponse.json(
        { error: 'El mensaje no puede exceder los 2000 caracteres.' },
        { status: 400 }
      );
    }

    const sessionId = body.sessionId || 'default';

    // Ejecutar el agente
    const result = await runAgent(body.message);

    // Loggear a Supabase para auditoria (async, no bloquea la respuesta)
    supabaseAdmin
      .from('agent_logs')
      .insert({
        session_id: sessionId,
        user_message: body.message,
        tool_calls: result.toolCalls,
        agent_response: result.message,
        tokens_used: result.tokensUsed,
        provider: result.provider,
      })
      .then(({ error }) => {
        if (error) console.error('[agent] Error logging to Supabase:', error);
      });

    return NextResponse.json({
      message: result.message,
      toolCalls: result.toolCalls,
      tokensUsed: result.tokensUsed,
      provider: result.provider,
    });
  } catch (err: any) {
    console.error('[agent] Unhandled error:', err);
    return NextResponse.json(
      {
        error: 'Error interno del agente.',
        detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
      },
      { status: 500 }
    );
  }
}
