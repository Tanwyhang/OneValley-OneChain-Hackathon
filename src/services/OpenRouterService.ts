/**
 * OpenRouter API Service
 * 
 * Integrates with OpenRouter API to provide AI responses for NPC dialogues
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
}

export class OpenRouterService {
  private apiKey: string;
  private baseUrl: string = 'https://openrouter.ai/api/v1/chat/completions';
  private model: string = 'openrouter/sherlock-dash-alpha';
  private conversationHistory: ChatMessage[] = [];

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('OpenRouter API key not found in environment variables');
    }

    // Initialize with Herman's personality
    this.conversationHistory.push({
      role: 'system',
      content: `You are Herman, a friendly merchant NPC in OneValley farming game. 
Give ultra-short responses (5-10 words max). Be warm and helpful about trading, farming, and blockchain.
Stay in character. Use Genz phrases and be flirty and dirty sometimes.`
    });
  }

  /**
   * Send a message to the AI and get a response
   */
  async sendMessage(userMessage: string, retryCount: number = 0): Promise<string> {
    if (!this.apiKey) {
      return "My connection to the ethereal realm seems... disrupted. (API key not configured)";
    }

    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.href : 'https://onevalley.game',
          'X-Title': 'OneValley Game'
        },
        body: JSON.stringify({
          model: this.model,
          messages: this.conversationHistory,
          temperature: 0.7,
          max_tokens: 150, // Keep responses concise
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('OpenRouter API error:', response.status, errorData);
        
        // Remove the user message from history since request failed
        this.conversationHistory.pop();
        
        // Friendly error messages
        if (response.status === 401) {
          return "Hmm, my trading credentials seem invalid. Let me check with the guild...";
        } else if (response.status === 429) {
          // Rate limit hit - try to retry with exponential backoff
          if (retryCount < 2) {
            const waitTime = Math.pow(2, retryCount) * 1000; // 1s, 2s
            console.log(`Rate limited, retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this.sendMessage(userMessage, retryCount + 1);
          }
          return "So many travelers seeking my wisdom today! Perhaps we can chat again in a moment?";
        } else {
          return "My apologies, I seem to be having trouble with my ledger. Try again?";
        }
      }

      const data: OpenRouterResponse = await response.json();
      const assistantMessage = data.choices[0]?.message?.content || "I'm not sure what to say to that...";

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantMessage
      });

      // Keep conversation history manageable (last 10 messages + system prompt)
      if (this.conversationHistory.length > 21) {
        this.conversationHistory = [
          this.conversationHistory[0], // Keep system prompt
          ...this.conversationHistory.slice(-20) // Keep last 20 messages
        ];
      }

      return assistantMessage;

    } catch (error) {
      console.error('Error calling OpenRouter API:', error);
      // Remove the user message from history since request failed
      this.conversationHistory.pop();
      return "Forgive me, traveler. My mind wandered for a moment. What were you saying?";
    }
  }

  /**
   * Reset conversation history
   */
  resetConversation(): void {
    const systemPrompt = this.conversationHistory[0];
    this.conversationHistory = [systemPrompt];
  }

  /**
   * Get conversation history
   */
  getHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Check if service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

// Singleton instance for use across the app
let openRouterServiceInstance: OpenRouterService | null = null;

export function getOpenRouterService(): OpenRouterService {
  if (!openRouterServiceInstance) {
    openRouterServiceInstance = new OpenRouterService();
  }
  return openRouterServiceInstance;
}
