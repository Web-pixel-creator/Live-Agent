export type CapabilityKind = "live" | "reasoning" | "tts" | "image" | "video" | "computer_use";

export type CapabilityProvider =
  | "vertex_ai"
  | "gemini_api"
  | "google_cloud"
  | "fallback"
  | "simulated";

export type CapabilityMode = "default" | "fallback" | "simulated" | "disabled";

export type CapabilityDescriptor<TKind extends CapabilityKind = CapabilityKind> = {
  capability: TKind;
  adapterId: string;
  provider: CapabilityProvider;
  model: string;
  mode: CapabilityMode;
};

export interface CapabilityAdapter<TKind extends CapabilityKind = CapabilityKind> {
  readonly descriptor: CapabilityDescriptor<TKind>;
}

export interface LiveCapabilityAdapter extends CapabilityAdapter<"live"> {}

export interface ReasoningCapabilityAdapter extends CapabilityAdapter<"reasoning"> {
  generateText(params: {
    model?: string;
    prompt: string;
    responseMimeType?: "application/json" | "text/plain";
    temperature?: number;
  }): Promise<string | null>;
}

export interface TtsCapabilityAdapter extends CapabilityAdapter<"tts"> {}

export interface ImageCapabilityAdapter extends CapabilityAdapter<"image"> {}

export interface VideoCapabilityAdapter extends CapabilityAdapter<"video"> {}

export interface ComputerUseCapabilityAdapter extends CapabilityAdapter<"computer_use"> {}

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
