import { util } from "@aws-appsync/utils"

export function request(ctx) {
  const submission = {
    id: util.autoId(),
    title: ctx.args.input.title,
    speaker: ctx.args.input.speaker,
    level: ctx.args.input.level,
    tags: ctx.args.input.tags,
    pathType: "direct",
    createdAt: util.time.nowISO8601(),
  }

  ctx.stash.submission = submission

  return {
    operation: "PutItem",
    key: util.dynamodb.toMapValues({ id: submission.id }),
    attributeValues: util.dynamodb.toMapValues({
      title: submission.title,
      speaker: submission.speaker,
      level: submission.level,
      tags: submission.tags,
      pathType: submission.pathType,
      createdAt: submission.createdAt,
    }),
  }
}

export function response(ctx) {
  return ctx.stash.submission
}
