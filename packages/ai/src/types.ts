// StayOS AI Types
// Tipos para o Gateway de LLM e RAG Engine

import { z } from 'zod';

// ============================================================================
// Token Providers
// ============================================================================

export type TokenProvider = 
  | 'openai'
  | 'anthropic'
  | 'elevenlabs'
  | 'whisper'
  | 'google'
  | 'azure'
  | 'ollama'
  | 'openrouter';

export type AIModel = 
  | 'gpt4'
  | 'gpt4o'
  | 'gpt35'
  | 'claude3'
  | 'claude2'
  | 'elevenlabs_v2'
  | 'whisper1';

// ============================================================================
// LLM Gateway Types
// ============================================================================

export interface LLMConfig {
  provider: TokenProvider;
  model: AIModel;
  baseUrl?: string;
  apiKey: string;
  timeout?: number;
  apiVersion?: string;
}

export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  messages?: Array<{
    role: 'system' | 'user' | 'assistant' | 'function';
    content: string;
    name?: string;
  }>;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stop?: string[];
  stream?: boolean;
  // Function Calling
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
}

export interface LLMResponse {
  content: string;
  model: string;
  finishReason: 'stop' | 'length' | 'function_call' | 'error';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  // Function Calling
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface LLMStreamChunk {
  content: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ============================================================================
// RAG Engine Types
// ============================================================================

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    documentId: string;
    tenantId: string;
    page?: number;
    chunkIndex: number;
  };
  embeddings: number[];
}

export interface RAGQuery {
  query: string;
  tenantId: string;
  topK?: number;
  filter?: Record<string, string | number>;
}

export interface RAGResult {
  results: Array<{
    chunk: DocumentChunk;
    score: number;
  }>;
  queryEmbeddings: number[];
}

// ============================================================================
// Function Calling Types
// ============================================================================

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      required?: string[];
    }>;
    required?: string[];
  };
}

export interface FunctionCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface FunctionResult {
  name: string;
  content: string;
  isError?: boolean;
}

// ============================================================================
// Token Metering Types
// ============================================================================

export interface TokenUsage {
  tenantId: string;
  provider: TokenProvider;
  model: AIModel;
  tokensUsed: number;
  usageType: 'chat' | 'voice' | 'rag' | 'training' | 'other';
  referenceId?: string;
}

export interface TokenQuota {
  tenantId: string;
  planId: string;
  quota: number;
  used: number;
  remaining: number;
  resetAt: Date;
}

// ============================================================================
// Voice Types (STT/TTS)
// ============================================================================

export interface STTRequest {
  audio: Buffer | string; // Buffer ou base64
  language?: string;
  model?: string;
}

export interface STTResponse {
  text: string;
  language: string;
  duration: number;
}

export interface TTSRequest {
  text: string;
  voice?: string;
  model?: string;
  speed?: number;
  pitch?: number;
  ssml?: boolean;
}

export interface TTSResponse {
  audio: Buffer;
  format: 'mp3' | 'wav' | 'ogg';
  duration: number;
}

// ============================================================================
// Schemas Zod
// ============================================================================

export const LLMRequestSchema = z.object({
  prompt: z.string(),
  systemPrompt: z.string().optional(),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant', 'function']),
    content: z.string(),
    name: z.string().optional(),
  })).optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  stop: z.array(z.string()).optional(),
  stream: z.boolean().optional(),
  tools: z.array(z.object({
    type: z.literal('function'),
    function: z.object({
      name: z.string(),
      description: z.string(),
      parameters: z.record(z.unknown()),
    }),
  })).optional(),
});

export const RAGQuerySchema = z.object({
  query: z.string(),
  tenantId: z.string(),
  topK: z.number().int().positive().default(5),
  filter: z.record(z.union([z.string(), z.number()])).optional(),
});

export const TokenUsageSchema = z.object({
  tenantId: z.string(),
  provider: z.enum(['openai', 'anthropic', 'elevenlabs', 'whisper', 'google', 'azure', 'ollama', 'openrouter']),
  model: z.enum(['gpt4', 'gpt4o', 'gpt35', 'claude3', 'claude2', 'elevenlabs_v2', 'whisper1']),
  tokensUsed: z.number().int().positive(),
  usageType: z.enum(['chat', 'voice', 'rag', 'training', 'other']),
  referenceId: z.string().optional(),
});

export type LLMRequestInput = z.infer<typeof LLMRequestSchema>;
export type RAGQueryInput = z.infer<typeof RAGQuerySchema>;
export type TokenUsageInput = z.infer<typeof TokenUsageSchema>;
