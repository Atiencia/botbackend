import axios from 'axios';
import { logger } from '../config/logger';

const HF_API_URL = 'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2';

class EmbeddingService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('HUGGINGFACE_API_KEY no está configurada. Los embeddings no funcionarán.');
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('HUGGINGFACE_API_KEY no configurada.');
    }

    try {
      const response = await axios.post(
        HF_API_URL,
        { inputs: text, options: { wait_for_model: true } },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // La API devuelve un array de arrays (una por cada token).
      // Necesitamos hacer mean pooling para obtener un solo vector de 384 dimensiones.
      const tokenEmbeddings: number[][] = response.data;

      if (!Array.isArray(tokenEmbeddings) || tokenEmbeddings.length === 0) {
        throw new Error('Respuesta inesperada de Hugging Face API');
      }

      // Si la respuesta ya es un vector plano (384 dims), lo retornamos directamente
      if (typeof tokenEmbeddings[0] === 'number') {
        return tokenEmbeddings as unknown as number[];
      }

      // Mean pooling: promediamos todos los vectores de tokens
      const dimensions = tokenEmbeddings[0].length;
      const meanVector = new Array(dimensions).fill(0);

      for (const tokenVec of tokenEmbeddings) {
        for (let i = 0; i < dimensions; i++) {
          meanVector[i] += tokenVec[i];
        }
      }

      for (let i = 0; i < dimensions; i++) {
        meanVector[i] /= tokenEmbeddings.length;
      }

      // Normalizar el vector (L2 normalization)
      const norm = Math.sqrt(meanVector.reduce((sum: number, val: number) => sum + val * val, 0));
      const normalized = meanVector.map((val: number) => val / norm);

      return normalized;
    } catch (error: any) {
      if (error.response?.status === 503) {
        // El modelo está cargando en HF, reintentamos una vez después de esperar
        logger.info('Modelo de HF cargando, reintentando en 5 segundos...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        return this.generateEmbedding(text);
      }
      logger.error('Error generando embedding con Hugging Face:', error.message);
      throw error;
    }
  }
}

export const embeddingService = new EmbeddingService();
