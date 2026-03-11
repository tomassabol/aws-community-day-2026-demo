import { z } from "zod"

export const returnRequestJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "returnId",
    "orderId",
    "customerEmail",
    "customerLanguage",
    "reason",
    "claimedItemType",
    "photoBucket",
    "photoKey",
  ],
  properties: {
    returnId: {
      type: "string",
      minLength: 3,
      maxLength: 64,
    },
    orderId: {
      type: "string",
      minLength: 3,
      maxLength: 64,
    },
    customerEmail: {
      type: "string",
      format: "email",
      minLength: 5,
      maxLength: 254,
    },
    customerLanguage: {
      type: "string",
      minLength: 2,
      maxLength: 10,
      pattern: "^[a-z]{2}(-[A-Z]{2})?$",
    },
    reason: {
      type: "string",
      minLength: 10,
      maxLength: 500,
    },
    claimedItemType: {
      type: "string",
      minLength: 3,
      maxLength: 60,
    },
    photoBucket: {
      type: "string",
      minLength: 3,
      maxLength: 63,
    },
    photoKey: {
      type: "string",
      minLength: 3,
      maxLength: 1024,
    },
  },
} as const

export const returnRequestSchema = z.object({
  returnId: z.string().min(3).max(64),
  orderId: z.string().min(3).max(64),
  customerEmail: z.email().max(254),
  customerLanguage: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
  reason: z.string().min(10).max(500),
  claimedItemType: z.string().min(3).max(60),
  photoBucket: z.string().min(3).max(63),
  photoKey: z.string().min(3).max(1024),
})

export type ReturnRequest = z.infer<typeof returnRequestSchema>
