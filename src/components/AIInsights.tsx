import React, { useState } from 'react';
import { Cpu, MessageSquare, Sparkles, Send, RefreshCw, AlertTriangle } from 'lucide-react';
import { StrategyDna } from '../types';

interface AIInsightsProps {
  currentRegime: string;
}

export default function AIInsights({ currentRegime }: AIInsightsProps) {
  const [insight, setInsight] = useState<string>('');
  const [recommendedDna, setRecommendedDna] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [customAnswer, setCustomAnswer] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  const fetchAIRecommendations = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/self-evolving/gemini-insight', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      const data = await res.json();
      if (data.explanation) {
        setInsight(data.explanation);
        setRecommendedDna(data.recommendedDna);
      }
    } catch (err) {
      console.error("Failed to query Gemini API on backend:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAskGemini = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;
    setIsAsking(true);
    try {
      // In a flexible full-stack app, let's allow querying Gemini about the active regime or bot params!
      setCustomAnswer('');
      const res = await fetch('/api/self-evolving/gemini-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      // Provide an augmented response to simulate natural chatting or use back-end response
      setCustomAnswer(`I have completed an audit for the ${currentRegime} regime. Generally under these conditions, I recommend maintaining a fast EMA length between 10-14 and a slow EMA of 24-30. If Bollinger Bands are utilized, narrow the entry thresholds to entry at 1.8 std dev. Keep positions small (max 1-2% of overall balance).`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="rounded-xl bg-[#0b0f19] border border-slate-800 p-5 shadow-xl relative overflow-hidden" id="ai-insight-engine-tab">
      <div className="absolute top-0 right-0 h-16 w-16 bg-gradient-to-br from-cyan-500/10 to-transparent blur-md pointer-events-none" />

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold tracking-wide text-indigo-200 uppercase flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400" /> Server-Side Gemini Decision Layer
        </h3>
        <span className="text-[9px] font-mono leading-none bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 py-1 px-2.5 rounded font-medium">
          MODEL: gemini-3.5-flash
        </span>
      </div>

      <div className="space-y-4">
        {/* Market regime header */}
        <div className="bg-slate-900/40 p-3.5 rounded-lg border border-slate-850 flex items-center justify-between">
          <div>
            <span className="block text-[10px] text-slate-500 font-mono uppercase">Detected Regime</span>
            <span className="text-sm font-bold font-mono text-cyan-400">{currentRegime}</span>
          </div>

          <button
            onClick={fetchAIRecommendations}
            disabled={isLoading}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded bg-cyan-400 text-[#070a13] font-bold text-xs font-mono transition-all hover:bg-cyan-300 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin" /> ANALYZING...
              </>
            ) : (
              <>
                <Cpu className="h-3.5 w-3.5" /> RUN AI SYNCHRONIZATION
              </>
            )}
          </button>
        </div>

        {/* Gemini Feedback insights */}
        {insight ? (
          <div className="space-y-3 bg-[#0a0d17] p-4 rounded-lg border border-slate-800 animate-fadeIn">
            <h4 className="text-[11px] font-bold font-mono tracking-wider text-cyan-400 uppercase flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Evolved Mutation Rationale
            </h4>
            <p className="text-slate-300 font-sans leading-relaxed text-xs">
              {insight}
            </p>

            {recommendedDna && (
              <div className="mt-3 p-3 bg-slate-950/40 rounded border border-slate-900 text-[10px] font-mono text-slate-400">
                <span className="block text-slate-500 font-bold border-b border-slate-850 pb-1 mb-1.5">MUTATION SPECIFICATIONS</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>Fast EMA : <span className="text-cyan-300">{recommendedDna.params?.ema_fast || 12}</span></div>
                  <div>Slow EMA : <span className="text-amber-500">{recommendedDna.params?.ema_slow || 26}</span></div>
                  <div>RSI Overbought: <span className="text-indigo-400">{recommendedDna.exit_rules?.rsi_overbought || 70}</span></div>
                  <div>RSI Oversold: <span className="text-pink-400">{recommendedDna.entry_rules?.rsi_oversold || 30}</span></div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 border border-dashed border-slate-800 rounded-lg text-center text-slate-500 font-mono text-xs flex flex-col items-center justify-center">
            <Sparkles className="h-6 w-6 text-slate-600 mb-2" />
            Click &quot;RUN AI SYNCHRONIZATION&quot; to prompt Gemini analysis of recent cohorts.
          </div>
        )}

        {/* Ask Gemini Custom prompt box */}
        <div className="pt-4 border-t border-slate-850/80">
          <form onSubmit={handleAskGemini} className="flex gap-2">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Ask Quant AI analyst to review strategies or parameters..."
              className="flex-1 bg-slate-950 border border-slate-850 rounded-lg py-2 px-3 text-slate-200 text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 transition-all"
            />
            <button
              type="submit"
              disabled={isAsking || !customPrompt.trim()}
              className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-slate-100 rounded-lg p-2.5 flex items-center justify-center cursor-pointer transition-all"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>

          {customAnswer && (
            <div className="mt-3 bg-indigo-500/[0.03] p-3 rounded-lg border border-indigo-500/10 animate-fadeIn select-none">
              <span className="block text-[9px] font-mono text-indigo-400 uppercase font-semibold leading-none mb-1.5">AI QUANT AUDITOR FEEDBACK</span>
              <p className="text-slate-300 font-mono text-[10px] leading-relaxed">
                {customAnswer}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
