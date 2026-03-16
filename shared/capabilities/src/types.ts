export type CapabilityKind =
  | "live"
  | "reasoning"
  | "tts"
  | "image"
  | "image_edit"
  | "video"
  | "computer_use"
  | "research";

export type CapabilityProvider =
  | "vertex_ai"
  | "gemini_api"
  | "google_cloud"
  | "deepgram"
  | "fal"
  | "openai"
  | "anthropic"
  | "perplexity"
  | "deepseek"
  | "moonshot"
  | "fallback"
  | "simulated";

export type CapabilityMode = "default" | "fallback" | "simulated" | "disabled";

export type CapabilityDescriptor<TKind extends CapabilityKind = CapabilityKind> = {
  capability: TKind;
  adapterId: string;
  provider: CapabilityProvider;
  model: string;
  mode: CapabilityMode;
  selection?: {
    defaultProvider?: CapabilityProvider;
    defaultModel?: string;
    secondaryProvider?: CapabilityProvider | null;
    secondaryModel?: string | null;
    selectionReason?: string | null;
  };
};

export interface CapabilityAdapter<TKind extends CapabilityKind = CapabilityKind> {
  readonly descriptor: CapabilityDescriptor<TKind>;
}

export interface LiveCapabilityAdapter extends CapabilityAdapter<"live"> {}

export type ReasoningTextUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  raw?: Record<string, unknown>;
};

export type ReasoningTextResult = {
  text: string;
  usage?: ReasoningTextUsage;
};

export type ResearchCitation = {
  title: string;
  url: string;
  domain?: string | null;
  snippet?: string | null;
  publishedAt?: string | null;
  source?: string | null;
};

export type ResearchResult = {
  answer: string;
  citations: ResearchCitation[];
  sourceUrls: string[];
  usage?: ReasoningTextUsage;
  raw?: Record<string, unknown>;
};

export interface ReasoningCapabilityAdapter extends CapabilityAdapter<"reasoning"> {
  generateText(params: {
    model?: string;
    prompt: string;
    responseMimeType?: "application/json" | "text/plain";
    temperature?: number;
  }): Promise<ReasoningTextResult | null>;
}

export interface TtsCapabilityAdapter extends CapabilityAdapter<"tts"> {}

export interface ImageCapabilityAdapter extends CapabilityAdapter<"image"> {}

export interface ImageEditCapabilityAdapter extends CapabilityAdapter<"image_edit"> {}

export interface VideoCapabilityAdapter extends CapabilityAdapter<"video"> {}

export interface ComputerUseCapabilityAdapter extends CapabilityAdapter<"computer_use"> {}

export interface ResearchCapabilityAdapter extends CapabilityAdapter<"research"> {
  query(params: {
    query: string;
    contextPrompt?: string | null;
    maxCitations?: number;
  }): Promise<ResearchResult | null>;
}

export type CapabilityProfile = Partial<Record<CapabilityKind, CapabilityDescriptor>>;

export function buildCapabilityProfile(
  adapters: Array<CapabilityAdapter<CapabilityKind> | null | undefined>,
): CapabilityProfile {
  const profile: CapabilityProfile = {};
  for (const adapter of adapters) {
    if (!adapter) {
      continue;
    }
    profile[adapter.descriptor.capability] = adapter.descriptor;
  }
  return profile;
}
