import Groq from 'groq-sdk';
import { AIProvider } from './AIProvider';
import { logger } from '../../config/logger';

export class GroqProvider implements AIProvider {
  private groq: Groq;

  constructor() {
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  async generateResponse(
    systemPrompt: string,
    knowledge: string,
    chatHistory: { role: 'user' | 'assistant' | 'system', content: string }[],
    userMessage: string,
    model: string,
    temperature: number
  ): Promise<string> {
    
    // Inyectamos el conocimiento en el system prompt
    const fullSystemPrompt = `${systemPrompt}\n\nAquí tienes la información de la empresa (Base de Conocimiento) que debes usar para responder las dudas del usuario. Basa tus respuestas en esto:\n${knowledge || 'No hay información adicional.'}`;

    const messages = [
      { role: 'system' as const, content: fullSystemPrompt },
      ...chatHistory,
      { role: 'user' as const, content: userMessage }
    ];

    try {
      const chatCompletion = await this.groq.chat.completions.create({
        messages,
        model: model || 'llama-3.1-8b-instant',
        temperature: temperature ?? 0.7,
        max_tokens: 1024,
      });

      return chatCompletion.choices[0]?.message?.content || 'Lo siento, no pude generar una respuesta.';
    } catch (error) {
      logger.error('Error in GroqProvider:', error);
      throw error;
    }
  }
}
