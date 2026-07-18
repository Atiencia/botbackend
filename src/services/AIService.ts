import { AIProvider } from './providers/AIProvider';
import { GroqProvider } from './providers/GroqProvider';

export class AIService {
  private provider: AIProvider;

  constructor() {
    // Aquí es donde en el futuro podemos inyectar OpenAIProvider o GeminiProvider
    this.provider = new GroqProvider();
  }

  async getBotResponse(
    systemPrompt: string,
    knowledge: string,
    chatHistory: { role: 'user' | 'assistant' | 'system', content: string }[],
    userMessage: string,
    model: string,
    temperature: number
  ): Promise<string> {
    return this.provider.generateResponse(
      systemPrompt, 
      knowledge, 
      chatHistory, 
      userMessage, 
      model, 
      temperature
    );
  }
}

// Exportamos un singleton
export const aiService = new AIService();
