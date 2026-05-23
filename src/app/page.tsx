'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  toolCalls?: Array<{ name: string; result: any }>;
  tokensUsed?: number;
}

function ToolCallBadge({ name, result }: { name: string; result: any }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-mono text-teal-600 w-full text-left"
      >
        <span className="text-[10px]">
          {expanded ? '[-]' : '[+]'}
        </span>
        tool:{name}
        <span className="text-slate-400">
          {result?.success ? '(ok)' : '(error)'}
        </span>
      </button>
      {expanded && (
        <pre className="mt-2 text-[11px] text-slate-600 overflow-x-auto max-h-32">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'agent',
      content:
        'Hola. Soy el Inventory Agent de Biggie. Preguntame sobre stock, productos, sucursales o alertas de reposicion.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          sessionId: 'dashboard-session',
        }),
      });

      const data = await res.json();

      const agentMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: data.error || data.message,
        toolCalls: data.toolCalls,
        tokensUsed: data.tokensUsed,
      };

      setMessages((prev) => [...prev, agentMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'agent',
          content: 'Error: No se pudo contactar al agente. Verifica las variables de entorno.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <main className="max-w-4xl mx-auto p-6 min-h-screen flex flex-col">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Biggie Inventory Agent</h1>
            <p className="text-sm text-slate-500">Grupo Azeta - Retail Intelligence</p>
          </div>
        </div>
      </header>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[60vh]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-teal-600 text-white rounded-br-md'
                    : 'bg-slate-100 text-slate-800 rounded-bl-md'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                {msg.toolCalls?.map((tc, i) => (
                  <ToolCallBadge key={i} name={tc.name} result={tc.result} />
                ))}
                {msg.tokensUsed && (
                  <p className="text-[10px] text-slate-400 mt-2">
                    ~{msg.tokensUsed} tokens
                  </p>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <span className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
          className="border-t border-slate-200 p-4 flex gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ej: Revisa el stock de Coca-Cola en todas las sucursales..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-6 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Enviar
          </button>
        </form>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="font-semibold text-slate-600">Sugerencias:</span>
        {[
          'Revisa todo el stock',
          'Productos con stock critico',
          'Velocidad de venta de Coca-Cola',
          'Sucursales activas',
          'Alertas pendientes',
        ].map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => { setInput(suggestion); }}
            className="px-3 py-1 rounded-full border border-slate-200 hover:bg-slate-50 hover:border-teal-300 transition-all"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </main>
  );
}
