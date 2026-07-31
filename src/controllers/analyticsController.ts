import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';
import { logger } from '../config/logger';

export const getAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    // 1. Total customers
    const { count: customersCount, error: custError } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (custError) throw custError;

    // 2. Total messages (from bot)
    const { count: botMessagesCount, error: msgError } = await supabase
      .from('chats')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'assistant');

    if (msgError) throw msgError;

    // 3. Messages per day (last 7 days)
    // To do this simply in Supabase JS without complex RPCs, we can just fetch all messages from the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentChats, error: recentError } = await supabase
      .from('chats')
      .select('timestamp, role')
      .eq('user_id', userId)
      .gte('timestamp', sevenDaysAgo.toISOString());

    if (recentError) throw recentError;

    // Agrupar por dia
    const dailyData: Record<string, { date: string, user: number, bot: number }> = {};
    
    // Inicializar los ultimos 7 dias
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailyData[dateStr] = { date: dateStr, user: 0, bot: 0 };
    }

    recentChats?.forEach(chat => {
      const dateStr = new Date(chat.timestamp).toISOString().split('T')[0];
      if (dailyData[dateStr]) {
        if (chat.role === 'user') dailyData[dateStr].user += 1;
        if (chat.role === 'assistant') dailyData[dateStr].bot += 1;
      }
    });

    res.status(200).json({
      totalCustomers: customersCount || 0,
      totalBotMessages: botMessagesCount || 0,
      chartData: Object.values(dailyData)
    });
  } catch (err) {
    logger.error('Error fetching analytics:', err);
    res.status(500).json({ error: 'Error fetching analytics' });
  }
};
