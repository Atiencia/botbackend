import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../config/logger';
import { aiService } from '../services/AIService';
import { embeddingService } from '../services/EmbeddingService';

export const simulateChat = async (req: Request, res: Response) => {
  try {
    const { message, chatHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Para el demo publico, tomamos la configuracion del primer bot activo (el tuyo)
    const { data: botConfig, error: botError } = await supabase
      .from('bot_configs')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (botError || !botConfig) {
      return res.status(404).json({ error: 'No active bot found for simulation.' });
    }

    let knowledgeText = '';
    try {
      const queryEmbedding = await embeddingService.generateEmbedding(message);
      
      const { data: matches } = await supabase.rpc('match_knowledge', {
        query_embedding: queryEmbedding,
        match_threshold: 0.1,
        match_count: 4,
        p_user_id: botConfig.user_id
      });

      if (matches && matches.length > 0) {
        knowledgeText = matches.map((m: any) => m.content).join('\n\n');
      }
    } catch (embErr) {
      logger.error('Simulation: Error in semantic search', embErr);
    }

    const aiResponse = await aiService.getBotResponse(
      botConfig.system_prompt,
      knowledgeText,
      chatHistory,
      message,
      botConfig.model,
      botConfig.temperature
    );

    res.status(200).json({ response: aiResponse });
  } catch (err) {
    logger.error('Error in simulation:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
