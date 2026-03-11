import {
  type AppContext,
  BaseStack,
  resourceName,
  type StackConfig,
} from "@tomassabol/cdk-template"
import * as cdk from "aws-cdk-lib"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import * as iam from "aws-cdk-lib/aws-iam"
import * as sns from "aws-cdk-lib/aws-sns"
import * as sfn from "aws-cdk-lib/aws-stepfunctions"
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks"

import { Demo03RestApiGateway } from "../constructs/api-getways/demo-03-rest-api-gateway"
import { defaultDynamoDbTableArgs } from "../constructs/defaults/default-dynamodb-table-props"

export class Demo03Stack extends BaseStack {
  constructor(appContext: AppContext, stackConfig: StackConfig) {
    super(appContext, stackConfig, {
      description: `Demo 03 - Return processing with Step Functions direct integrations [${appContext.stageName}]`,
    })

    const returnsTable = new dynamodb.Table(
      ...defaultDynamoDbTableArgs(this, "demo-03-returns", {
        partitionKey: {
          name: "returnId",
          type: dynamodb.AttributeType.STRING,
        },
      }),
    )

    const ordersTable = new dynamodb.Table(
      ...defaultDynamoDbTableArgs(this, "demo-03-orders", {
        partitionKey: {
          name: "orderId",
          type: dynamodb.AttributeType.STRING,
        },
      }),
    )

    const returnUpdatesTopic = new sns.Topic(this, "return-updates-topic", {
      topicName: resourceName(this, "demo-03-return-updates", "topic"),
    })

    const initializeReturnRequest = sfn.Pass.jsonata(
      this,
      "initialize-return-request",
      {
        outputs:
          "{% $merge([$states.input, {'createdAt': $now(), 'updatedAt': $now(), 'executionArn': $states.context.Execution.Id}]) %}",
      },
    )

    const persistReceivedReturn = tasks.DynamoPutItem.jsonPath(
      this,
      "persist-received-return",
      {
        table: returnsTable,
        item: {
          returnId: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.returnId"),
          ),
          orderId: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.orderId"),
          ),
          customerEmail: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.customerEmail"),
          ),
          customerLanguage: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.customerLanguage"),
          ),
          reason: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.reason"),
          ),
          claimedItemType: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.claimedItemType"),
          ),
          photoBucket: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.photoBucket"),
          ),
          photoKey: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.photoKey"),
          ),
          status: tasks.DynamoAttributeValue.fromString("RECEIVED"),
          decision: tasks.DynamoAttributeValue.fromString("PENDING_REVIEW"),
          executionArn: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.executionArn"),
          ),
          createdAt: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.createdAt"),
          ),
          updatedAt: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.updatedAt"),
          ),
          statusHistory: tasks.DynamoAttributeValue.fromList([
            tasks.DynamoAttributeValue.fromString("RECEIVED"),
          ]),
        },
        resultPath: sfn.JsonPath.DISCARD,
      },
    )

    const loadOrder = tasks.DynamoGetItem.jsonPath(this, "load-order", {
      table: ordersTable,
      key: {
        orderId: tasks.DynamoAttributeValue.fromString(
          sfn.JsonPath.stringAt("$.orderId"),
        ),
      },
      resultPath: "$.orderLookup",
    })

    const setIneligibleReturn = sfn.Pass.jsonata(
      this,
      "set-ineligible-return",
      {
        outputs: {
          returnId: "{% $states.input.returnId %}",
          orderId: "{% $states.input.orderId %}",
          customerEmail: "{% $states.input.customerEmail %}",
          customerLanguage: "{% $states.input.customerLanguage %}",
          reason: "{% $states.input.reason %}",
          claimedItemType: "{% $states.input.claimedItemType %}",
          photoBucket: "{% $states.input.photoBucket %}",
          photoKey: "{% $states.input.photoKey %}",
          createdAt: "{% $states.input.createdAt %}",
          updatedAt: "{% $now() %}",
          executionArn: "{% $states.input.executionArn %}",
          order: "{% {'orderStatus': 'NOT_ELIGIBLE'} %}",
          decisionModel:
            "{% {'fraudScore': 100, 'detectedLabels': [], 'damageSignals': [], 'missingPackaging': false, 'claimMatchesOrderedItem': false, 'claimMatchesDetectedImage': false} %}",
          fraudSignals:
            "{% {'orderNotEligible': true, 'claimMismatch': true, 'missingPackaging': false} %}",
          bedrockRecommendationText:
            "{% 'REJECT\\nREASON: The order is not eligible for return or the return window has closed.' %}",
          status: "{% 'REJECTED' %}",
          decision: "{% 'REJECT' %}",
          decisionReason:
            "{% 'The order is not return-eligible or the return window has expired.' %}",
          notificationMessage:
            "{% 'Return ' & $states.input.returnId & ' was rejected because the order is outside the allowed return policy.' %}",
          statusHistory: "{% ['RECEIVED', 'ELIGIBILITY_REJECTED'] %}",
        },
      },
    )

    const prepareEligibleReturn = sfn.Pass.jsonata(
      this,
      "prepare-eligible-return",
      {
        outputs:
          "{% $merge([$states.input, {'order': {'productType': $states.input.orderLookup.Item.productType.S, 'returnEligible': $states.input.orderLookup.Item.returnEligible.BOOL, 'returnWindowEndsAt': $states.input.orderLookup.Item.returnWindowEndsAt.S, 'warehouseTeam': $states.input.orderLookup.Item.warehouseTeam.S, 'orderStatus': $states.input.orderLookup.Item.orderStatus.S}}]) %}",
      },
    )

    const detectReturnPhotoLabels = tasks.CallAwsService.jsonPath(
      this,
      "detect-return-photo-labels",
      {
        service: "rekognition",
        action: "detectLabels",
        iamResources: ["*"],
        additionalIamStatements: [
          new iam.PolicyStatement({
            actions: ["s3:GetObject"],
            resources: ["arn:aws:s3:::*/*"],
          }),
        ],
        parameters: {
          Image: {
            S3Object: {
              Bucket: sfn.JsonPath.stringAt("$.photoBucket"),
              Name: sfn.JsonPath.stringAt("$.photoKey"),
            },
          },
          MaxLabels: 12,
          MinConfidence: 75,
        },
        resultPath: "$.rekognitionResult",
      },
    )

    const buildDecisionModel = sfn.Pass.jsonata(this, "build-decision-model", {
      outputs:
        "{% ($labelNames := $map($states.input.rekognitionResult.Labels, function($label) { $lowercase($label.Name) }); $damageSignals := $filter($labelNames, function($label) { $label = 'damage' or $label = 'broken' or $label = 'crack' or $label = 'scratch' or $label = 'tear' }); $normalizedDamageSignals := $exists($damageSignals) ? $damageSignals : []; $packagingLabels := $filter($labelNames, function($label) { $label = 'box' or $label = 'package' or $label = 'carton' or $label = 'packaging' }); $claim := $lowercase($states.input.claimedItemType); $ordered := $lowercase($states.input.order.productType); $claimMatchesImage := $count($filter($labelNames, function($label) { $contains($label, $claim) or $contains($claim, $label) })) > 0; $claimMatchesOrdered := $contains($ordered, $claim) or $contains($claim, $ordered); $missingPackaging := $count($packagingLabels) = 0; $fraudScore := ($claimMatchesOrdered ? 0 : 40) + ($claimMatchesImage ? 0 : 45) + ($missingPackaging ? 10 : 0); $merge([$states.input, {'decisionModel': {'orderedItemType': $states.input.order.productType, 'claimedItemType': $states.input.claimedItemType, 'detectedLabels': $labelNames, 'damageSignals': $normalizedDamageSignals, 'missingPackaging': $missingPackaging, 'claimMatchesOrderedItem': $claimMatchesOrdered, 'claimMatchesDetectedImage': $claimMatchesImage, 'fraudScore': $fraudScore}, 'fraudSignals': {'orderNotEligible': false, 'claimMismatch': $not($claimMatchesImage), 'missingPackaging': $missingPackaging}}]) ) %}",
    })

    const buildBedrockInput = sfn.Pass.jsonata(this, "build-bedrock-input", {
      outputs:
        "{% $merge([$states.input, {'bedrockInput': {'schemaVersion': 'messages-v1', 'system': [{'text': 'You are reviewing ecommerce returns for fraud risk. Reply with exactly two lines. Line 1 must be one of AUTO_APPROVE, MANUAL_REVIEW, or REJECT. Line 2 must start with REASON: and a short explanation.'}], 'messages': [{'role': 'user', 'content': [{'text': 'Decision model: ' & $string($states.input.decisionModel)}]}], 'inferenceConfig': {'maxTokens': 120, 'temperature': 0.1, 'topP': 0.9}}}]) %}",
    })

    const invokeFraudRecommender = new sfn.CustomState(
      this,
      "invoke-fraud-recommender",
      {
        stateJson: {
          Type: "Task",
          Resource: "arn:aws:states:::bedrock:invokeModel",
          Parameters: {
            ModelId:
              "arn:aws:bedrock:eu-central-1:849368888067:inference-profile/eu.amazon.nova-micro-v1:0",
            "Body.$": "$.bedrockInput",
            ContentType: "application/json",
            Accept: "application/json",
          },
          ResultPath: "$.bedrockResult",
        },
      },
    )

    const normalizeBedrockRecommendation = sfn.Pass.jsonata(
      this,
      "normalize-bedrock-recommendation",
      {
        outputs:
          "{% $merge([$states.input, {'bedrockRecommendationText': $states.input.bedrockResult.Body.output.message.content[0].text}]) %}",
      },
    )

    const setAutoApproveDecision = sfn.Pass.jsonata(
      this,
      "set-auto-approve-decision",
      {
        outputs:
          "{% $merge([$states.input, {'status': 'APPROVED', 'decision': 'AUTO_APPROVE', 'decisionReason': 'Bedrock recommended auto-approval and the fraud score stayed low.', 'notificationMessage': 'Return ' & $states.input.returnId & ' was auto-approved. Warehouse team ' & $states.input.order.warehouseTeam & ' can proceed with intake.', 'statusHistory': ['RECEIVED', 'ORDER_ELIGIBLE', 'IMAGE_ANALYZED', 'BEDROCK_RECOMMENDED_AUTO_APPROVE', 'APPROVED'], 'updatedAt': $now()}]) %}",
      },
    )

    const setManualReviewDecision = sfn.Pass.jsonata(
      this,
      "set-manual-review-decision",
      {
        outputs:
          "{% $merge([$states.input, {'status': 'MANUAL_REVIEW', 'decision': 'MANUAL_REVIEW', 'decisionReason': 'The return needs human review based on the combined fraud signals and Bedrock recommendation.', 'notificationMessage': 'Return ' & $states.input.returnId & ' requires manual review before warehouse processing continues.', 'statusHistory': ['RECEIVED', 'ORDER_ELIGIBLE', 'IMAGE_ANALYZED', 'BEDROCK_RECOMMENDED_MANUAL_REVIEW', 'MANUAL_REVIEW'], 'updatedAt': $now()}]) %}",
      },
    )

    const setRejectDecision = sfn.Pass.jsonata(this, "set-reject-decision", {
      outputs:
        "{% $merge([$states.input, {'status': 'REJECTED', 'decision': 'REJECT', 'decisionReason': 'The ordered item, uploaded image, and fraud recommendation do not align well enough for approval.', 'notificationMessage': 'Return ' & $states.input.returnId & ' was rejected after image analysis and fraud review.', 'statusHistory': ['RECEIVED', 'ORDER_ELIGIBLE', 'IMAGE_ANALYZED', 'BEDROCK_RECOMMENDED_REJECT', 'REJECTED'], 'updatedAt': $now()}]) %}",
    })

    const useTranslatedNotification = sfn.Pass.jsonata(
      this,
      "use-translated-notification",
      {
        outputs:
          "{% $merge([$states.input, {'translatedMessage': $states.input.translationResult.TranslatedText}]) %}",
      },
    )

    const useEnglishNotification = sfn.Pass.jsonata(
      this,
      "use-english-notification",
      {
        outputs:
          "{% $merge([$states.input, {'translatedMessage': $states.input.notificationMessage}]) %}",
      },
    )

    const translateNotification = tasks.CallAwsService.jsonPath(
      this,
      "translate-notification",
      {
        service: "translate",
        action: "translateText",
        iamResources: ["*"],
        parameters: {
          SourceLanguageCode: "en",
          TargetLanguageCode: sfn.JsonPath.stringAt("$.customerLanguage"),
          Text: sfn.JsonPath.stringAt("$.notificationMessage"),
        },
        resultPath: "$.translationResult",
      },
    )

    const publishTranslatedNotification = tasks.SnsPublish.jsonPath(
      this,
      "publish-translated-notification",
      {
        topic: returnUpdatesTopic,
        subject: sfn.JsonPath.format(
          "Return update {}",
          sfn.JsonPath.stringAt("$.returnId"),
        ),
        message: sfn.TaskInput.fromJsonPathAt("$.translatedMessage"),
        messageAttributes: {
          returnId: {
            value: sfn.JsonPath.stringAt("$.returnId"),
          },
          decision: {
            value: sfn.JsonPath.stringAt("$.decision"),
          },
          language: {
            value: sfn.JsonPath.stringAt("$.customerLanguage"),
          },
        },
        resultPath: "$.snsPublishResult",
      },
    )

    const persistFinalReturn = tasks.DynamoPutItem.jsonPath(
      this,
      "persist-final-return",
      {
        table: returnsTable,
        item: {
          returnId: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.returnId"),
          ),
          orderId: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.orderId"),
          ),
          customerEmail: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.customerEmail"),
          ),
          customerLanguage: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.customerLanguage"),
          ),
          reason: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.reason"),
          ),
          claimedItemType: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.claimedItemType"),
          ),
          photoBucket: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.photoBucket"),
          ),
          photoKey: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.photoKey"),
          ),
          status: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.status"),
          ),
          decision: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.decision"),
          ),
          decisionReason: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.decisionReason"),
          ),
          orderSummary: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.jsonToString(sfn.JsonPath.objectAt("$.order")),
          ),
          decisionModel: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.jsonToString(sfn.JsonPath.objectAt("$.decisionModel")),
          ),
          fraudSignals: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.jsonToString(sfn.JsonPath.objectAt("$.fraudSignals")),
          ),
          detectedLabels: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.jsonToString(
              sfn.JsonPath.objectAt("$.decisionModel.detectedLabels"),
            ),
          ),
          damageSignals: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.jsonToString(
              sfn.JsonPath.objectAt("$.decisionModel.damageSignals"),
            ),
          ),
          fraudScore: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.jsonToString(
              sfn.JsonPath.objectAt("$.decisionModel.fraudScore"),
            ),
          ),
          statusHistory: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.jsonToString(sfn.JsonPath.objectAt("$.statusHistory")),
          ),
          bedrockRecommendationText: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.bedrockRecommendationText"),
          ),
          notificationMessage: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.notificationMessage"),
          ),
          translatedMessage: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.translatedMessage"),
          ),
          executionArn: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.executionArn"),
          ),
          snsMessageId: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.snsPublishResult.MessageId"),
          ),
          createdAt: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.createdAt"),
          ),
          updatedAt: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.updatedAt"),
          ),
        },
        resultPath: sfn.JsonPath.DISCARD,
      },
    )

    const workflow = sfn.Chain.start(initializeReturnRequest)
      .next(persistReceivedReturn)
      .next(loadOrder)
      .next(
        sfn.Choice.jsonata(this, "check-eligibility")
          .when(
            sfn.Condition.jsonata(
              "{% $exists($states.input.orderLookup.Item) and $states.input.orderLookup.Item.returnEligible.BOOL and $toMillis($states.input.orderLookup.Item.returnWindowEndsAt.S) >= $toMillis($states.input.createdAt) %}",
            ),
            sfn.Chain.start(prepareEligibleReturn)
              .next(detectReturnPhotoLabels)
              .next(buildDecisionModel)
              .next(buildBedrockInput)
              .next(invokeFraudRecommender)
              .next(normalizeBedrockRecommendation)
              .next(
                sfn.Choice.jsonata(this, "choose-disposition")
                  .when(
                    sfn.Condition.jsonata(
                      "{% $contains($uppercase($states.input.bedrockRecommendationText), 'REJECT') or $states.input.decisionModel.fraudScore >= 80 %}",
                    ),
                    setRejectDecision,
                  )
                  .when(
                    sfn.Condition.jsonata(
                      "{% $contains($uppercase($states.input.bedrockRecommendationText), 'AUTO_APPROVE') and $states.input.decisionModel.fraudScore < 40 %}",
                    ),
                    setAutoApproveDecision,
                  )
                  .otherwise(setManualReviewDecision)
                  .afterwards(),
              ),
          )
          .otherwise(setIneligibleReturn)
          .afterwards(),
      )
      .next(
        sfn.Choice.jsonata(this, "should-translate-notification")
          .when(
            sfn.Condition.jsonata(
              "{% $lowercase($states.input.customerLanguage) = 'en' %}",
            ),
            useEnglishNotification,
          )
          .otherwise(
            sfn.Chain.start(translateNotification).next(
              useTranslatedNotification,
            ),
          )
          .afterwards(),
      )
      .next(publishTranslatedNotification)
      .next(persistFinalReturn)
      .next(new sfn.Succeed(this, "return-processed"))

    const returnProcessingStateMachine = new sfn.StateMachine(
      this,
      "return-processing-state-machine",
      {
        definitionBody: sfn.DefinitionBody.fromChainable(workflow),
        tracingEnabled: true,
        comment:
          "Return processing with DynamoDB eligibility checks, Rekognition fraud signals, Bedrock recommendations, Translate, and SNS notifications.",
      },
    )

    returnProcessingStateMachine.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["*"],
      }),
    )

    const demoApi = new Demo03RestApiGateway(this, "demo-03-rest-api-gateway", {
      stateMachine: returnProcessingStateMachine,
    })

    new cdk.CfnOutput(this, "demo-api-url", {
      value: demoApi.api.url,
    })

    new cdk.CfnOutput(this, "direct-returns-endpoint", {
      value: `${demoApi.api.url}returns/direct`,
    })

    new cdk.CfnOutput(this, "returns-table-name", {
      value: returnsTable.tableName,
    })

    new cdk.CfnOutput(this, "orders-table-name", {
      value: ordersTable.tableName,
    })

    new cdk.CfnOutput(this, "return-updates-topic-arn", {
      value: returnUpdatesTopic.topicArn,
    })

    new cdk.CfnOutput(this, "return-workflow-arn", {
      value: returnProcessingStateMachine.stateMachineArn,
    })
  }
}
