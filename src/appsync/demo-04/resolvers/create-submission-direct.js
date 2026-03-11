import { util } from "@aws-appsync/utils"
import { createPgStatement, sql, toJsonObject } from "@aws-appsync/utils/rds"

export function request(ctx) {
  const submission = {
    id: util.autoId(),
    title: ctx.args.input.title,
    speaker: ctx.args.input.speaker,
    level: ctx.args.input.level,
    tags: ctx.args.input.tags,
  }

  return createPgStatement(sql`
    INSERT INTO conference_submissions (id, title, speaker, level, tags)
    VALUES (
      ${submission.id},
      ${submission.title},
      ${submission.speaker},
      ${submission.level},
      ${JSON.stringify(submission.tags)}::jsonb
    )
    RETURNING
      id,
      title,
      speaker,
      level,
      ARRAY(SELECT jsonb_array_elements_text(tags)) AS tags,
      'direct-rds' AS "pathType",
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"
  `)
}

export function response(ctx) {
  const { error, result } = ctx

  if (error) {
    return util.appendError(error.message, error.type, result)
  }

  return toJsonObject(result)[0][0]
}
