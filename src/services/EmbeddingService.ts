import { pipeline, env } from '@xenova/transformers';
import { logger } from '../config/logger';

// Desactivar descargas de modelos locales en producción (se descargarán on the fly y se cacheados)
env.allowLocalModels = false;
env.useBrowserCache = false;

class EmbeddingService {
  private extractor: any = null;

  async init() {
    if (!this.extractor) {
      try {
        logger.info('Inicializando modelo de embeddings (Xenova)...');
        this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        logger.info('Modelo de embeddings listo.');
      } catch (error) {
        logger.error('Error inicializando el modelo de embeddings', error);
      }
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    await this.init();
    if (!this.extractor) throw new Error('El modelo de embeddings no está inicializado.');
    
    // Generar embedding
    const output = await this.extractor(text, { pooling: 'mean', normalize: true });
    
    // Devolver como un array de números (384 dimensiones)
    return Array.from(output.data);
  }
}

export const embeddingService = new EmbeddingService();
