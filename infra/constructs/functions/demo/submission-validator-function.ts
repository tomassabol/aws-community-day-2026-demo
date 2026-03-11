import {
  BaseConstruct,
  type IBaseConstruct,
  NodeJsFunctionSimplePattern,
} from "@tomassabol/cdk-template"
import * as cdk from "aws-cdk-lib"
import type * as events from "aws-cdk-lib/aws-events"
import type * as lambda from "aws-cdk-lib/aws-lambda"

import { defaultNodeJsFunctionSimplePatternArgs } from "../../defaults/default-lambda-function-props"

export class SubmissionValidatorFunction extends BaseConstruct {
  public readonly function: lambda.Function

  constructor(
    scope: IBaseConstruct,
    id: string,
    props: {
      eventBus: events.IEventBus
    },
  ) {
    super(scope, id)

    const { lambdaFunction } = new NodeJsFunctionSimplePattern(
      ...defaultNodeJsFunctionSimplePatternArgs(this, id, {
        description: "Demo 01 submission validator",
        entry: "src/demo/submission-validator-function.ts",
        timeout: cdk.Duration.seconds(10),
        environment: {
          EVENT_BUS_NAME: props.eventBus.eventBusName,
        },
      }),
    )

    this.function = lambdaFunction

    props.eventBus.grantPutEventsTo(this.function)
  }
}
