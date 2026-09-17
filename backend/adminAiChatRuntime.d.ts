export function handleAdminAiChat(req: any, res: any): Promise<void>;
export function handleAdminAiTranscribe(req: any, res: any): Promise<void>;
export function handleAdminAiModels(req: any, res: any): void;
export function handleAdminAiHealth(req: any, res: any): void;
export const ALLOWED_MODELS: Record<string, any>;
export function runGeminiConversation(options: any): Promise<string>;
