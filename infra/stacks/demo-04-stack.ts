import {
  type AppContext,
  BaseStack,
  resourceName,
  type StackConfig,
} from "@tomassabol/cdk-template"
import * as cdk from "aws-cdk-lib"
import * as appsync from "aws-cdk-lib/aws-appsync"
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as iam from "aws-cdk-lib/aws-iam"
import * as logs from "aws-cdk-lib/aws-logs"
import * as rds from "aws-cdk-lib/aws-rds"
import * as customResource from "aws-cdk-lib/custom-resources"

const DATABASE_NAME = "conference_demo"
const SUBMISSIONS_TABLE_NAME = "conference_submissions"

export class Demo04Stack extends BaseStack {
  constructor(appContext: AppContext, stackConfig: StackConfig) {
    super(appContext, stackConfig, {
      description: `Demo 04 - AppSync direct integration with Aurora Data API [${appContext.stageName}]`,
    })

    const availabilityZones = [
      cdk.Fn.select(0, cdk.Fn.getAzs()),
      cdk.Fn.select(1, cdk.Fn.getAzs()),
    ]

    const vpc = new ec2.CfnVPC(this, "demo-04-vpc", {
      cidrBlock: "10.4.0.0/16",
      enableDnsHostnames: true,
      enableDnsSupport: true,
    })

    const isolatedRouteTableAz1 = new ec2.CfnRouteTable(
      this,
      "demo-04-isolated-route-table-az1",
      {
        vpcId: vpc.ref,
      },
    )

    const isolatedRouteTableAz2 = new ec2.CfnRouteTable(
      this,
      "demo-04-isolated-route-table-az2",
      {
        vpcId: vpc.ref,
      },
    )

    const isolatedSubnetAz1 = new ec2.CfnSubnet(
      this,
      "demo-04-isolated-subnet-az1",
      {
        vpcId: vpc.ref,
        cidrBlock: "10.4.0.0/24",
        availabilityZone: availabilityZones[0],
        mapPublicIpOnLaunch: false,
      },
    )

    const isolatedSubnetAz2 = new ec2.CfnSubnet(
      this,
      "demo-04-isolated-subnet-az2",
      {
        vpcId: vpc.ref,
        cidrBlock: "10.4.1.0/24",
        availabilityZone: availabilityZones[1],
        mapPublicIpOnLaunch: false,
      },
    )

    new ec2.CfnSubnetRouteTableAssociation(
      this,
      "demo-04-isolated-subnet-association-az1",
      {
        subnetId: isolatedSubnetAz1.ref,
        routeTableId: isolatedRouteTableAz1.ref,
      },
    )

    new ec2.CfnSubnetRouteTableAssociation(
      this,
      "demo-04-isolated-subnet-association-az2",
      {
        subnetId: isolatedSubnetAz2.ref,
        routeTableId: isolatedRouteTableAz2.ref,
      },
    )

    const importedVpc = ec2.Vpc.fromVpcAttributes(
      this,
      "demo-04-imported-vpc",
      {
        vpcId: vpc.ref,
        availabilityZones,
        isolatedSubnetIds: [isolatedSubnetAz1.ref, isolatedSubnetAz2.ref],
        isolatedSubnetRouteTableIds: [
          isolatedRouteTableAz1.ref,
          isolatedRouteTableAz2.ref,
        ],
      },
    )

    const databaseCluster = new rds.DatabaseCluster(this, "demo-04-cluster", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      writer: rds.ClusterInstance.serverlessV2("writer"),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 1,
      defaultDatabaseName: DATABASE_NAME,
      credentials: rds.Credentials.fromGeneratedSecret("demo04app"),
      vpc: importedVpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      enableDataApi: true,
      deletionProtection: this.stageName === "prod",
      removalPolicy:
        this.stageName === "prod"
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
    })

    const databaseSecret = databaseCluster.secret

    if (!databaseSecret) {
      throw new Error("Demo 04 database secret was not created")
    }

