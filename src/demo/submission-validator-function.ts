import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge"
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda"
import { ZodError } from "zod"

import {
  type Submission,
  submissionSchema,
} from "../shared/demo-01/submission-contract"

const eventBridgeClient = new EventBridgeClient()

const eventBusName = process.env.EVENT_BUS_NAME

if (!eventBusName) {
  throw new Error("Missing EVENT_BUS_NAME environment variable")
}

const buildResponse = (
  statusCode: number,
  body: Record<string, unknown>,
): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: {
    "content-type": "application/json",
  },
  body: JSON.stringify(body),
})

const publishSubmissionCreatedEvent = async (submission: Submission) => {
  await eventBridgeClient.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: eventBusName,
          Source: "demo.api",
          DetailType: "submission.created",
          Detail: JSON.stringify({
            pathType: "lambda",
            ...submission,
          }),
        },
      ],
    }),
  )
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const body = event.body ? JSON.parse(event.body) : {}
    const submission = submissionSchema.parse(body)

    await publishSubmissionCreatedEvent(submission)

    return buildResponse(200, {
      message: "Submission accepted",
      pathType: "lambda",
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return buildResponse(400, {
        message: "Request body must be valid JSON",
      })
    }

    if (error instanceof ZodError) {
      return buildResponse(400, {
        message: "Request body failed Zod validation",
        issues: error.issues,
      })
    }

    return buildResponse(500, {
      message: "Internal server error",
    })
  }
}
