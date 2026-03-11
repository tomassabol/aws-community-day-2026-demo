import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge"
import {
  type APIGatewayProxyEventV2,
  type APIGatewayProxyStructuredResultV2,
} from "aws-lambda"
import * as z from "zod"

import { submissionSchema } from "~/shared/demo-01/submission-contract"

const eventBridgeClient = new EventBridgeClient()

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const body = submissionSchema.safeParse(event.body)

    if (!body.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid request body" }),
      }
    }

    const command = new PutEventsCommand({
      Entries: [
        {
          EventBusName: process.env.EVENT_BUS_NAME,
          Source: "demo.api",
          DetailType: "submission.created",
          Detail: JSON.stringify(body.data),
        },
      ],
    })

    await eventBridgeClient.send(command)

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Submission created" }),
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    }
  }
}
