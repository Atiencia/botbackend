import axios from 'axios';
import { logger } from '../config/logger';

export class MetaService {
  private apiVersion = 'v19.0';

  /**
   * Divide un texto largo en varios trozos para respetar el límite de Meta (1000 char)
   */
  private chunkText(text: string, maxLength: number): string[] {
    if (!text) return [];
    if (text.length <= maxLength) return [text];

    const chunks: string[] = [];
    let currentText = text;

    while (currentText.length > 0) {
      if (currentText.length <= maxLength) {
        chunks.push(currentText);
        break;
      }

      // Buscamos un punto de corte seguro (salto de línea o espacio)
      let sliceIndex = currentText.lastIndexOf('\n', maxLength);
      if (sliceIndex === -1) {
        sliceIndex = currentText.lastIndexOf(' ', maxLength);
      }
      if (sliceIndex === -1) {
        sliceIndex = maxLength; // Corte brusco si no hay espacios
      }

      chunks.push(currentText.substring(0, sliceIndex).trim());
      currentText = currentText.substring(sliceIndex).trim();
    }

    return chunks;
  }

  /**
   * Envía un mensaje a Instagram/Messenger a través de Graph API
   */
  async sendMessage(recipientId: string, messageText: string, pageAccessToken: string): Promise<boolean> {
    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/me/messages`;
      
      // Meta tiene un límite de 1000 caracteres. Cortamos a 900 por seguridad.
      const chunks = this.chunkText(messageText, 900);
      let success = true;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const payload = {
          recipient: { id: recipientId },
          message: { text: chunk }
        };

        await axios.post(url, payload, {
          headers: {
            'Authorization': `Bearer ${pageAccessToken}`,
            'Content-Type': 'application/json'
          }
        });

        // Breve pausa para asegurar el orden de los mensajes en el chat de Instagram
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }

      return success;
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      logger.error(`Error sending message to Meta: ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}

export const metaService = new MetaService();
