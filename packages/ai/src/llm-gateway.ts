// StayOS LLM Gateway
// Gateway Unificado com Fallback Automático e Log de Latência

import { prisma } from '@stayos/db';
import { 
  TokenProvider, 
  AIModel, 
  LLMConfig, 
  LLMRequest, 
  LLMResponse,
  LLMStreamChunk
} from './types';

// ============================================================================
// Providers Implementations
// ============================================================================

class OpenAIProvider {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    // Implementação real com OpenAI SDK
    // Placeholder para a implementação real
    const response = await this.callOpenAI(request);
    return response;
  }

  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    // Implementação de streaming
    for await (const chunk of this.callOpenAIStream(request)) {
      yield chunk;
    }
  }

  private async callOpenAI(request: LLMRequest): Promise<LLMResponse> {
    // Simulação de resposta
    return {
      content: `Resposta simulada do ${this.config.model} para: ${request.prompt}`,
      model: this.config.model,
      finishReason: 'stop',
      usage: {
        promptTokens: 25,
        completionTokens: 50,
        totalTokens: 75
      }
    };
  }

  private async *callOpenAIStream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    // Simulação de streaming
    const words = request.prompt.split(' ');
    for (const word of words) {
      await new Promise(resolve => setTimeout(resolve, 50));
      yield {
        content: word + ' ',
        finishReason: undefined
      };
    }
    yield {
      content: '',
      finishReason: 'stop',
      usage: {
        promptTokens: 25,
        completionTokens: words.length * 2,
        totalTokens: 25 + words.length * 2
      }
    };
  }
}

class AnthropicProvider {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.callAnthropic(request);
    return response;
  }

  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    for await (const chunk of this.callAnthropicStream(request)) {
      yield chunk;
    }
  }

  private async callAnthropic(request: LLMRequest): Promise<LLMResponse> {
    return {
      content: `Resposta simulada do ${this.config.model} (Anthropic) para: ${request.prompt}`,
      model: this.config.model,
      finishReason: 'stop',
      usage: {
        promptTokens: 25,
        completionTokens: 50,
        totalTokens: 75
      }
    };
  }

  private async *callAnthropicStream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    const words = request.prompt.split(' ');
    for (const word of words) {
      await new Promise(resolve => setTimeout(resolve, 50));
      yield {
        content: word + ' ',
        finishReason: undefined
      };
    }
    yield {
      content: '',
      finishReason: 'stop',
      usage: {
        promptTokens: 25,
        completionTokens: words.length * 2,
        totalTokens: 25 + words.length * 2
      }
    };
  }
}

class ElevenLabsProvider {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.callElevenLabs(request);
    return response;
  }

  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    for await (const chunk of this.callElevenLabsStream(request)) {
      yield chunk;
    }
  }

  private async callElevenLabs(request: LLMRequest): Promise<LLMResponse> {
    return {
      content: `Resposta simulada do ${this.config.model} (ElevenLabs) para: ${request.prompt}`,
      model: this.config.model,
      finishReason: 'stop',
      usage: {
        promptTokens: 25,
        completionTokens: 50,
        totalTokens: 75
      }
    };
  }

  private async *callElevenLabsStream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    const words = request.prompt.split(' ');
    for (const word of words) {
      await new Promise(resolve => setTimeout(resolve, 50));
      yield {
        content: word + ' ',
        finishReason: undefined
      };
    }
    yield {
      content: '',
      finishReason: 'stop',
      usage: {
        promptTokens: 25,
        completionTokens: words.length * 2,
        totalTokens: 25 + words.length * 2
      }
    };
  }
}

// ============================================================================
// Provider Factory
// ============================================================================

const providerMap: Record<TokenProvider, new (config: LLMConfig) => any> = {
  openai: OpenAIProvider,
  anthropic: AnthropicProvider,
  elevenlabs: ElevenLabsProvider,
  whisper: OpenAIProvider, // Whisper usa a mesma infra da OpenAI
  google: OpenAIProvider,
  azure: OpenAIProvider,
  ollama: OpenAIProvider,
  openrouter: OpenAIProvider,
};

// ============================================================================
// LLM Gateway
// ============================================================================

export class LLMGateway {
  private providers: Map<TokenProvider, any>;
  private fallbackOrder: TokenProvider[];

  constructor() {
    this.providers = new Map();
    this.fallbackOrder = [];
  }

