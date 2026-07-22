// StayOS Training Types
// Tipos para o Motor de Tours Guiados (Módulo 21)

import { z } from 'zod';
import { UserRole, TourHierarchyLevel, TourStatus, TrainingProgressStatus } from '@prisma/client';

// ============================================================================
// Tour Types
// ============================================================================

export interface TourStep {
  selector: string; // CSS selector do elemento
  text: string; // Texto explicativo
  position: 'top' | 'bottom' | 'left' | 'right' | 'auto'; // Posição do tooltip
  requiresAction?: boolean; // Requer ação do usuário para avançar
  actionSelector?: string; // Seletor do elemento que deve ser clicado
  actionType?: 'click' | 'input' | 'submit' | 'custom'; // Tipo de ação esperada
  waitForAction?: boolean; // Esperar ação antes de avançar
  highlightElement?: boolean; // Destacar elemento com spotlight
  spotlightPadding?: number; // Padding do spotlight em pixels
  tooltipWidth?: number | string; // Largura do tooltip
  nextButtonText?: string; // Texto do botão "Próximo"
  prevButtonText?: string; // Texto do botão "Anterior"
  skipButtonText?: string; // Texto do botão "Pular"
  doneButtonText?: string; // Texto do botão "Concluir"
}

export interface GuidedTourConfig {
  id: string;
  moduleId: string;
  submoduleId?: string | null;
  functionId?: string | null;
  hierarchyLevel: TourHierarchyLevel;
  targetRole: UserRole[];
  title: string;
  description?: string;
  steps: TourStep[];
  status: TourStatus;
  version: number;
  metadata?: Record<string, unknown>;
}