    const schemaInitializerSql = `CREATE TABLE IF NOT EXISTS ${SUBMISSIONS_TABLE_NAME} (
id VARCHAR(64) PRIMARY KEY,
title VARCHAR(120) NOT NULL,
speaker VARCHAR(80) NOT NULL,
level VARCHAR(8) NOT NULL,
tags JSONB NOT NULL,
created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
)`

    const schemaInitializer = new customResource.AwsCustomResource(
      this,
      "demo-04-schema-initializer",
      {
        policy: customResource.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            actions: ["rds-data:ExecuteStatement"],
            resources: [databaseCluster.clusterArn],
          }),
          new iam.PolicyStatement({
            actions: ["secretsmanager:GetSecretValue"],
            resources: [databaseSecret.secretArn],
          }),
        ]),
        logRetention: logs.RetentionDays.ONE_DAY,
        installLatestAwsSdk: false,
        onCreate: {
          service: "RDSDataService",
          action: "executeStatement",
          parameters: {
            resourceArn: databaseCluster.clusterArn,
            secretArn: databaseSecret.secretArn,
            database: DATABASE_NAME,
            sql: schemaInitializerSql,
            continueAfterTimeout: true,
          },
          physicalResourceId:
            customResource.PhysicalResourceId.of("demo-04-schema-v1"),
        },
        onUpdate: {
          service: "RDSDataService",
          action: "executeStatement",
          parameters: {
            resourceArn: databaseCluster.clusterArn,
            secretArn: databaseSecret.secretArn,
            database: DATABASE_NAME,
            sql: schemaInitializerSql,
            continueAfterTimeout: true,
          },
          physicalResourceId:
            customResource.PhysicalResourceId.of("demo-04-schema-v1"),
        },
      },
    )

    schemaInitializer.node.addDependency(databaseCluster)

    const demoApi = new appsync.GraphqlApi(this, "demo-04-api", {
      name: resourceName(this, "demo-04", "api"),
      definition: appsync.Definition.fromFile(
        "src/appsync/demo-04/schema.graphql",
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
        },
      },
      xrayEnabled: true,
    })

    const rdsDataSource = demoApi.addRdsDataSourceV2(
      "submission-rds-data-source",
      databaseCluster,
      databaseSecret,
      DATABASE_NAME,
    )

    rdsDataSource.node.addDependency(schemaInitializer)

    rdsDataSource.createResolver("create-submission-direct-resolver", {
      typeName: "Mutation",
      fieldName: "createSubmissionDirect",
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(
        "src/appsync/demo-04/resolvers/create-submission-direct.js",
      ),
    })

    rdsDataSource.createResolver("list-submissions-resolver", {
      typeName: "Query",
      fieldName: "listSubmissions",
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(
        "src/appsync/demo-04/resolvers/list-submissions.js",
      ),
    })

    rdsDataSource.createResolver("get-submission-resolver", {
      typeName: "Query",
      fieldName: "getSubmission",
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(
        "src/appsync/demo-04/resolvers/get-submission.js",
      ),
    })

    new cdk.CfnOutput(this, "graphql-url", {
      value: demoApi.graphqlUrl,
    })

    new cdk.CfnOutput(this, "graphql-api-key", {
      value: demoApi.apiKey ?? "API key unavailable",
    })

    new cdk.CfnOutput(this, "appsync-data-source-name", {
      value: rdsDataSource.name,
    })

    new cdk.CfnOutput(this, "aurora-cluster-arn", {
      value: databaseCluster.clusterArn,
    })

    new cdk.CfnOutput(this, "aurora-secret-arn", {
      value: databaseSecret.secretArn,
    })

    new cdk.CfnOutput(this, "aurora-database-name", {
      value: DATABASE_NAME,
    })

    new cdk.CfnOutput(this, "aurora-cluster-identifier", {
      value: databaseCluster.clusterIdentifier,
    })

    new cdk.CfnOutput(this, "aurora-writer-endpoint", {
      value: databaseCluster.clusterEndpoint.hostname,
    })

    new cdk.CfnOutput(this, "aurora-reader-endpoint", {
      value: databaseCluster.clusterReadEndpoint.hostname,
    })

    new cdk.CfnOutput(this, "aurora-cluster-name", {
      value: resourceName(this, "demo-04", "cluster"),
    })
  }
}
