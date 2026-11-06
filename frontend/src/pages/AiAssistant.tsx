import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, API_BASE } from '../AppContext';
import {
  ChevronLeft,
  RotateCcw,
  Send,
  Shield,
  HeartPulse,
  Scale,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
  isError?: boolean;
}

const PROMPT_CATEGORIES = [
  {
    title: 'Medical First Aid',
    icon: HeartPulse,
    color: 'text-red-400',
    borderColor: 'border-red-500/20 hover:border-red-500/50',
    bgGlow: 'bg-red-950/20',
    prompt: 'What should I do if someone collapses?'
  },
  {
    title: "Women's Safety",
    icon: Shield,
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/20 hover:border-emerald-500/50',
    bgGlow: 'bg-emerald-950/20',
    prompt: 'What should I do if someone is following me?'
  },
  {
    title: 'Legal Rights',
    icon: Scale,
    color: 'text-cyan-400',
    borderColor: 'border-cyan-500/20 hover:border-cyan-500/50',
    bgGlow: 'bg-cyan-950/20',
    prompt: 'What is a Zero FIR in India?'
  },
  {
    title: 'SilentSOS Features',
    icon: ShieldCheck,
    color: 'text-amber-400',
    borderColor: 'border-amber-500/20 hover:border-amber-500/50',
    bgGlow: 'bg-amber-950/20',
    prompt: 'How does Stealth Mode work?'
  }
];

export function AiAssistant() {
  const navigate = useNavigate();
  const { state, token } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll smoothly to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handle textarea auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || input).trim();
    if (!textToSend || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInput('');
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Limit conversation history to the last 6 turns to conform with backend limits
    const historyPayload = newHistory.slice(-6).map(m => ({
      role: m.role,
      content: m.content
    }));

    const requestBody: {
      message: string;
      history: Array<{ role: string; content: string }>;
      location?: { latitude: number; longitude: number };
    } = {
      message: textToSend,
      history: historyPayload
    };

    // Include coordinates only if already available in state (never auto-request permissions)
    if (state.location?.latitude && state.location?.longitude) {
      requestBody.location = {
        latitude: state.location.latitude,
        longitude: state.location.longitude
      };
    }

    try {
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data || typeof data.reply !== 'string' || !data.reply.trim()) {
        throw new Error('Incomplete response structure');
      }

      const validSuggestions = Array.isArray(data.suggestions)
        ? data.suggestions.filter((s: unknown) => typeof s === 'string' && s.trim().length > 0)
        : [];

      const assistantMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.reply.trim(),
        suggestions: validSuggestions
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch {
      // Safe, friendly error handling (never exposes stack traces or internal backend errors)
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Unable to connect to the SilentSOS safety assistant. Please try again. In an immediate emergency, contact your local emergency services.',
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([]);
    setInput('');
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      {/* Top Header */}
      <header className="shrink-0 bg-surface/90 backdrop-blur-md border-b border-surfaceHighlight px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">SilentSOS AI Assistant</h1>
            <p className="text-[11px] text-textMuted font-medium">Personal Safety &amp; First Aid Companion</p>
          </div>
        </div>

        <button
          onClick={handleReset}
          className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors shrink-0"
          title="New conversation"
          aria-label="Reset conversation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </header>

      {/* Main Conversation & Welcome Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-36">
        {messages.length === 0 ? (
          // Welcome Screen
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto my-auto pt-4 space-y-6"
          >
            <div className="bg-surface/80 border border-surfaceHighlight rounded-2xl p-5 text-center space-y-3 shadow-lg">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto shadow-md">
                <Shield className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">How can I assist your safety today?</h2>
              <p className="text-xs text-textMuted leading-relaxed">
                I am your private, on-device companion for emergency first aid procedures, stalking and transit safety, legal rights in India, and SilentSOS defense controls.
              </p>
            </div>

            {/* Categorized Prompt Suggestions */}
            <div className="space-y-2">
              <h3 className="text-[11px] font-bold text-textMuted uppercase tracking-wider px-1">
                Suggested Topics
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PROMPT_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.title}
                      onClick={() => handleSend(cat.prompt)}
                      className={`text-left p-3.5 rounded-xl bg-surface/70 border ${cat.borderColor} ${cat.bgGlow} transition-all duration-150 flex flex-col justify-between group cursor-pointer shadow-sm min-h-[64px]`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Icon className={`w-4 h-4 ${cat.color} shrink-0`} />
                        <span className="text-xs font-semibold text-slate-200 group-hover:text-white">
                          {cat.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 group-hover:text-slate-200 line-clamp-2">
                        {cat.prompt}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        ) : (
          // Message Bubbles Feed
          <div className="space-y-4 max-w-2xl mx-auto w-full">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%] break-words whitespace-pre-wrap shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-slate-800 text-slate-100 rounded-tr-none border border-slate-700/50'
                        : msg.isError
                        ? 'bg-red-950/60 border border-red-500/40 text-red-200 rounded-tl-none'
                        : 'bg-surface border border-surfaceHighlight text-slate-200 rounded-tl-none'
                    }`}
                  >
                    {msg.isError && (
                      <div className="flex items-center gap-1.5 text-red-400 font-semibold mb-1 text-xs">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Connection Notice</span>
                      </div>
                    )}
                    {msg.content}
                  </div>

                  {/* Suggestion Chips Under Assistant Message */}
                  {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5 max-w-[90%]">
                      {msg.suggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(suggestion)}
                          disabled={isLoading}
                          className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-surfaceHighlight/80 hover:bg-emerald-950/40 border border-surfaceHighlight hover:border-emerald-500/40 text-slate-300 hover:text-emerald-300 transition-all text-left disabled:opacity-50"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Loading Indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-4 py-3 bg-surface border border-surfaceHighlight rounded-2xl rounded-tl-none max-w-[120px] shadow-sm"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse [animation-delay:200ms]" />
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse [animation-delay:400ms]" />
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Sticky Input Bar */}
      <div className="fixed bottom-14 left-0 right-0 bg-[#07090e]/95 backdrop-blur-xl border-t border-slate-800/80 p-3 z-30">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <div className="flex-1 bg-surface border border-surfaceHighlight focus-within:border-emerald-500/50 rounded-2xl overflow-hidden transition-colors shadow-inner flex items-center px-3 py-1.5 min-h-[48px]">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a safety, medical, or legal question..."
              rows={1}
              disabled={isLoading}
              className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none resize-none leading-relaxed no-scrollbar"
              aria-label="Ask SilentSOS AI Assistant"
            />
          </div>

          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 transition-all shrink-0 shadow-md font-bold"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

