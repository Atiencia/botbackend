import axios from 'axios';
import { logger } from '../config/logger';

export class MetaService {
  private apiVersion = 'v19.0';

  /**
   * Envía un mensaje a Instagram/Messenger a través de Graph API
   */
  async sendMessage(recipientId: string, messageText: string, pageAccessToken: string): Promise<boolean> {
    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/me/messages`;
      
      const payload = {
        recipient: { id: recipientId },
        message: { text: messageText }
      };

      await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${pageAccessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return true;
    } catch (error: any) {
      logger.error(`Error sending message to Meta: ${error.response?.data?.error?.message || error.message}`);
      return false;
    }
  }
}

export const metaService = new MetaService();
