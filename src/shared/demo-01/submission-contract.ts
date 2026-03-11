import { z } from "zod"

export const SUBMISSION_LEVELS = ["100", "200", "300"] as const

export const submissionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "speaker", "level", "tags"],
  properties: {
    title: {
      type: "string",
      minLength: 3,
      maxLength: 120,
    },
    speaker: {
      type: "string",
      minLength: 2,
      maxLength: 80,
    },
    level: {
      type: "string",
      enum: [...SUBMISSION_LEVELS],
    },
    tags: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "string",
        minLength: 2,
        maxLength: 30,
      },
    },
  },
} as const

export const submissionSchema = z.object({
  title: z.string().min(3).max(120),
  speaker: z.string().min(2).max(80),
  level: z.enum(SUBMISSION_LEVELS),
  tags: z.array(z.string().min(2).max(30)).min(1).max(5),
})

export type Submission = z.infer<typeof submissionSchema>
