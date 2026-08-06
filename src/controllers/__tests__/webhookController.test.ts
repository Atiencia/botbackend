import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleIncomingMessage } from '../webhookController';
import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { metaService } from '../../services/MetaService';
import { aiService } from '../../services/AIService';
import { embeddingService } from '../../services/EmbeddingService';

// Mocks
vi.mock('../../config/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  }
}));

vi.mock('../../services/MetaService', () => ({
  metaService: {
    sendMessage: vi.fn(),
  }
}));

vi.mock('../../services/AIService', () => ({
  aiService: {
    getBotResponse: vi.fn(),
  }
}));

vi.mock('../../services/EmbeddingService', () => ({
  embeddingService: {
    generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  }
}));

describe('WebhookController - handleIncomingMessage', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();

    res = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
      sendStatus: vi.fn(),
    };

    // Setup base Supabase chain mocks
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockLimit = vi.fn().mockReturnThis();
    const mockSingle = vi.fn();
    const mockInsert = vi.fn();
    const mockUpdate = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockReturnThis();

    (supabase.from as any).mockImplementation((table: string) => {
      return {
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
        eq: mockEq,
        limit: mockLimit,
        single: mockSingle,
        order: mockOrder,
      };
    });
  });

  it('should return 404 if object is not page or instagram', async () => {
    req = { body: { object: 'unknown' } };
    await handleIncomingMessage(req as Request, res as Response);
    expect(res.sendStatus).toHaveBeenCalledWith(404);
  });

  it('should process incoming message and send AI response', async () => {
    // 1. Arrange
    req = {
      body: {
        object: 'instagram',
        entry: [{
          id: 'page123',
          messaging: [{
            sender: { id: 'user456' },
            message: { text: 'Hola, quiero info', mid: 'msg1' }
          }]
        }]
      }
    };

    // Mock bot config
    const botConfig = { user_id: 'uuid-1', meta_access_token: 'token', system_prompt: 'Eres Eli' };
    const customerData = { is_bot_active: true };

    // Hacky mock chaining for Supabase
    (supabase.from as any).mockImplementation((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        if (table === 'bot_configs') return Promise.resolve({ data: botConfig, error: null });
        if (table === 'customers') return Promise.resolve({ data: customerData });
        return Promise.resolve({ data: null });
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnThis(),
    }));

    (supabase.rpc as any).mockResolvedValue({ data: [{ content: 'Conocimiento mock' }], error: null });
    (aiService.getBotResponse as any).mockResolvedValue('¡Claro! Somos una tienda de ropa.');
    (metaService.sendMessage as any).mockResolvedValue(true);

    // 2. Act
    await handleIncomingMessage(req as Request, res as Response);

    // 3. Assert
    // Must return 200 OK immediately for Meta webhook
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('EVENT_RECEIVED');

    // AI must be called
    expect(aiService.getBotResponse).toHaveBeenCalled();
    
    // Meta service must send the message
    expect(metaService.sendMessage).toHaveBeenCalledWith(
      'user456',
      '¡Claro! Somos una tienda de ropa.',
      'token'
    );
  });

  it('should pause bot silently if AI response includes [HANDOFF]', async () => {
    req = {
      body: {
        object: 'instagram',
        entry: [{
          id: 'page123',
          messaging: [{
            sender: { id: 'user456' },
            message: { text: 'Quiero hablar con un humano', mid: 'msg2' }
          }]
        }]
      }
    };

    const botConfig = { user_id: 'uuid-1', meta_access_token: 'token', system_prompt: 'Eres Eli' };
    const customerData = { is_bot_active: true };

    (supabase.from as any).mockImplementation((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        if (table === 'bot_configs') return Promise.resolve({ data: botConfig, error: null });
        if (table === 'customers') return Promise.resolve({ data: customerData });
        return Promise.resolve({ data: null });
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnThis(),
    }));

    (aiService.getBotResponse as any).mockResolvedValue('En un momento un agente humano te atenderá [HANDOFF]');
    
    await handleIncomingMessage(req as Request, res as Response);

    // Debe saltarse el envio de mensajes por el silent handoff
    expect(metaService.sendMessage).not.toHaveBeenCalled();
    
    // Pero sí debe haber respondido a Meta con 200
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
