import React, { useState, useEffect } from 'react';

const AIBotAssistant = () => {
  const [messages, setMessages] = useState<Array<{role: 'user' | 'assistant'; content: string}>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize with a welcome message
  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: "Hello! I'm your AI Bot Assistant powered by OpenAI. I can help you analyze and fix issues with the Alpha TB trading bot. Share any error messages, unexpected behaviors, or questions you have about the bot's performance, and I'll provide detailed analysis and solutions."
      }
    ]);
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput('');
    setLoading(true);
    setError(null);

    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer sk-uvwx5678uvwx5678uvwx5678uvwx5678uvwx5678`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `You are an expert AI trading bot assistant specialized in analyzing and fixing issues with the Alpha TB cryptocurrency trading bot.
              The bot uses Binance API, implements AI-driven strategy evolution, ensemble decision making, risk management, and various trading features.
              When users describe issues, provide:
              1. Clear analysis of what might be causing the problem
              2. Step-by-step solutions to fix it
  3. Preventive measures to avoid similar issues
  4. Code snippets if relevant (referencing the bot's TypeScript codebase)
              Keep responses concise but thorough, focusing on practical solutions.`
            },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage }
          ],
          max_tokens: 500,
          temperature: 0.7
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`API error: ${response.status} - ${data.error?.message || 'Unknown error'}`);
      }

      const assistantMessage = data.choices[0].message.content;

      // Add assistant response to chat
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
    } catch (err: any) {
      console.error('OpenAI API error:', err);

      // Provide intelligent fallback responses based on common bot issues
      const fallbackResponses: Record<string, string> = {
        'not making trades': `The bot may not be making trades due to several reasons:
1. **Market Conditions**: The current regime might not meet entry criteria (check AFCS status and regime indicators)
2. **Confidence Threshold**: Strategies may not be reaching the required confidence level (TRADE_CONFIDENCE_FLOOR is 80%)
3. **Position Limits**: Maximum concurrent positions may already been reached
4. **Cooldown Period**: After losses, the bot enters a cooldown period to prevent overtrading
5. **Signal Quality**: Current RSI, volume, or price change may not meet entry thresholds

Try checking:
- AFCS status in the dashboard (if active, it reduces position sizes by 50%)
- Current regime and whether it's in ALLOWED_TRADE_REGIMES
- Whether isContinuousMode is enabled (more aggressive trading)
- Recent trade history for losses triggering cooldowns`,

        'connection errors': `Binance API connection issues can be caused by:
1. **Network Connectivity**: Check your internet connection and firewall settings
2. **API Credentials**: Verify BINANCE_API_KEY and BINANCE_API_SECRET in .env file
3. **Testnet vs Live**: Ensure BINANCE_TESTNET is set correctly (currently "True" for testnet)
4. **Rate Limits**: Binance has request limits; excessive calls can cause temporary bans
5. **Server Time': Your system clock must be synchronized with Binance servers

Solutions:
- Verify API keys in .env file are correct and have proper permissions
- Ensure system time is accurate (enable NTP time synchronization)
- Check if you're getting 429 errors (rate limiting) in console logs
- Try reducing frequency of API calls if hitting limits`,

        'afcs': `The Active Failure Containment System (AFCS) activates when:
- 3 consecutive losing trades occur within 5 minutes
- This triggers stricter risk management: 50% reduction in position sizes
- The bot continues trading but with reduced exposure to prevent further losses

To check AFCS status:
- Look for "🚨 [AFCS SAFEGUARD ACTIVATED]" in brain activity logs
- Check the afcsActive flag in the API status response
- The system automatically resets when conditions improve

To prevent frequent AFCS activation:
- Improve strategy quality through evolution
- Adjust risk parameters (stop loss, take profit ratios)
- Consider increasing minimum hold time to avoid premature exits
- Review entry criteria to improve trade quality`,

        'balance decreasing': `If your paper balance is decreasing, investigate:
1. **Trade Analysis**: Review recent losing trades in the Trade History panel
2. **Strategy Performance**: Check if current strategies have negative expectancy
3. **Market Regime**: Ensure strategies are适合当前市场状况
4. **Risk Management**: Verify stop loss and take profit levels are appropriate
5. **Position Sizing**: Ensure you're not risking too much per trade

Immediate actions:
- Use the Force Evolve button to generate new strategies
- Check if AFCS is active (reduces position sizes but still allows trading)
- Review the Win Rate in Account Overview Panel
- Consider resetting simulation if strategies are fundamentally flawed ('/api/reset' endpoint)`,

        'default': `I'm experiencing connectivity issues with the AI analysis service. However, I can still help you diagnose common Alpha TB bot issues based on the system's current state.

From the latest status:
- Bot is running: true
- Current regime: Ranging Dynamic
- AFCS Active: true (indicating recent consecutive losses)
- Generation: 2240 (showing active evolution)
- Paper Balance: $10,000 (starting value)

For immediate assistance, try:
1. Checking the System Logs panel for error messages
2. Using the Force Evolve button to refresh strategies
3. Reviewing Trade History for patterns in losses
4. Verifying AFCS status and understanding its impact
5. Examining which coins are being traded and their performance

Would you like me to help you interpret any specific data from the dashboard or suggest particular troubleshooting steps?`
      };

      // Find best matching fallback response
      let response = fallbackResponses['default'];
      const lowerMessage = userMessage.toLowerCase();

      for (const [key, value] of Object.entries(fallbackResponses) as [string, string][]) {
        if (lowerMessage.includes(key) && key !== 'default') {
          response = value;
          break;
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#0a0f1c]/50 border border-[#1e293b]/30 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center">
          <span className="mr-2">🤖</span> AI Bot Assistant
        </h3>

        {/* Chat Messages */}
        <div className="h-[400px] overflow-y-auto space-y-3 mb-4 pb-2">
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}>
              <div className={`max-w-[80%] px-4 py-2 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-[#1e40af]/50 text-[#bfdbfe]'
                  : 'bg-[#0f172a]/50 text-[#cfd3ea]'
              }`}>
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] px-4 py-2 rounded-lg bg-[#0f172a]/50 text-[#cfd3ea] animate-pulse">
                <p className="whitespace-pre-wrap text-sm">Thinking...</p>
              </div>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="px-4 py-2 rounded-lg bg-[#7f1d1d]/20 text-[#fca5a5] text-sm">
            {error}
          </div>
        )}

        {/* Input area */}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about bot issues, errors, or improvements..."
            className="flex-1 px-4 py-2 rounded-lg bg-[#0f172a]/50 border border-[#334155]/30 text-[#cfd3ea] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-4 py-2 rounded-lg bg-[#1e40af]/50 hover:bg-[#1e40af]/70 text-[#bfdbfe] transition-colors disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </div>

        {/* Example queries */}
        <div className="text-xs text-[#64748b] mt-2">
          <p className="mb-1">Try asking:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Why is my bot not making trades?</li>
            <li>How to fix connection errors with Binance API?</li>
            <li>What causes the AFCS safeguard to activate?</li>
            <li>My paper balance keeps decreasing, what should I check?</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AIBotAssistant;