import * as cdk from "@aws-cdk/core";
import * as dynamo from "@aws-cdk/aws-dynamodb";
import * as iam from "@aws-cdk/aws-iam";
import * as sfn from "@aws-cdk/aws-stepfunctions";
import * as sfnTasks from "@aws-cdk/aws-stepfunctions-tasks";
import { NodejsFunction } from "@aws-cdk/aws-lambda-nodejs";

export class SfWorkshopStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
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

    const awsRegion = props!.env!.region!;
    const awsAccountId = props!.env!.account!;
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
            `arn:aws:logs:${awsRegion}:${awsAccountId}:log-group:/aws/lambda/*:*:*`,
          ],
        })
      ]
    });

    const lambdaRole = new iam.Role(this, "LambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        dynamoPolicy,
        lambdaLoggingPolicy,
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
      ]
    });

    const dataCheckingFn = new NodejsFunction(this, "DataCheckingFunction", {
      entry: `${__dirname}/../../code/final/data-checking.js`,
      role: lambdaRole,
    })

    const checkApplicantData = new sfn.Parallel(this, "CheckApplicantDataState", {
      resultPath: "$.checks",
    }).branch(
      new sfnTasks.LambdaInvoke(this, "CheckName", {
        lambdaFunction: dataCheckingFn,
        payload: sfn.TaskInput.fromObject({
          command: "CHECK_NAME",
          data: { "name.$": "$.application.name" },
        }),
      }),
      new sfnTasks.LambdaInvoke(this, "CheckAddress", {
        lambdaFunction: dataCheckingFn,
        payload: sfn.TaskInput.fromObject({
          command: "CHECK_ADDRESS",
          data: { "address.$": "$.application.address" },
        }),
      }),
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

    const definition = checkApplicantData;
    const processApplicationsStateMachine = new sfn.StateMachine(this, "ProcessApplicationsStateMachine", {
      definition,
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

    const submitApplicationFn = new NodejsFunction(this, "SubmitApplicationFunction", {
      entry: `${__dirname}/../../code/final/account-applications/submit.js`,
      environment: {
        REGION: awsRegion,
        APPLICATIONS_TABLE_NAME: applicationsDynamoTable.tableName,
        APPLICATION_PROCESSING_STEP_FUNCTION_ARN: processApplicationsStateMachine.stateMachineArn,
      },
      role: submitLambdaRole,
    });
  }
}
