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
    <div className="mt-2 p-2 rounded-lg bg-[#f5f5f7] border border-black/5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-mono text-[#0071e3] w-full text-left"
      >
        <span className="text-[10px]">{expanded ? '[-]' : '[+]'}</span>
        tool:{name}
        <span className="text-[#86868b]">{result?.success ? '(ok)' : '(error)'}</span>
      </button>
      {expanded && (
        <pre className="mt-2 text-[11px] text-[#6e6e73] overflow-x-auto max-h-32">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    role: 'agent',
    content: 'Hola. Soy el Inventory Agent de Biggie. Preguntame sobre stock, productos, sucursales o alertas de reposicion.',
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content, sessionId: 'dashboard-session' }),
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
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: 'Error: No se pudo contactar al agente.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto p-6 min-h-screen bg-[#f5f5f7]">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#0071e3]/10 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#0071e3]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1d1d1f]">Biggie Inventory Agent</h1>
            <p className="text-sm text-[#6e6e73]">Grupo Azeta &middot; Retail Intelligence</p>
          </div>
        </div>
      </header>

      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[60vh]">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-[#0071e3] text-white rounded-br-md'
                  : 'bg-[#f0f0f3] text-[#1d1d1f] rounded-bl-md'
              }`}>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                {msg.toolCalls?.map((tc, i) => (
                  <ToolCallBadge key={i} name={tc.name} result={tc.result} />
                ))}
                {msg.tokensUsed != null && (
                  <p className="text-[10px] text-[#86868b] mt-2">~{msg.tokensUsed} tokens</p>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#f0f0f3] rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-[#0071e3] rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-[#0071e3] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <span className="w-2 h-2 bg-[#0071e3] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
          className="border-t border-black/5 p-4 flex gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Revisa el stock de Coca-Cola en todas las sucursales..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-black/[0.08] text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/10 transition-all"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-6 py-2.5 bg-[#0071e3] text-white rounded-full text-sm font-medium hover:bg-[#0077ed] disabled:opacity-40 transition-all"
          >
            Enviar
          </button>
        </form>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="font-semibold text-[#6e6e73]">Sugerencias:</span>
        {['Revisa todo el stock', 'Productos con stock critico', 'Velocidad de venta de Coca-Cola', 'Sucursales activas', 'Alertas pendientes'].map((s) => (
          <button
            key={s}
            onClick={() => setInput(s)}
            className="px-3 py-1 rounded-full border border-black/5 text-[#6e6e73] hover:border-[#0071e3]/30 hover:text-[#0071e3] transition-all"
          >
            {s}
          </button>
        ))}
      </div>
    </main>
  );
}
