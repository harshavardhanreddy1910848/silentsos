import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../AppContext';
import {
  ArrowLeft,
  Bot,
  Send,
  Trash2,
  Sparkles,
  HelpCircle
} from 'lucide-react';

interface AiMessage {
  role: 'user' | 'assistant';
  text: string;
  time: string;
  confidence?: number;
  category?: string;
  suggestions?: string[];
  onlineFetched?: boolean;
  sources?: Array<{ title: string; url: string; source?: string }>;
}

export function AiAssistant() {
  const navigate = useNavigate();
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([
    'How does our app work in Web and Android?',
    'Where is the nearest police station?',
    'Where is the nearest hospital?',
    'How does Stealth Mode work in SilentSOS?',
    'How does Auto-Capture Surveillance record evidence?',
    'What should I do if someone is following me?'
  ]);

  const [messages, setMessages] = useState<AiMessage[]>(() => {
    const saved = localStorage.getItem('silentsos_ai_chat_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        // Fall back to default initial message
      }
    }
    return [
      {
        role: 'assistant',
        text: `👋 Hello! I am your 24/7 **SilentSOS AI Assistant**.\n\n` +
          `I am ready to assist you across both **Web & Android** with:\n\n` +
          `• **SilentSOS Platform Operations:** How our app works, SOS 3s hold, accelerometer shake, covert palm/blink gestures, auto-capture evidence & stealth mode\n` +
          `• **Personal Safety & Evasion:** What to do if followed, solo travel, night transit safety\n` +
          `• **Emergency Medical First Aid:** Hands-only CPR, burns treatment, choking Heimlich protocol\n` +
          `• **Legal Rights & Helplines:** Zero FIR under BNSS, emergency police (112) & women helplines (1091)\n` +
          `• **Live Online Intelligence:** Real-time web retrieval for out-of-range topics\n\n` +
          `What can I assist you with today?`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        category: 'Personal Safety & Defense',
        confidence: 100
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('silentsos_ai_chat_history', JSON.stringify(messages));
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiLoading]);

  const handleClearChat = () => {
    const initialMsg: AiMessage = {
      role: 'assistant',
      text: `Conversation cleared. I am ready for your next safety or general intelligence question!`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      category: 'General',
      confidence: 100
    };
    setMessages([initialMsg]);
    localStorage.removeItem('silentsos_ai_chat_history');
    setAiSuggestions([
      'What should I do if someone is following me?',
      'How can I stay safe when travelling alone?',
      'I feel unsafe right now.',
      'How does Stealth Mode work in SilentSOS?',
      'How do I perform CPR?',
      'What is a Zero FIR in India?'
    ]);
  };

  const handleSendMessage = async (overrideText?: string) => {
    const text = (overrideText || aiInput).trim();
    if (!text || aiLoading) return;

    const userMsg: AiMessage = {
      role: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!overrideText) setAiInput('');
    setAiLoading(true);

    try {
      // Query browser geolocation with quick timeout to personalize emergency police/hospital links
      let userLocation: { lat: number; lng: number } | null = null;
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          await new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                resolve();
              },
              () => resolve(),
              { timeout: 1500, enableHighAccuracy: true }
            );
          });
        } catch (_) {}
      }

      const token = localStorage.getItem('silentsos_token') || sessionStorage.getItem('silentsos_token');
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-8).map(m => ({ role: m.role, text: m.text })),
          location: userLocation
        })
      });

      if (!res.ok) throw new Error(`AI assistant error (${res.status})`);
      const data = await res.json();

      const assistantMsg: AiMessage = {
        role: 'assistant',
        text: data.reply || 'Guidance received. Always move toward populated, well-lit spaces if you feel uneasy.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        confidence: data.confidence,
        category: data.category,
        suggestions: data.suggestions,
        onlineFetched: data.onlineFetched,
        sources: data.sources
      };

      setMessages(prev => [...prev, assistantMsg]);

      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        setAiSuggestions(data.suggestions);
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: `⚠️ **Local AI Engine Response:**\n\n` +
            `The connection to the local API service timed out. However, on-device safety rules are active:\n\n` +
            `• **Immediate Danger:** Press and hold the main SOS button for 3 seconds or execute rapid phone shake.\n` +
            `• **Emergency Numbers:** Dial **112** (Universal Emergency) or **1091** (Women's Helpline).\n` +
            `• **Safety PIN:** An active alert can only be cancelled using your PIN in Settings.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          confidence: 75
        }
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const renderFormattedText = (raw: string) => {
    return raw.split('\n\n').map((para, idx) => {
      // Code blocks
      if (para.startsWith('```') && para.endsWith('```')) {
        const lines = para.split('\n');
        const lang = lines[0].replace('```', '') || 'code';
        const codeContent = lines.slice(1, -1).join('\n');
        return (
          <div key={idx} className="my-2.5 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 font-mono text-xs">
            <div className="bg-slate-900 px-3 py-1.5 text-[10px] text-cyan-400 font-semibold border-b border-slate-800 flex justify-between items-center">
              <span>{lang.toUpperCase()}</span>
              <span className="text-slate-500">Self-Hosted Model</span>
            </div>
            <pre className="p-3 overflow-x-auto text-slate-200 whitespace-pre">
              <code>{codeContent}</code>
            </pre>
          </div>
        );
      }

      // Math block
      if (para.startsWith('$$') && para.endsWith('$$')) {
        return (
          <div key={idx} className="my-2 p-3 bg-cyan-950/30 border border-cyan-500/20 rounded-xl text-center font-mono text-cyan-300">
            {para.replace(/\$\$/g, '')}
          </div>
        );
      }

      // Regular paragraph with bold markup and markdown links [label](url)
      const formatted = para.split(/(\*\*.*?\*\*|\[.*?\]\(https?:\/\/.*?\))/g).map((segment, sIdx) => {
        if (segment.startsWith('**') && segment.endsWith('**')) {
          return <strong key={sIdx} className="font-semibold text-white">{segment.slice(2, -2)}</strong>;
        }

        const linkMatch = segment.match(/^\[(.*?)\]\((https?:\/\/.*?)\)$/);
        if (linkMatch) {
          const [, label, url] = linkMatch;
          return (
            <a
              key={sIdx}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 my-1 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 hover:text-white transition-all font-semibold text-xs shadow-sm shadow-cyan-950/50 cursor-pointer"
            >
              <span>{label}</span>
              <span className="text-[10px] text-cyan-400">↗</span>
            </a>
          );
        }

        return segment;
      });

      return (
        <p key={idx} className="mb-2 leading-relaxed">
          {formatted}
        </p>
      );
    });
  };

  return (
    <div className="flex-1 w-full bg-[#07090e] text-slate-100 flex flex-col h-screen overflow-hidden select-none">
      
      {/* ─── TOP HEADER ────────────────────────────────────────────────── */}
      <header className="w-full max-w-3xl mx-auto px-4 sm:px-6 pt-4 pb-3 flex items-center justify-between border-b border-slate-800/80 shrink-0 bg-[#07090e]/90 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-all group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="hidden sm:inline">Back to Settings</span>
            <span className="sm:hidden">Settings</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white">AI Defense Assistant</h1>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30 font-semibold">
                  LIVE ONLINE INTEL
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Local Neural Brain &bull; Live Web Knowledge</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleClearChat}
          title="Clear Conversation History"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-red-950/40 border border-slate-800 hover:border-red-500/30 text-xs font-medium text-slate-400 hover:text-red-400 transition-all cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Clear Chat</span>
        </button>
      </header>

      {/* ─── CHAT MESSAGES SCROLL CONTAINER ───────────────────────────── */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-4 overflow-y-auto no-scrollbar space-y-4">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 shadow-md text-xs sm:text-[13px] leading-relaxed ${
                m.role === 'user'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-sm'
                  : 'bg-surfaceHighlight/80 border border-slate-800 text-slate-200 rounded-tl-sm'
              }`}
            >
              {m.role === 'assistant' && (
                <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-white/5">
                  <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-[11px]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>SilentSOS Intelligence</span>
                  </div>
                  {m.confidence && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {m.confidence}% match
                    </span>
                  )}
                </div>
              )}

              <div>{renderFormattedText(m.text)}</div>

              {m.onlineFetched && (
                <div className="mt-2.5 pt-2 border-t border-cyan-500/20">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-[10px] text-cyan-300 font-semibold mb-2">
                    <span>🌐 Analyzed from Online Knowledge</span>
                  </div>
                  {m.sources && m.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.sources.map((s, sIdx) => (
                        <a
                          key={sIdx}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-cyan-300 border border-slate-700 hover:border-cyan-500/50 transition-colors"
                        >
                          <span>{s.title.slice(0, 28)}</span>
                          <span className="text-slate-400">↗</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {m.category && (
                <div className="mt-2.5 pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="italic">Category: {m.category}</span>
                  <span className="text-cyan-400/80">Self-Hosted</span>
                </div>
              )}
            </div>

            <span className="text-[10px] text-slate-500 mt-1 px-1">
              {m.time}
            </span>
          </div>
        ))}

        {aiLoading && (
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-surfaceHighlight/60 border border-slate-800 text-cyan-400 text-xs w-fit">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-medium">Formulating intelligent response...</span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </main>

      {/* ─── SUGGESTIONS & INPUT FOOTER ───────────────────────────────── */}
      <footer className="w-full max-w-3xl mx-auto px-4 sm:px-6 pt-2 pb-5 border-t border-slate-800/80 shrink-0 bg-[#07090e]/95 backdrop-blur-md">
        
        {/* Suggestion Chips */}
        {aiSuggestions.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">
              <HelpCircle className="w-3 h-3 text-cyan-400" />
              <span>Suggested Inquiries:</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {aiSuggestions.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={aiLoading}
                  onClick={() => handleSendMessage(s)}
                  className="text-[11px] whitespace-nowrap px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-cyan-950/60 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 text-slate-300 transition-all cursor-pointer shrink-0"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder="Ask about personal safety, medical first aid, or SilentSOS features..."
            disabled={aiLoading}
            className="flex-1 bg-surfaceHighlight/60 border border-slate-800 focus:border-cyan-500 rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
          />

          <button
            type="submit"
            disabled={aiLoading || !aiInput.trim()}
            className="p-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 text-white rounded-xl shadow-lg shadow-cyan-950/40 transition-all cursor-pointer flex items-center justify-center shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </div>
  );
}

