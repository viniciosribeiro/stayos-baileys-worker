// StayOS Worker
// Worker stateful para processamento assíncrono
// WebSockets, BullMQ, STT/TTS, iCal sync, webhooks

import express from 'express';
import pino from 'pino';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Queue, Worker as BullWorker, ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';

// Inicializar logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

// Configuração do Redis
const redisConfig: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
};

// Conexão Redis
const connection = new IORedis(redisConfig);

// Filas BullMQ
const queues = {
  // Fila de processamento de mensagens (Módulo 7)
  messages: new Queue('messages', { connection }),
  
  // Fila de STT/TTS (Módulo 8)
  voice: new Queue('voice', { connection }),
  
  // Fila de sincronização iCal (Módulo 13)
  icalSync: new Queue('ical-sync', { connection }),
  
  // Fila de webhooks de billing (Módulo 1.B)
  billingWebhooks: new Queue('billing-webhooks', { connection }),
  
  // Fila de dunning (Módulo 1.B)
  dunning: new Queue('dunning', { connection }),
  
  // Fila de processamento de RAG (Módulo 9)
  rag: new Queue('rag', { connection }),
  
  // Fila de emissões fiscais (Módulo 1.B)
  fiscalDocuments: new Queue('fiscal-documents', { connection }),
};

// Inicializar Workers
function initializeWorkers() {
  logger.info('🚀 Inicializando Workers BullMQ...');

  // Worker de Mensagens
  new BullWorker('messages', async (job) => {
    logger.info(`📩 Processando mensagem: ${job.id}`);
    // Implementação do processamento de mensagens
  }, { connection });

  // Worker de Voz (STT/TTS)
  new BullWorker('voice', async (job) => {
    logger.info(`🎤 Processando voz: ${job.id}`);
    // Implementação do processamento de voz
  }, { connection });

  // Worker de Sincronização iCal
  new BullWorker('ical-sync', async (job) => {
    logger.info(`📅 Sincronizando iCal: ${job.id}`);
    // Implementação da sincronização iCal
  }, { connection });

  // Worker de Webhooks de Billing
  new BullWorker('billing-webhooks', async (job) => {
    logger.info(`💳 Processando webhook de billing: ${job.id}`);
    // Implementação do processamento de webhooks
  }, { connection });

  // Worker de Dunning
  new BullWorker('dunning', async (job) => {
    logger.info(`🔄 Processando dunning: ${job.id}`);
    // Implementação do dunning
  }, { connection });

  // Worker de RAG
  new BullWorker('rag', async (job) => {
    logger.info(`🧠 Processando RAG: ${job.id}`);
    // Implementação do processamento RAG
  }, { connection });

  // Worker de Emissões Fiscais
  new BullWorker('fiscal-documents', async (job) => {
    logger.info(`📄 Processando documento fiscal: ${job.id}`);
    // Implementação da emissão fiscal
  }, { connection });

  logger.info('✅ Workers inicializados');
}

