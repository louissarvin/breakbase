import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { getAvailableModels, SUPPORTED_MODELS } from '../lib/ai/registry.ts';

export const modelsRoutes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {

  // GET /models (public, returns available LLM models)
  app.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    const available = getAvailableModels();

    return reply.code(200).send({
      success: true,
      data: {
        models: available,
        totalSupported: SUPPORTED_MODELS.length,
        totalAvailable: available.length,
      },
      error: null,
    });
  });

  done();
};
