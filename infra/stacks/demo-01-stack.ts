import {
  type AppContext,
  BaseStack,
  resourceName,
  type StackConfig,
} from "@tomassabol/cdk-template"
import * as cdk from "aws-cdk-lib"
import * as events from "aws-cdk-lib/aws-events"
import * as targets from "aws-cdk-lib/aws-events-targets"
import * as sqs from "aws-cdk-lib/aws-sqs"

import { DemoRestApiGateway } from "../constructs/api-getways/demo-rest-api-gateway"
import { SubmissionValidatorFunction } from "../constructs/functions/demo/submission-validator-function"

export class Demo01Stack extends BaseStack {
  constructor(appContext: AppContext, stackConfig: StackConfig) {
    super(appContext, stackConfig, {
      description: `Demo 01 - Lambda vs direct integration [${appContext.stageName}]`,
    })

    const eventBus = new events.EventBus(this, "demo-event-bus")

    const observationQueue = new sqs.Queue(this, "observation-queue", {
      queueName: resourceName(this, "demo-01-observation", "queue"),
    })

    new events.Rule(this, "all-demo-submissions-rule", {
      eventBus,
      eventPattern: {
        source: ["demo.api"],
        detailType: ["submission.created"],
      },
      targets: [new targets.SqsQueue(observationQueue)],
    })

    const { function: submissionValidatorFunction } =
      new SubmissionValidatorFunction(this, "submission-validator-function", {
        eventBus,
      })

    const demoApi = new DemoRestApiGateway(this, "demo-rest-api-gateway", {
      eventBus,
      submissionValidatorFunction,
    })

    new cdk.CfnOutput(this, "demo-api-url", {
      value: demoApi.api.url,
    })

    new cdk.CfnOutput(this, "lambda-submissions-endpoint", {
      value: `${demoApi.api.url}submissions/lambda`,
    })

    new cdk.CfnOutput(this, "direct-submissions-endpoint", {
      value: `${demoApi.api.url}submissions/direct`,
    })

    new cdk.CfnOutput(this, "demo-event-bus-name", {
      value: eventBus.eventBusName,
    })

    new cdk.CfnOutput(this, "observation-queue-url", {
      value: observationQueue.queueUrl,
    })
  }
}
