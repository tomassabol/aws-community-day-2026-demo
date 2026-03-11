import { BaseConstruct, type IBaseConstruct } from "@tomassabol/cdk-template"
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import type * as events from "aws-cdk-lib/aws-events"
import * as iam from "aws-cdk-lib/aws-iam"
import type * as lambda from "aws-cdk-lib/aws-lambda"

import { submissionJsonSchema } from "../../../src/shared/demo-01/submission-contract"
import { DEFAULT_API_GATEWAY_PROPS } from "../defaults/default-api-gateway-props"

const buildDirectIntegrationRequestTemplate = (
  eventBusName: string,
) => `#set($inputRoot = $input.path('$'))
{
  "Entries": [
    {
      "Source": "demo.api",
      "DetailType": "submission.created",
      "EventBusName": "${eventBusName}",
      "Detail": "{ \\"pathType\\": \\"direct\\", \\"title\\": \\"$util.escapeJavaScript($inputRoot.title)\\", \\"speaker\\": \\"$util.escapeJavaScript($inputRoot.speaker)\\", \\"level\\": \\"$util.escapeJavaScript($inputRoot.level)\\", \\"tags\\": [#foreach($tag in $inputRoot.tags)\\"$util.escapeJavaScript($tag)\\"#if($foreach.hasNext),#end#end] }"
    }
  ]
}`

export class DemoRestApiGateway extends BaseConstruct {
  public readonly api: apigateway.RestApi

  constructor(
    scope: IBaseConstruct,
    id: string,
    props: {
      eventBus: events.IEventBus
      submissionValidatorFunction: lambda.IFunction
    },
  ) {
    super(scope, id)

    this.api = new apigateway.RestApi(this, id, {
      ...DEFAULT_API_GATEWAY_PROPS,
      restApiName: this.createResourceName("demo-01", "api"),
      description: "Demo 01 REST API for Lambda vs direct integrations",
    })

    const submissions = this.api.root.addResource("submissions")
    const lambdaResource = submissions.addResource("lambda")
    const directResource = submissions.addResource("direct")

    lambdaResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(props.submissionValidatorFunction),
      {
        apiKeyRequired: false,
      },
    )

    const submissionModel = new apigateway.Model(this, "submission-model", {
      restApi: this.api,
      contentType: "application/json",
      schema: submissionJsonSchema as unknown as apigateway.JsonSchema,
    })

    const requestValidator = new apigateway.RequestValidator(
      this,
      "submission-request-validator",
      {
        restApi: this.api,
        validateRequestBody: true,
      },
    )

    const integrationRole = new iam.Role(this, "eventbridge-integration-role", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
    })

    integrationRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["events:PutEvents"],
        resources: [props.eventBus.eventBusArn],
      }),
    )

    const directIntegration = new apigateway.AwsIntegration({
      service: "events",
      action: "PutEvents",
      integrationHttpMethod: "POST",
      options: {
        credentialsRole: integrationRole,
        passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
        requestParameters: {
          "integration.request.header.X-Amz-Target": "'AWSEvents.PutEvents'",
          "integration.request.header.Content-Type":
            "'application/x-amz-json-1.1'",
        },
        requestTemplates: {
          "application/json": buildDirectIntegrationRequestTemplate(
            props.eventBus.eventBusName,
          ),
        },
        integrationResponses: [
          {
            statusCode: "200",
            responseTemplates: {
              "application/json": JSON.stringify({
                message: "Submission accepted",
                pathType: "direct",
              }),
            },
          },
        ],
      },
    })

    directResource.addMethod("POST", directIntegration, {
      apiKeyRequired: false,
      requestModels: {
        "application/json": submissionModel,
      },
      requestValidator,
      methodResponses: [
        {
          statusCode: "200",
        },
      ],
    })
  }
}
