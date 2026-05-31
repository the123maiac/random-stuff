import { z } from 'zod'

export const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
})

export const chatRequestSchema = z.object({
  connectionId: z.uuid(),
  model: z.string().min(1),
  messages: z.array(chatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(32_000).optional(),
})

export type ChatRequestBody = z.infer<typeof chatRequestSchema>

/** Shape of each `data:` line the gateway streams back to the browser. */
export interface ChatStreamEvent {
  delta?: string
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
  error?: string
}
