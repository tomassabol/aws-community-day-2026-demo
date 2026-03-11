import { randomUUID } from "node:crypto"

import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb"
import { marshall } from "@aws-sdk/util-dynamodb"

import {
  type CreateTalkSubmissionInput,
  createTalkSubmissionInputSchema,
} from "../../shared/demo-02/talk-submission-contract"

type CreateSubmissionResolverEvent = {
  arguments: {
    input: CreateTalkSubmissionInput
  }
}

const dynamoDbClient = new DynamoDBClient({})

const tableName = process.env.TABLE_NAME

if (!tableName) {
  throw new Error("Missing TABLE_NAME environment variable")
}

export const handler = async (event: CreateSubmissionResolverEvent) => {
  const input = createTalkSubmissionInputSchema.parse(event.arguments.input)

  const submission = {
    id: randomUUID(),
    title: input.title,
    speaker: input.speaker,
    level: input.level,
    tags: input.tags,
    pathType: "lambda",
    createdAt: new Date().toISOString(),
  }

  await dynamoDbClient.send(
    new PutItemCommand({
      TableName: tableName,
      Item: marshall(submission),
    }),
  )

  return submission
}
