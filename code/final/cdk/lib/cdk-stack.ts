import * as cdk from "@aws-cdk/core";
import * as dynamo from "@aws-cdk/aws-dynamodb";
import * as iam from "@aws-cdk/aws-iam";
import * as sfn from "@aws-cdk/aws-stepfunctions";
import * as sfnTasks from "@aws-cdk/aws-stepfunctions-tasks";
import { NodejsFunction } from "@aws-cdk/aws-lambda-nodejs";

interface SfnWorkshopStackProps {
  env: Required<cdk.Environment>;
}

export class SfWorkshopStack extends cdk.Stack {
  #lambdaRole: iam.Role;

  constructor(scope: cdk.Construct, id: string, props: SfnWorkshopStackProps) {
    super(scope, id, props);

    const applicationsDynamoTable = new dynamo.Table(this, "ApplicationsDynamoDbTable", {
      tableName: "applicationsTable",
      billingMode: dynamo.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "id", type: dynamo.AttributeType.STRING },
    });
    applicationsDynamoTable.addGlobalSecondaryIndex({
      indexName: "state",
      partitionKey: { name: "state", type: dynamo.AttributeType.STRING },
      projectionType: dynamo.ProjectionType.ALL,
    });

    const dynamoPolicy = new iam.ManagedPolicy(this, "DynamoPolicy", {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "dynamodb:*"
          ],
          resources: [
            applicationsDynamoTable.tableArn,
          ],
        })
      ]
    });

    const { region, account } = props.env;
    const lambdaLoggingPolicy = new iam.ManagedPolicy(this, "LambdaLoggingPolicy", {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
          ],
          resources: [
            `arn:aws:logs:${region}:${account}:log-group:/aws/lambda/*:*:*`,
          ],
        })
      ]
    });

    this.#lambdaRole = new iam.Role(this, "LambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        dynamoPolicy,
        lambdaLoggingPolicy,
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
      ]
    });

    const dynamoEnvVars = {
      REGION: region,
      APPLICATIONS_TABLE_NAME: applicationsDynamoTable.tableName,
    };

    const dataCheckingFn = this.createLambda(
      "DataCheckingFunction",
      `${__dirname}/../../data-checking.js`
    );

    const lambdaSrcBaseDir = `${__dirname}/../../account-applications`;
    const flagApplicationFn = this.createLambda(
      "FlagApplicationFunction",
      `${lambdaSrcBaseDir}/flag.js`,
      dynamoEnvVars
    );

    const approveApplicationFn = this.createLambda(
      "ApproveApplicationFunction",
      `${lambdaSrcBaseDir}/approve.js`,
      dynamoEnvVars
    );

    const rejectApplicationFn = this.createLambda(
      "RejectApplicationFunction",
      `${lambdaSrcBaseDir}/reject.js`,
      dynamoEnvVars
    );

    const findApplicationFn = this.createLambda(
      "FindApplicationFunction",
      `${lambdaSrcBaseDir}/find.js`,
      dynamoEnvVars
    );

    const stateMachineRole = new iam.Role(this, "StateMachineRole", {
      assumedBy: new iam.ServicePrincipal("states.amazonaws.com"),
      managedPolicies: [
        new iam.ManagedPolicy(this, "LambdaInvokePolicy", {
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "lambda:InvokeFunction",
              ],
              resources: [
                "*"
              ],
            }),
          ]
        }),
      ]
    });

    const flagApplicationAsUnprocessable = new sfnTasks.LambdaInvoke(this, "Flag Application As Unprocessable", {
      lambdaFunction: flagApplicationFn,
      payload: sfn.TaskInput.fromObject({
        "id.$": "$.application.id",
        "flagType": "UNPROCESSABLE_DATA",
        "errorInfo.$": "$.error-info",
      }),
      resultPath: "$.review"
    });

    const checkApplicantData = new sfn.Parallel(this, "Check Applicant Data", {
      resultPath: "$.checks",
    }).branch(
      new sfnTasks.LambdaInvoke(this, "Check Name", {
        lambdaFunction: dataCheckingFn,
        payload: sfn.TaskInput.fromObject({
          command: "CHECK_NAME",
          data: { "name.$": "$.application.name" },
        }),
      }),
      new sfnTasks.LambdaInvoke(this, "Check Address", {
        lambdaFunction: dataCheckingFn,
        payload: sfn.TaskInput.fromObject({
          command: "CHECK_ADDRESS",
          data: { "address.$": "$.application.address" },
        }),
      }),
    );
    checkApplicantData.addCatch(flagApplicationAsUnprocessable, {
      errors: ["UnprocessableDataException"],
      resultPath: "$.error-info",
    });

    const approveApplication = new sfnTasks.LambdaInvoke(this, "Approve Application", {
      lambdaFunction: approveApplicationFn,
      payload: sfn.TaskInput.fromObject({
        "id.$": "$.application.id",
      }),
    });

    const rejectApplication = new sfnTasks.LambdaInvoke(this, "Reject Application", {
      lambdaFunction: rejectApplicationFn,
      payload: sfn.TaskInput.fromObject({
        "id.$": "$.application.id",
      }),
    });

    const isReviewApproved = new sfn.Choice(this, "Is Review Approved?")
      .when(sfn.Condition.stringEquals("$.review.decision", "APPROVE"), approveApplication)
      .when(sfn.Condition.stringEquals("$.review.decision", "REJECT"), rejectApplication);

    const pendingReview = new sfnTasks.LambdaInvoke(this, "Pending Review", {
      lambdaFunction: flagApplicationFn,
      payload: sfn.TaskInput.fromObject({
        "id.$": "$.application.id",
        "flagType": "REVIEW",
        "taskToken": sfn.JsonPath.taskToken,
      }),
      resultPath: "$.review",
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
    }).next(isReviewApproved);

    const reviewRequired = new sfn.Choice(this, "Review Required");
    reviewRequired.when(sfn.Condition.booleanEquals("$.checks[0].Payload.flagged", true), pendingReview);
    reviewRequired.when(sfn.Condition.booleanEquals("$.checks[1].Payload.flagged", true), pendingReview);
    reviewRequired.otherwise(approveApplication);

    const processApplicationsStateMachine = new sfn.StateMachine(this, "ProcessApplicationsStateMachine", {
      definition: checkApplicantData
        .next(reviewRequired)
      ,
      role: stateMachineRole,
      timeout: cdk.Duration.minutes(5),
    });

    const sfnPolicy = new iam.ManagedPolicy(this, "StepFunctionsPolicy", {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "states:StartExecution",
            "states:SendTaskSuccess",
            "states:SendTaskFailure",
          ],
          resources: [
            processApplicationsStateMachine.stateMachineArn,
          ],
        })
      ],
    });

    const submitLambdaRole = new iam.Role(this, "SubmitLambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        dynamoPolicy,
        lambdaLoggingPolicy,
        sfnPolicy,
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
      ]
    });

    const reviewApplicationFn = new NodejsFunction(this, "ReviewApplicationFunction", {
      entry: `${lambdaSrcBaseDir}/review.js`,
      environment: {
        ...dynamoEnvVars,
        APPLICATION_PROCESSING_STEP_FUNCTION_ARN: processApplicationsStateMachine.stateMachineArn,
      },
      role: submitLambdaRole,
    });

    const submitApplicationFn = new NodejsFunction(this, "SubmitApplicationFunction", {
      entry: `${lambdaSrcBaseDir}/submit.js`,
      environment: {
        ...dynamoEnvVars,
        APPLICATION_PROCESSING_STEP_FUNCTION_ARN: processApplicationsStateMachine.stateMachineArn,
      },
      role: submitLambdaRole,
    });
  }

  createLambda(id: string, entry: string, environment?: { [key: string]: string }): NodejsFunction;
  createLambda(id: string, entry: string, environment: { [key: string]: string }): NodejsFunction {
    return new NodejsFunction(this, id, {
      entry,
      environment,
      bundling: {
        sourceMap: true,
        minify: false,
      },
      role: this.#lambdaRole,
    });
  }
}
