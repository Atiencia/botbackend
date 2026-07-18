import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../config/logger';
import { metaService } from '../services/MetaService';
import { aiService } from '../services/AIService';

/**
 * GET: Verificación del Webhook por parte de Meta
 */
export const verifyWebhook = async (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token) {
    try {
      // Buscamos si existe algun bot con este verify_token
      const { data, error } = await supabase
        .from('bot_configs')
        .select('id')
        .eq('meta_verify_token', token)
        .single();

      if (data && !error) {
        logger.info('Webhook verified successfully by Meta.');
        return res.status(200).send(challenge);
      }
    } catch (err) {
      logger.error('Database error during webhook verification', err);
    }
    
    logger.warn(`Webhook verification failed for token: ${token}`);
    return res.sendStatus(403);
  }

  res.sendStatus(400);
};

/**
 * POST: Recepción de mensajes de Instagram/Messenger
 */
export const handleIncomingMessage = async (req: Request, res: Response) => {
  const body = req.body;

  // Verificamos si es un evento de pagina
  if (body.object === 'instagram' || body.object === 'page') {
    for (const entry of body.entry) {
      // El ID de la pagina de Instagram/Facebook
      const pageId = entry.id;

      // Por ahora es un MVP. En un SaaS real, buscariamos el bot_config usando este pageId.
      // Como MVP, simplemente tomamos la configuracion del usuario activo.
      const { data: botConfig, error: botError } = await supabase
        .from('bot_configs')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (botError || !botConfig || !botConfig.meta_access_token) {
        logger.error(`No active bot config found to process message for page ${pageId}`);
        continue;
      }

      if (entry.messaging) {
        for (const webhookEvent of entry.messaging) {
          // Solo procesamos mensajes de texto (ignoramos leidos, entregados, etc)
          if (webhookEvent.message && webhookEvent.message.text) {
            const senderId = webhookEvent.sender.id;
            const messageText = webhookEvent.message.text;

            logger.info(`Received message from ${senderId}: ${messageText}`);

            try {
              // 1. Guardar mensaje del usuario en BD
              await supabase.from('chats').insert({
                instagram_user_id: senderId,
                user_id: botConfig.user_id,
                role: 'user',
                content: messageText
              });

              // 2. Obtener Base de Conocimiento del usuario
              const { data: knowledgeData } = await supabase
                .from('knowledge')
                .select('content')
                .eq('user_id', botConfig.user_id);
              
              const knowledgeText = knowledgeData?.map(k => k.content).join('\n\n') || '';

              // 3. Obtener Historial de Chat reciente (ultimos 10 mensajes)
              const { data: chatHistoryData } = await supabase
                .from('chats')
                .select('role, content')
                .eq('instagram_user_id', senderId)
                .eq('user_id', botConfig.user_id)
                .order('timestamp', { ascending: false })
                .limit(10);

              const chatHistory = chatHistoryData 
                ? chatHistoryData.reverse().map(c => ({ role: c.role as 'user' | 'assistant', content: c.content }))
                : [];

              // 4. Generar respuesta con IA
              const aiResponse = await aiService.getBotResponse(
                botConfig.system_prompt,
                knowledgeText,
                chatHistory,
                messageText,
                botConfig.model,
                botConfig.temperature
              );

              // 5. Enviar respuesta por Graph API
              const sent = await metaService.sendMessage(senderId, aiResponse, botConfig.meta_access_token);

              if (sent) {
                // 6. Guardar respuesta del bot en BD
                await supabase.from('chats').insert({
                  instagram_user_id: senderId,
                  user_id: botConfig.user_id,
                  role: 'assistant',
                  content: aiResponse
                });
                logger.info(`Successfully replied to ${senderId}`);
              }
            } catch (err) {
              logger.error('Error processing webhook event:', err);
            }
          }
        }
      }
    }
    
    // IMPORTANTE: En Vercel enviamos el status 200 al FINAL de todo el proceso.
    // Si lo enviamos al inicio, Vercel mata la función y nunca se ejecuta la IA.
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
};