  // Inicializar com configurações do banco
  async initialize(): Promise<void> {
    const configs = await prisma.lLMGatewayConfig.findMany({
      where: { isActive: true },
      include: { 
        // Buscar chaves de API
        // Note: Em produção, as chaves devem ser descriptografadas
      }
    });

    // Carregar chaves de API
    const apiKeys = await prisma.aPIKey.findMany({
      where: { isActive: true }
    });

    for (const config of configs) {
      const apiKey = apiKeys.find(k => k.provider === config.provider);
      if (apiKey) {
        const providerConfig: LLMConfig = {
          provider: config.provider as TokenProvider,
          model: this.getDefaultModel(config.provider as TokenProvider),
          baseUrl: (config.config as any).baseUrl,
          apiKey: apiKey.encryptedKey, // Em produção: decrypt(apiKey.encryptedKey)
          timeout: (config.config as any).timeout || 30000,
          apiVersion: (config.config as any).apiVersion
        };
        
        const ProviderClass = providerMap[config.provider as TokenProvider];
        if (ProviderClass) {
          this.providers.set(config.provider as TokenProvider, new ProviderClass(providerConfig));
        }
      }
    }

    // Configurar ordem de fallback
    const openAIConfig = configs.find(c => c.provider === 'openai');
    if (openAIConfig) {
      this.fallbackOrder = (openAIConfig.fallbackOrder as number[]).map(
        (idx) => Object.values(TokenProvider)[idx] as TokenProvider
      );
    }
  }

  // Obter modelo padrão para cada provider
  private getDefaultModel(provider: TokenProvider): AIModel {
    const modelMap: Record<TokenProvider, AIModel> = {
      openai: 'gpt4',
      anthropic: 'claude3',
      elevenlabs: 'elevenlabs_v2',
      whisper: 'whisper1',
      google: 'gpt4',
      azure: 'gpt4',
      ollama: 'gpt4',
      openrouter: 'gpt4'
    };
    return modelMap[provider];
  }

  // Chamada não-streaming com fallback automático
  async chat(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    for (const provider of this.fallbackOrder) {
      const providerInstance = this.providers.get(provider);
      if (providerInstance) {
        try {
          const response = await providerInstance.chat(request);
          
          // Log de latência
          await this.logLatency(provider, Date.now() - startTime, true);
          
          return response;
        } catch (error) {
          // Log de erro
          await this.logLatency(provider, Date.now() - startTime, false, String(error));
          console.error(`❌ Erro com ${provider}:`, error);
        }
      }
    }

    throw new Error('Todos os providers falharam');
  }

  // Chamada streaming com fallback automático
  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    const startTime = Date.now();
    
    for (const provider of this.fallbackOrder) {
      const providerInstance = this.providers.get(provider);
      if (providerInstance && typeof providerInstance.stream === 'function') {
        try {
          for await (const chunk of providerInstance.stream(request)) {
            yield chunk;
          }
          
          // Log de latência
          await this.logLatency(provider, Date.now() - startTime, true);
          
          return;
        } catch (error) {
          // Log de erro
          await this.logLatency(provider, Date.now() - startTime, false, String(error));
          console.error(`❌ Erro com ${provider} (stream):`, error);
        }
      }
    }

    throw new Error('Todos os providers falharam (stream)');
  }

  // Log de latência e erros
  private async logLatency(
    provider: TokenProvider,
    latencyMs: number,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    // Em produção, salvar no banco ou enviar para monitoramento
    console.log(`[LLM Gateway] ${provider}: ${latencyMs}ms - ${success ? '✅' : '❌'} ${errorMessage || ''}`);
  }

  // Obter provider específico
  getProvider(provider: TokenProvider): any {
    return this.providers.get(provider);
  }

  // Verificar saúde dos providers
  async healthCheck(): Promise<Record<TokenProvider, boolean>> {
    const health: Record<TokenProvider, boolean> = {};
    
    for (const [provider, instance] of this.providers) {
      try {
        // Testar com uma requisição simples
        const response = await instance.chat({
          prompt: 'Responda apenas com "OK"',
          maxTokens: 5
        });
        health[provider] = response.content.includes('OK');
      } catch {
        health[provider] = false;
      }
    }

    return health;
  }
}

// Singleton
export const llmGateway = new LLMGateway();
