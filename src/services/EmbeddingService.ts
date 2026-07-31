import { logger } from '../config/logger';

class EmbeddingService {
  private extractor: any = null;
  private initFailed = false;

  async init() {
    if (this.extractor || this.initFailed) return;
    
    try {
      logger.info('Inicializando modelo de embeddings (Xenova)...');
      
      // Importación DINÁMICA para no romper el arranque del servidor
      const transformers = await import('@xenova/transformers');
      
      // Configuración para Vercel Serverless (Filesystem es Read-Only)
      transformers.env.allowLocalModels = false;
      transformers.env.useBrowserCache = false;
      
      // En entornos serverless, usar /tmp como cache
      const os = await import('os');
      const path = await import('path');
      transformers.env.cacheDir = path.join(os.tmpdir(), '.xenova-cache');
      
      this.extractor = await transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      logger.info('Modelo de embeddings listo.');
    } catch (error) {
      this.initFailed = true;
      logger.error('Error inicializando el modelo de embeddings. Se usará fallback sin embeddings.', error);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    await this.init();
    
    if (!this.extractor) {
      // FALLBACK: si xenova no funciona, devolvemos null para que el caller use fallback
      throw new Error('Embeddings no disponibles. Usar fallback de texto.');
    }
    
    const output = await this.extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }
  
  isAvailable(): boolean {
    return this.extractor !== null && !this.initFailed;
  }
}

export const embeddingService = new EmbeddingService();
