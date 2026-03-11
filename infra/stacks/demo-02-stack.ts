import {
  type AppContext,
  BaseStack,
  NodeJsFunctionSimplePattern,
  resourceName,
  type StackConfig,
} from "@tomassabol/cdk-template"
import * as cdk from "aws-cdk-lib"
import * as appsync from "aws-cdk-lib/aws-appsync"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"

import { defaultDynamoDbTableArgs } from "../constructs/defaults/default-dynamodb-table-props"
import { defaultNodeJsFunctionSimplePatternArgs } from "../constructs/defaults/default-lambda-function-props"

export class Demo02Stack extends BaseStack {
  constructor(appContext: AppContext, stackConfig: StackConfig) {
    super(appContext, stackConfig, {
      description: `Demo 02 - AppSync direct resolvers vs Lambda [${appContext.stageName}]`,
    })

    const submissionsTable = new dynamodb.Table(
      ...defaultDynamoDbTableArgs(this, "demo-02-submissions", {
        partitionKey: {
          name: "id",
          type: dynamodb.AttributeType.STRING,
        },
      }),
    )

    const demoApi = new appsync.GraphqlApi(this, "demo-02-api", {
      name: resourceName(this, "demo-02", "api"),
      definition: appsync.Definition.fromFile(
        "src/appsync/demo-02/schema.graphql",
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
        },
      },
      xrayEnabled: true,
    })

    const { lambdaFunction } = new NodeJsFunctionSimplePattern(
      ...defaultNodeJsFunctionSimplePatternArgs(this, "demo-02-lambda", {
        description: "Demo 02 AppSync Lambda resolver",
        entry: "src/functions/demo-02/create-submission-resolver.ts",
        environment: {
          TABLE_NAME: submissionsTable.tableName,
        },
      }),
    )

    submissionsTable.grantWriteData(lambdaFunction)

    const lambdaDataSource = demoApi.addLambdaDataSource(
      "lambda-resolver-data-source",
      lambdaFunction,
    )

    lambdaDataSource.createResolver("create-submission-with-lambda-resolver", {
      typeName: "Mutation",
      fieldName: "createSubmissionWithLambda",
    })

    const dynamoDbDataSource = demoApi.addDynamoDbDataSource(
      "submissions-table-data-source",
      submissionsTable,
    )

    dynamoDbDataSource.createResolver("create-submission-direct-resolver", {
      typeName: "Mutation",
      fieldName: "createSubmissionDirect",
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(
        "src/appsync/demo-02/resolvers/create-submission-direct.js",
      ),
    })

    dynamoDbDataSource.createResolver("list-submissions-resolver", {
      typeName: "Query",
      fieldName: "listSubmissions",
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(
        "src/appsync/demo-02/resolvers/list-submissions.js",
      ),
    })

    new cdk.CfnOutput(this, "graphql-url", {
      value: demoApi.graphqlUrl,
    })

    new cdk.CfnOutput(this, "graphql-api-key", {
      value: demoApi.apiKey ?? "API key unavailable",
    })

    new cdk.CfnOutput(this, "submissions-table-name", {
      value: submissionsTable.tableName,
    })
  }
}