// Inicializar WebSocket Server
function initializeWebSocket(server: express.Application) {
  const httpServer = createServer(server);
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.WEB_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  });

  logger.info('🔌 WebSocket Server inicializado');

  // Namespaces
  const masterNamespace = io.of('/master');
  const tenantNamespace = io.of('/tenant');

  // Conexão Master
  masterNamespace.on('connection', (socket) => {
    logger.info(`✅ Master conectado: ${socket.id}`);

    // Eventos do Command Center (Módulo 1)
    socket.on('subscribe-funnel', () => {
      // Inscrever em atualizações do funil
      logger.info(`📊 Master ${socket.id} inscrito no funil`);
    });

    socket.on('subscribe-leads', () => {
      // Inscrever em atualizações de leads
      logger.info(`🎯 Master ${socket.id} inscrito em leads`);
    });

    socket.on('assume-lead', (data) => {
      // Assumir lead (Módulo 1)
      logger.info(`👤 Master ${socket.id} assumindo lead: ${data.leadId}`);
      masterNamespace.to(data.leadId).emit('lead-assumed', { masterId: socket.id });
    });

    socket.on('disconnect', () => {
      logger.info(`❌ Master desconectado: ${socket.id}`);
    });
  });

  // Conexão Tenant
  tenantNamespace.on('connection', (socket) => {
    logger.info(`✅ Tenant conectado: ${socket.id}`);

    // Eventos de Chat (Módulo 7)
    socket.on('join-conversation', (data) => {
      socket.join(data.conversationId);
      logger.info(`💬 Tenant ${socket.id} entrou na conversa: ${data.conversationId}`);
    });

    socket.on('leave-conversation', (data) => {
      socket.leave(data.conversationId);
      logger.info(`🚪 Tenant ${socket.id} saiu da conversa: ${data.conversationId}`);
    });

    socket.on('send-message', async (data) => {
      // Processar mensagem (Módulo 7)
      logger.info(`📤 Tenant ${socket.id} enviando mensagem: ${data.messageId}`);
      
      // Adicionar à fila de processamento
      await queues.messages.add('process-message', {
        tenantId: data.tenantId,
        conversationId: data.conversationId,
        messageId: data.messageId,
        content: data.content,
      });

      // Emitir confirmação
      socket.emit('message-sent', { messageId: data.messageId });
    });

    // Eventos de Voz (Módulo 8)
    socket.on('start-voice', async (data) => {
      logger.info(`🎤 Tenant ${socket.id} iniciando voz: ${data.sessionId}`);
      
      // Adicionar à fila de voz
      await queues.voice.add('start-voice-session', {
        tenantId: data.tenantId,
        sessionId: data.sessionId,
        audio: data.audio,
      });
    });

    socket.on('stop-voice', () => {
      logger.info(`🛑 Tenant ${socket.id} parando voz`);
    });

    // Eventos de RAG (Módulo 9)
    socket.on('train-ai', async (data) => {
      logger.info(`🧠 Tenant ${socket.id} treinando IA: ${data.documentId}`);
      
      // Adicionar à fila de RAG
      await queues.rag.add('train-document', {
        tenantId: data.tenantId,
        documentId: data.documentId,
        content: data.content,
      });
    });

    socket.on('disconnect', () => {
      logger.info(`❌ Tenant desconectado: ${socket.id}`);
    });
  });

  return httpServer;
}

// Inicializar API Server
const app = express();
const PORT = parseInt(process.env.WORKER_PORT || '4000');

// Middleware
app.use(express.json({ limit: '10mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    timestamp: Date.now(),
    queues: Object.keys(queues).map((key) => ({
      name: key,
      // count: await queues[key].getJobCounts(),
    })),
  });
});

// API de Filas
app.post('/api/queues/:name/add', async (req, res) => {
  const { name } = req.params;
  const { data, options } = req.body;

  try {
    const queue = queues[name as keyof typeof queues];
    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const job = await queue.add(name, data, options);
    res.json({ ok: true, jobId: job.id });
  } catch (error) {
    logger.error('Failed to add job:', error);
    res.status(500).json({ error: String(error) });
  }
});

// API de Status de Filas
app.get('/api/queues/:name/status', async (req, res) => {
  const { name } = req.params;

  try {
    const queue = queues[name as keyof typeof queues];
    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const counts = await queue.getJobCounts();
    res.json({ ok: true, counts });
  } catch (error) {
    logger.error('Failed to get queue status:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Inicializar
async function main() {
  logger.info('🚀 Inicializando StayOS Worker...');

  // Inicializar Workers
  initializeWorkers();

  // Inicializar WebSocket
  const httpServer = initializeWebSocket(app);

  // Inicializar Server
  httpServer.listen(PORT, () => {
    logger.info(`✅ StayOS Worker ouvindo na porta ${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('🛑 Recebido SIGTERM. Encerrando...');
    httpServer.close(() => {
      logger.info('✅ Server encerrado');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('🛑 Recebido SIGINT. Encerrando...');
    httpServer.close(() => {
      logger.info('✅ Server encerrado');
      process.exit(0);
    });
  });
}

main().catch((error) => {
  logger.error('❌ Erro fatal:', error);
  process.exit(1);
});

export default app;
