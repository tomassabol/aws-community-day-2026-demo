import { z } from "zod"

export const TALK_LEVELS = ["100", "200", "300"] as const

export const createTalkSubmissionInputSchema = z.object({
  title: z.string().min(3).max(120),
  speaker: z.string().min(2).max(80),
  level: z.enum(TALK_LEVELS),
  tags: z.array(z.string().min(2).max(30)).min(1).max(5),
})

export type CreateTalkSubmissionInput = z.infer<
  typeof createTalkSubmissionInputSchema
>
