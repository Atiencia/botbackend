import { describe, it, expect, vi, beforeEach } from 'vitest';
import { metaService } from '../MetaService';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('MetaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('chunkText', () => {
    it('should not split text shorter than max length', () => {
      // Usamos any para acceder a un método privado en el test
      const chunks = (metaService as any).chunkText('Hola mundo', 900);
      expect(chunks).toEqual(['Hola mundo']);
    });

    it('should split text at line breaks when exceeding max length', () => {
      const longText = 'A'.repeat(500) + '\n\n' + 'B'.repeat(500);
      const chunks = (metaService as any).chunkText(longText, 900);
      
      expect(chunks.length).toBe(2);
      expect(chunks[0]).toBe('A'.repeat(500));
      expect(chunks[1]).toBe('B'.repeat(500));
    });

    it('should split text at spaces when exceeding max length and no line breaks exist', () => {
      const longText = 'A'.repeat(500) + ' ' + 'B'.repeat(500);
      const chunks = (metaService as any).chunkText(longText, 900);
      
      expect(chunks.length).toBe(2);
      expect(chunks[0]).toBe('A'.repeat(500));
      expect(chunks[1]).toBe('B'.repeat(500));
    });
    
    it('should hard split text if there are no line breaks or spaces', () => {
      const longText = 'A'.repeat(1500);
      const chunks = (metaService as any).chunkText(longText, 900);
      
      expect(chunks.length).toBe(2);
      expect(chunks[0]).toBe('A'.repeat(900));
      expect(chunks[1]).toBe('A'.repeat(600));
    });
  });

  describe('sendMessage', () => {
    it('should send a single message if text is short', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });
      
      const success = await metaService.sendMessage('123', 'Hello', 'token');
      
      expect(success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post.mock.calls[0][1]).toEqual({
        recipient: { id: '123' },
        message: { text: 'Hello' }
      });
    });

    it('should send multiple messages with delay if text is very long', async () => {
      mockedAxios.post.mockResolvedValue({ data: { success: true } });
      const longText = 'A'.repeat(1500); // Se cortara a 900 y 600
      
      const startTime = Date.now();
      const success = await metaService.sendMessage('123', longText, 'token');
      const duration = Date.now() - startTime;
      
      expect(success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
      // El segundo mensaje (chunk de 600)
      expect(mockedAxios.post.mock.calls[1][1]).toEqual({
        recipient: { id: '123' },
        message: { text: 'A'.repeat(600) }
      });
      // Verifica que el delay de 800ms ocurrio
      expect(duration).toBeGreaterThanOrEqual(750);
    });
    
    it('should throw an error if API call fails', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('API Error'));
      
      await expect(metaService.sendMessage('123', 'Hello', 'token')).rejects.toThrow('API Error');
    });
  });

  describe('sendImage', () => {
    it('should send an image successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });
      
      const success = await metaService.sendImage('123', 'https://example.com/img.jpg', 'token');
      
      expect(success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post.mock.calls[0][1]).toEqual({
        recipient: { id: '123' },
        message: {
          attachment: {
            type: 'image',
            payload: {
              url: 'https://example.com/img.jpg',
              is_reusable: true
            }
          }
        }
      });
    });

    it('should throw an error if image sending fails', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Upload Error'));
      
      await expect(metaService.sendImage('123', 'url', 'token')).rejects.toThrow('Upload Error');
    });
  });
});
