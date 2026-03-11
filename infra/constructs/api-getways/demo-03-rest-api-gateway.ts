import {
  BaseConstruct,
  type IBaseConstruct,
  resourceName,
} from "@tomassabol/cdk-template"
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import * as iam from "aws-cdk-lib/aws-iam"
import type * as sfn from "aws-cdk-lib/aws-stepfunctions"

import { returnRequestJsonSchema } from "../../../src/shared/demo-03/return-contract"
import { DEFAULT_API_GATEWAY_PROPS } from "../defaults/default-api-gateway-props"

const buildStartExecutionRequestTemplate = (stateMachineArn: string) => `{
  "stateMachineArn": "${stateMachineArn}",
  "name": "$context.requestId",
  "input": "$util.escapeJavaScript($input.json('$'))"
}`

const buildStartExecutionResponseTemplate = () => `{
  "message": "Return accepted for processing",
  "pathType": "direct",
  "executionArn": "$input.path('$.executionArn')",
  "startDate": "$input.path('$.startDate')"
}`

export class Demo03RestApiGateway extends BaseConstruct {
  public readonly api: apigateway.RestApi

  constructor(
    scope: IBaseConstruct,
    id: string,
    props: {
      stateMachine: sfn.IStateMachine
    },
  ) {
    super(scope, id)

    const startExecutionRequestTemplate = buildStartExecutionRequestTemplate(
      props.stateMachine.stateMachineArn,
    )
    const startExecutionResponseTemplate = buildStartExecutionResponseTemplate()

    this.api = new apigateway.RestApi(this, id, {
      ...DEFAULT_API_GATEWAY_PROPS,
      restApiName: resourceName(this, "demo-03", "api"),
      description: "Demo 03 REST API for Step Functions direct integrations",
    })

    const returns = this.api.root.addResource("returns")
    const directResource = returns.addResource("direct")

    const requestModel = new apigateway.Model(this, "return-request-model", {
      restApi: this.api,
      contentType: "application/json",
      schema: returnRequestJsonSchema as unknown as apigateway.JsonSchema,
    })

    const requestValidator = new apigateway.RequestValidator(
      this,
      "return-request-validator",
      {
        restApi: this.api,
        validateRequestBody: true,
      },
    )

    const integrationRole = new iam.Role(
      this,
      "step-functions-integration-role",
      {
        assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      },
    )

    props.stateMachine.grantStartExecution(integrationRole)

    const directIntegration = new apigateway.AwsIntegration({
      service: "states",
      action: "StartExecution",
      integrationHttpMethod: "POST",
      options: {
        credentialsRole: integrationRole,
        passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
        requestParameters: {
          "integration.request.header.X-Amz-Target":
            "'AWSStepFunctions.StartExecution'",
          "integration.request.header.Content-Type":
            "'application/x-amz-json-1.0'",
        },
        requestTemplates: {
          "application/json": startExecutionRequestTemplate,
        },
        integrationResponses: [
          {
            statusCode: "202",
            responseTemplates: {
              "application/json": startExecutionResponseTemplate,
            },
          },
        ],
      },
    })

    directResource.addMethod("POST", directIntegration, {
      apiKeyRequired: false,
      requestModels: {
        "application/json": requestModel,
      },
      requestValidator,
      methodResponses: [
        {
          statusCode: "202",
        },
      ],
    })

    // Force a fresh deployment when the direct integration templates change.
    this.api.latestDeployment?.addToLogicalId({
      startExecutionRequestTemplate,
      startExecutionResponseTemplate,
      stateMachineArn: props.stateMachine.stateMachineArn,
    })
  }
}
