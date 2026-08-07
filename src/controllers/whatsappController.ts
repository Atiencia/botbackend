import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../config/logger';
import { metaService } from '../services/MetaService';
import { aiService } from '../services/AIService';
import { embeddingService } from '../services/EmbeddingService';

export const verifyWhatsAppWebhook = async (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token) {
    try {
      const { data, error } = await supabase
        .from('bot_configs')
        .select('id')
        .eq('whatsapp_verify_token', token)
        .single();

      if (data && !error) {
        logger.info('WhatsApp Webhook verified successfully.');
        return res.status(200).send(challenge);
      }
    } catch (err) {
      logger.error('Database error during WhatsApp webhook verification', err);
    }
    
    logger.warn(`WhatsApp Webhook verification failed for token: ${token}`);
    return res.sendStatus(403);
  }

  res.sendStatus(400);
};

export const handleWhatsAppIncomingMessage = async (req: Request, res: Response) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    for (const entry of body.entry) {
      const changes = entry?.changes;
      if (!changes || changes.length === 0) continue;

      const change = changes[0];
      const value = change?.value;
      const metadata = value?.metadata;
      
      if (!metadata || !metadata.phone_number_id) continue;
      
      const phoneNumberId = metadata.phone_number_id;

      const { data: botConfig, error: botError } = await supabase
        .from('bot_configs')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (botError || !botConfig || !botConfig.whatsapp_access_token) {
        logger.error(`No active bot config found to process WhatsApp message`);
        continue;
      }

      if (value.messages && value.messages.length > 0) {
        const message = value.messages[0];
        
        if (message.type === 'text') {
          const senderId = message.from;
          const messageText = message.text.body;
          const metaMessageId = message.id;

          logger.info(`Received WhatsApp message from ${senderId}: ${messageText}`);

          try {
            const { error: insertError } = await supabase.from('chats').insert({
              platform_user_id: senderId,
              user_id: botConfig.user_id,
              role: 'user',
              content: messageText,
              meta_message_id: metaMessageId,
              platform: 'whatsapp'
            });

            if (insertError) {
              if (insertError.code === '23505') {
                continue;
              } else {
                throw insertError;
              }
            }

            const { data: customerData } = await supabase
              .from('customers')
              .select('is_bot_active')
              .eq('platform_user_id', senderId)
              .eq('user_id', botConfig.user_id)
              .single();

            if (!customerData) {
              await supabase.from('customers').insert({
                platform_user_id: senderId,
                user_id: botConfig.user_id,
                platform: 'whatsapp'
              });
            } else {
              await supabase.from('customers')
                .update({ updated_at: new Date().toISOString() })
                .eq('platform_user_id', senderId)
                .eq('user_id', botConfig.user_id);
            }

            if (customerData && customerData.is_bot_active === false) {
              continue;
            }

            // Reuse RAG knowledge logic
            let knowledgeText = '';
            try {
              const queryEmbedding = await embeddingService.generateEmbedding(messageText);
              
              const { data: matches, error: matchError } = await supabase.rpc('match_knowledge', {
                query_embedding: queryEmbedding,
                match_threshold: 0.1,
                match_count: 4,
                p_user_id: botConfig.user_id
              });

              if (matchError) throw matchError;

              if (matches && matches.length > 0) {
                knowledgeText = matches.map((m: any) => m.content).join('\n\n');
              }
            } catch (embErr) {
              const { data: fallbackData } = await supabase
                .from('knowledge')
                .select('content')
                .eq('user_id', botConfig.user_id)
                .limit(5);
              knowledgeText = fallbackData?.map(k => k.content).join('\n\n') || '';
            }

            const { data: chatHistoryData } = await supabase
              .from('chats')
              .select('role, content')
              .eq('platform_user_id', senderId)
              .eq('user_id', botConfig.user_id)
              .order('timestamp', { ascending: false })
              .limit(10);

            const chatHistory = chatHistoryData 
              ? chatHistoryData.reverse().map(c => ({ role: c.role as 'user' | 'assistant', content: c.content }))
              : [];

            let aiResponse = await aiService.getBotResponse(
              botConfig.system_prompt,
              knowledgeText,
              chatHistory,
              messageText,
              botConfig.model,
              botConfig.temperature
            );

            if (aiResponse.includes('[HANDOFF]')) {
              await supabase.from('customers')
                .update({ is_bot_active: false, updated_at: new Date().toISOString() })
                .eq('platform_user_id', senderId)
                .eq('user_id', botConfig.user_id);
              continue;
            }

            const sent = await metaService.sendWhatsAppMessage(phoneNumberId, senderId, aiResponse, botConfig.whatsapp_access_token);

            if (sent) {
              await supabase.from('chats').insert({
                platform_user_id: senderId,
                user_id: botConfig.user_id,
                role: 'assistant',
                content: aiResponse,
                platform: 'whatsapp'
              });
            }
          } catch (err) {
            logger.error('Error processing WhatsApp webhook event:', err);
          }
        }
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
};
