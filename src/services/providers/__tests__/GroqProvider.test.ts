import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroqProvider } from '../GroqProvider';
import Groq from 'groq-sdk';

vi.mock('groq-sdk');
const MockedGroq = vi.mocked(Groq, true);

describe('GroqProvider', () => {
  let provider: GroqProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Configuramos el mock de process.env para que no lance error
    process.env.GROQ_API_KEY = 'test-key';
    provider = new GroqProvider();
  });

  it('should format system prompt and context correctly', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'Respuesta generada por Groq' } }]
    });

    // Inyectamos el mock en la instancia
    (provider as any).groq = {
      chat: {
        completions: {
          create: mockCreate
        }
      }
    };

    const systemPrompt = 'Eres un bot amable';
    const knowledge = 'El precio es 100';
    const chatHistory = [{ role: 'user' as const, content: 'hola' }];
    const userMessage = 'cuanto cuesta?';
    
    const response = await provider.generateResponse(
      systemPrompt, 
      knowledge, 
      chatHistory, 
      userMessage, 
      'llama-test', 
      0.5
    );

    expect(response).toBe('Respuesta generada por Groq');
    expect(mockCreate).toHaveBeenCalledTimes(1);
    
    const callArgs = mockCreate.mock.calls[0][0];
    
    // Verificamos que se inyecto el knowledge en el primer mensaje (system)
    expect(callArgs.messages[0].role).toBe('system');
    expect(callArgs.messages[0].content).toContain(systemPrompt);
    expect(callArgs.messages[0].content).toContain(knowledge);
    
    // Verificamos que el historial se adjunto
    expect(callArgs.messages[1].role).toBe('user');
    expect(callArgs.messages[1].content).toBe('hola');
    
    // Verificamos que el ultimo mensaje es la nueva pregunta del usuario
    expect(callArgs.messages[2].role).toBe('user');
    expect(callArgs.messages[2].content).toBe(userMessage);
    
    // Parametros correctos
    expect(callArgs.model).toBe('llama-test');
    expect(callArgs.temperature).toBe(0.5);
  });

  it('should throw error if API fails', async () => {
    const mockCreate = vi.fn().mockRejectedValue(new Error('Rate limit exceeded'));

    (provider as any).groq = {
      chat: {
        completions: {
          create: mockCreate
        }
      }
    };

    await expect(provider.generateResponse('test', '', [], 'test', 'model', 0.5))
      .rejects.toThrow('Rate limit exceeded');
  });
});
