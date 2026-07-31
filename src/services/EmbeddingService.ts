import { logger } from '../config/logger';

class EmbeddingService {
  private extractor: any = null;
  private initFailed = false;

  async init() {
    if (this.extractor || this.initFailed) return;
    
    try {
      logger.info('Inicializando modelo de embeddings (Xenova)...');
      
      // Importación dinámica con variable para evitar que el bundler de Vercel
      // intente resolver este módulo en tiempo de build
      const moduleName = '@xenova/transformers';
      const transformers = await import(/* webpackIgnore: true */ moduleName);
      
      // Configuración para entornos serverless (Filesystem Read-Only)
      transformers.env.allowLocalModels = false;
      transformers.env.useBrowserCache = false;
      
      // Usar /tmp como cache en entornos serverless
      const os = await import('os');
      const path = await import('path');
      transformers.env.cacheDir = path.join(os.tmpdir(), '.xenova-cache');
      
      this.extractor = await transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      logger.info('Modelo de embeddings listo.');
    } catch (error) {
      this.initFailed = true;
      logger.warn('Embeddings no disponibles (normal en Vercel). Se usará búsqueda por texto.');
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    await this.init();
    
    if (!this.extractor) {
      throw new Error('Embeddings no disponibles. Usar fallback de texto.');
    }
    
    const output = await this.extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }
}

export const embeddingService = new EmbeddingService();