export interface TourProgress {
  id: string;
  userId: string;
  tourId: string;
  currentStep: number;
  totalSteps: number;
  status: TrainingProgressStatus;
  startedAt?: Date;
  completedAt?: Date;
  abandonedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface TourCoverage {
  moduleId: string;
  coverage: {
    welcome: boolean;
    module: boolean;
    submodule: boolean;
    function: boolean;
    microhelp: boolean;
  };
  status: 'complete' | 'partial' | 'absent';
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Training Engine Types
// ============================================================================

export interface TourEngineConfig {
  // Comportamento
  autoStart: boolean; // Iniciar tour automaticamente na primeira visita
  showProgress: boolean; // Mostrar barra de progresso
  showStepCounter: boolean; // Mostrar contador de passos (ex: "Passo 3 de 7")
  showNavigation: boolean; // Mostrar botões de navegação
  allowSkip: boolean; // Permitir pular o tour
  allowExit: boolean; // Permitir sair do tour
  
  // Estilo
  backdropColor: string; // Cor do backdrop (ex: 'rgba(0, 0, 0, 0.5)')
  spotlightColor: string; // Cor do spotlight (ex: 'rgba(0, 0, 0, 0.3)')
  tooltipBackground: string; // Cor de fundo do tooltip
  tooltipText: string; // Cor do texto do tooltip
  tooltipBorderRadius: string; // Border radius do tooltip
  
  // Animações
  animationEnabled: boolean;
  animationDuration: number; // em ms
}

export interface TourState {
  isActive: boolean;
  currentTour: GuidedTourConfig | null;
  currentStep: number;
  totalSteps: number;
  isFirstVisit: boolean;
  hasCompleted: boolean;
}

// ============================================================================
// Context Types
// ============================================================================

export interface TrainingContextType {
  // Estado
  tours: GuidedTourConfig[];
  currentTour: GuidedTourConfig | null;
  currentStep: number;
  isTourActive: boolean;
  
  // Funções
  startTour: (tourId: string) => Promise<void>;
  nextStep: () => Promise<void>;
  prevStep: () => Promise<void>;
  skipTour: () => Promise<void>;
  completeTour: () => Promise<void>;
  exitTour: () => Promise<void>;
  
  // Progresso
  markStepAsCompleted: (tourId: string, stepIndex: number) => Promise<void>;
  getTourProgress: (tourId: string) => Promise<TourProgress | null>;
  
  // Cobertura
  getCoverage: (moduleId: string) => Promise<TourCoverage | null>;
  getAllCoverage: () => Promise<TourCoverage[]>;
}

// ============================================================================
// Component Props
// ============================================================================

export interface SpotlightProps {
  isActive: boolean;
  targetElement: HTMLElement | null;
  padding?: number;
  color?: string;
  borderRadius?: string;
  zIndex?: number;
}

export interface TooltipProps {
  isActive: boolean;
  text: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  targetElement: HTMLElement | null;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onDone: () => void;
  nextButtonText?: string;
  prevButtonText?: string;
  skipButtonText?: string;
  doneButtonText?: string;
  showProgress?: boolean;
  showNavigation?: boolean;
  allowSkip?: boolean;
}

export interface GuidedTourProps {
  tour: GuidedTourConfig;
  isActive: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onExit: () => void;
  config?: Partial<TourEngineConfig>;
}

export interface TourProviderProps {
  children: React.ReactNode;
  userId: string;
  userRole: UserRole;
  tenantId?: string;
  config?: Partial<TourEngineConfig>;
}

// ============================================================================
// Hook Types
// ============================================================================

export interface UseTourOptions {
  tourId: string;
  autoStart?: boolean;
}

export interface UseTourReturn {
  tour: GuidedTourConfig | null;
  currentStep: number;
  totalSteps: number;
  isActive: boolean;
  isFirstStep: boolean;
  isLastStep: boolean;
  hasCompleted: boolean;
  
  start: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  skip: () => Promise<void>;
  complete: () => Promise<void>;
  exit: () => Promise<void>;
}

export interface UseTrainingProgressOptions {
  userId: string;
}

export interface UseTrainingProgressReturn {
  progress: TourProgress[];
  coverage: TourCoverage[];
  completedCount: number;
  totalCount: number;
  completionPercentage: number;
  
  getProgress: (tourId: string) => TourProgress | null;
  getCoverage: (moduleId: string) => TourCoverage | null;
  markAsCompleted: (tourId: string) => Promise<void>;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface FirstVisitFlag {
  userId: string;
  moduleId: string;
  submoduleId?: string;
  functionId?: string;
  hasVisited: boolean;
  lastVisitedAt?: Date;
}

export interface TrainingMetrics {
  tourId: string;
  completionRate: number;
  abandonmentRate: number;
  averageCompletionTime: number; // em ms
  mostAbandonedStep: number | null;
  userCount: number;
}

// ============================================================================
// Schemas Zod
// ============================================================================

export const TourStepSchema = z.object({
  selector: z.string(),
  text: z.string(),
  position: z.enum(['top', 'bottom', 'left', 'right', 'auto']),
  requiresAction: z.boolean().optional().default(false),
  actionSelector: z.string().optional(),
  actionType: z.enum(['click', 'input', 'submit', 'custom']).optional(),
  waitForAction: z.boolean().optional().default(false),
  highlightElement: z.boolean().optional().default(true),
  spotlightPadding: z.number().int().positive().optional().default(10),
  tooltipWidth: z.union([z.number().int().positive(), z.string()]).optional(),
  nextButtonText: z.string().optional().default('Próximo'),
  prevButtonText: z.string().optional().default('Anterior'),
  skipButtonText: z.string().optional().default('Pular'),
  doneButtonText: z.string().optional().default('Concluir'),
});

export const GuidedTourConfigSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  submoduleId: z.string().nullable().optional(),
  functionId: z.string().nullable().optional(),
  hierarchyLevel: z.nativeEnum(TourHierarchyLevel),
  targetRole: z.array(z.nativeEnum(UserRole)),
  title: z.string(),
  description: z.string().optional(),
  steps: z.array(TourStepSchema),
  status: z.nativeEnum(TourStatus),
  version: z.number().int().positive(),
  metadata: z.record(z.unknown()).optional(),
});

export const TourEngineConfigSchema = z.object({
  autoStart: z.boolean().optional().default(true),
  showProgress: z.boolean().optional().default(true),
  showStepCounter: z.boolean().optional().default(true),
  showNavigation: z.boolean().optional().default(true),
  allowSkip: z.boolean().optional().default(true),
  allowExit: z.boolean().optional().default(true),
  backdropColor: z.string().optional().default('rgba(0, 0, 0, 0.5)'),
  spotlightColor: z.string().optional().default('rgba(0, 0, 0, 0.3)'),
  tooltipBackground: z.string().optional().default('#ffffff'),
  tooltipText: z.string().optional().default('#374151'),
  tooltipBorderRadius: z.string().optional().default('0.5rem'),
  animationEnabled: z.boolean().optional().default(true),
  animationDuration: z.number().int().positive().optional().default(300),
});

export type TourStepInput = z.infer<typeof TourStepSchema>;
export type GuidedTourConfigInput = z.infer<typeof GuidedTourConfigSchema>;
export type TourEngineConfigInput = z.infer<typeof TourEngineConfigSchema>;
