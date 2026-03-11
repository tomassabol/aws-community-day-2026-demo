import { util } from "@aws-appsync/utils"
import { createPgStatement, sql, toJsonObject } from "@aws-appsync/utils/rds"

export function request() {
  return createPgStatement(sql`
    SELECT
      id,
      title,
      speaker,
      level,
      ARRAY(SELECT jsonb_array_elements_text(tags)) AS tags,
      'direct-rds' AS "pathType",
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"
    FROM conference_submissions
    ORDER BY created_at DESC
    LIMIT 20
  `)
}

export function response(ctx) {
  const { error, result } = ctx

  if (error) {
    return util.appendError(error.message, error.type, result)
  }

  return toJsonObject(result)[0]
}
