+++
title = "Starting our workflow when a new application is submitted"
chapter = false
weight = 10
+++

In our Pending Review state, we want to have the state machine call out to the Account Applications service to flag the application for review, and then to pause and wait for a callback from the Account Applications service, which will occur after a human reviews the application and makes a decision. Of course, in order for our step function to notify the Account Applications service that a record should be flagged, it’s going to need to pass it an application ID. And the only way the step function will be able to pass an ID back to our applications service is if we include an ID as part of the application information when the step function execution starts. Let’s take care of this now.

To do this, we will integrate our Account Applications service with our application processing step function, starting a new execution each time a new application is submitted to the service. When we start the execution, in addition to passing the applicant’s name and address as input (so the name and address checks can execute), we’ll also pass in the application ID so that the step function can execute the Account Applications service’s FlagApplication function to flag applications for review.

### In this step, we will

* Pass the state machine’s ARN as an environment variable to the SubmitApplication lambda function

* Update the SubmitApplication Lambda function to execute our Step Functions state machine when a new application is submitted, passing the relevant applicant details into the state machine’s input

* Create a new IAM policy that allows executing and interacting with our state machine, and attached this policy to the role used by the SubmitApplication Lambda function

### Make these changes

➡️ Step 1. Replace `account-applications/submit.js` with <span class="clipBtn clipboard" data-clipboard-target="#id1b5a5865a3354e70a12823bbe83fefce">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-id1b5a5865a3354e70a12823bbe83fefce"></div> <pre style="display: none;" data-diff-for="diff-id1b5a5865a3354e70a12823bbe83fefce">commit 509c5f4da832d190d3285f30d91fd29c3253b6fb
Author: Gabe Hollombe <gabe@avantbard.com>
Date:   Thu Oct 31 14:41:42 2019 +0800

    new account-applications/submit.js v2

diff --git a/code/account-applications/submit.js b/code/account-applications/submit.js
index ce94300..1f80e87 100644
--- a/code/account-applications/submit.js
+++ b/code/account-applications/submit.js
@@ -1,11 +1,13 @@
 'use strict';
 const REGION = process.env.REGION
 const ACCOUNTS_TABLE_NAME = process.env.ACCOUNTS_TABLE_NAME
+const APPLICATION_PROCESSING_STEP_FUNCTION_ARN = process.env.APPLICATION_PROCESSING_STEP_FUNCTION_ARN
 
 const AWS = require('aws-sdk')
 AWS.config.update({region: REGION});
 
 const dynamo = new AWS.DynamoDB.DocumentClient();
+const stepfunctions = new AWS.StepFunctions();
 
 const AccountApplications = require('./AccountApplications')(ACCOUNTS_TABLE_NAME, dynamo)
 
@@ -15,10 +17,20 @@ const submitNewAccountApplication = async (data) => {
     return application
 } 
 
+const startStateMachineExecution = (application) => {
+    const params = {
+        "input": JSON.stringify({ application }),
+        "name": `ApplicationID-${application.id}`,
+        "stateMachineArn": APPLICATION_PROCESSING_STEP_FUNCTION_ARN
+    }
+    return stepfunctions.startExecution(params).promise()
+}
+
 module.exports.handler = async(event) => {
     let application
     try {
         application = await submitNewAccountApplication(event)
+        await startStateMachineExecution(application)
         return application
     } catch (ex) {
         if (application !== undefined) {
</pre>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="id1b5a5865a3354e70a12823bbe83fefce" style="position: relative; left: -1000px; width: 1px; height: 1px;">'use strict';
const REGION = process.env.REGION
const ACCOUNTS_TABLE_NAME = process.env.ACCOUNTS_TABLE_NAME
const APPLICATION_PROCESSING_STEP_FUNCTION_ARN = process.env.APPLICATION_PROCESSING_STEP_FUNCTION_ARN

const AWS = require('aws-sdk')
AWS.config.update({region: REGION});

const dynamo = new AWS.DynamoDB.DocumentClient();
const stepfunctions = new AWS.StepFunctions();

const AccountApplications = require('./AccountApplications')(ACCOUNTS_TABLE_NAME, dynamo)

const submitNewAccountApplication = async (data) => {
    const { name, address } = data
    const application = await AccountApplications.create({ name, address, state: 'SUBMITTED' })
    return application
} 

const startStateMachineExecution = (application) => {
    const params = {
        "input": JSON.stringify({ application }),
        "name": `ApplicationID-${application.id}`,
        "stateMachineArn": APPLICATION_PROCESSING_STEP_FUNCTION_ARN
    }
    return stepfunctions.startExecution(params).promise()
}

module.exports.handler = async(event) => {
    let application
    try {
        application = await submitNewAccountApplication(event)
        await startStateMachineExecution(application)
        return application
    } catch (ex) {
        if (application !== undefined) {
            await AccountApplications.delete(application.id)
        }

        console.error(ex)
        console.info('event', JSON.stringify(event))
        throw ex
    }
}
</textarea>
{{< /safehtml >}}

➡️ Step 2. Replace `serverless.yml` with <span class="clipBtn clipboard" data-clipboard-target="#idcd74d7a530124dc7a5ae52e50a3f5b20">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-idcd74d7a530124dc7a5ae52e50a3f5b20"></div> <pre style="display: none;" data-diff-for="diff-idcd74d7a530124dc7a5ae52e50a3f5b20">commit 55e4f1b3cf75014bbad84ac40e00a17e32969798
Author: Gabe Hollombe <gabe@avantbard.com>
Date:   Tue Oct 15 17:16:45 2019 +0800

    Start workflow from submit lambda, add permissions and pass env var too

diff --git a/serverless.yml b/serverless.yml
index 47a3b0f..eec141d 100644
--- a/serverless.yml
+++ b/serverless.yml
@@ -19,6 +19,7 @@ functions:
     environment:
       REGION: ${self:provider.region}
       ACCOUNTS_TABLE_NAME: ${self:custom.applicationsTable}
+      APPLICATION_PROCESSING_STEP_FUNCTION_ARN: { Ref: "ProcessApplicationsStateMachine" }
     role: SubmitRole
 
   FlagApplication:
@@ -97,6 +98,21 @@ resources:
                         - { "Fn::GetAtt": ["ApplicationsDynamoDBTable", "Arn" ] }
                         - '*'
 
+    StepFunctionsPolicy:
+      Type: 'AWS::IAM::ManagedPolicy'
+      Properties:
+        PolicyDocument:
+          Version: '2012-10-17'
+          Statement:
+            -
+              Effect: "Allow"
+              Action:
+                - "states:StartExecution"
+                - "states:SendTaskSuccess"
+                - "states:SendTaskFailure"
+              Resource:
+                - { Ref: ProcessApplicationsStateMachine }
+
     SubmitRole:
       Type: AWS::IAM::Role
       Properties:
@@ -111,6 +127,7 @@ resources:
         ManagedPolicyArns:
           - { Ref: LambdaLoggingPolicy }
           - { Ref: DynamoPolicy }
+          - { Ref: StepFunctionsPolicy }
 
     FlagRole:
       Type: AWS::IAM::Role
</pre>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="idcd74d7a530124dc7a5ae52e50a3f5b20" style="position: relative; left: -1000px; width: 1px; height: 1px;">service: StepFunctionsWorkshop

plugins:
  - serverless-cf-vars

custom:
  applicationsTable: '${self:service}__account_applications__${self:provider.stage}'

provider:
  name: aws
  runtime: nodejs10.x
  memorySize: 128
  stage: dev

functions:
  SubmitApplication:
    name: ${self:service}__account_applications__submit__${self:provider.stage}
    handler: account-applications/submit.handler
    environment:
      REGION: ${self:provider.region}
      ACCOUNTS_TABLE_NAME: ${self:custom.applicationsTable}
      APPLICATION_PROCESSING_STEP_FUNCTION_ARN: { Ref: "ProcessApplicationsStateMachine" }
    role: SubmitRole

  FlagApplication:
    name: ${self:service}__account_applications__flag__${self:provider.stage}
    handler: account-applications/flag.handler
    environment:
      REGION: ${self:provider.region}
      ACCOUNTS_TABLE_NAME: ${self:custom.applicationsTable}
    role: FlagRole

  FindApplications:
    name: ${self:service}__account_applications__find__${self:provider.stage}
    handler: account-applications/find.handler
    environment:
      REGION: ${self:provider.region}
      ACCOUNTS_TABLE_NAME: ${self:custom.applicationsTable}
    role: FindRole

  RejectApplication:
    name: ${self:service}__account_applications__reject__${self:provider.stage}
    handler: account-applications/reject.handler
    environment:
      REGION: ${self:provider.region}
      ACCOUNTS_TABLE_NAME: ${self:custom.applicationsTable}
    role: RejectRole

  ApproveApplication:
    name: ${self:service}__account_applications__approve__${self:provider.stage}
    handler: account-applications/approve.handler
    environment:
      REGION: ${self:provider.region}
      ACCOUNTS_TABLE_NAME: ${self:custom.applicationsTable}
    role: ApproveRole

  DataChecking:
    name: ${self:service}__data_checking__${self:provider.stage}
    handler: data-checking.handler
    role: DataCheckingRole

resources:
  Resources:
    LambdaLoggingPolicy:
      Type: 'AWS::IAM::ManagedPolicy'
      Properties:
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - logs:CreateLogGroup
                - logs:CreateLogStream
                - logs:PutLogEvents
              Resource:
                - 'Fn::Join':
                  - ':'
                  -
                    - 'arn:aws:logs'
                    - Ref: 'AWS::Region'
                    - Ref: 'AWS::AccountId'
                    - 'log-group:/aws/lambda/*:*:*'

    DynamoPolicy:
      Type: 'AWS::IAM::ManagedPolicy'
      Properties:
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: "Allow"
              Action:
                - "dynamodb:*"
              Resource:
                - { "Fn::GetAtt": ["ApplicationsDynamoDBTable", "Arn" ] }
                - 'Fn::Join':
                    - '/'
                    -
                        - { "Fn::GetAtt": ["ApplicationsDynamoDBTable", "Arn" ] }
                        - '*'

    StepFunctionsPolicy:
      Type: 'AWS::IAM::ManagedPolicy'
      Properties:
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
            -
              Effect: "Allow"
              Action:
                - "states:StartExecution"
                - "states:SendTaskSuccess"
                - "states:SendTaskFailure"
              Resource:
                - { Ref: ProcessApplicationsStateMachine }

    SubmitRole:
      Type: AWS::IAM::Role
      Properties:
        AssumeRolePolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Principal:
                Service:
                  - lambda.amazonaws.com
              Action: sts:AssumeRole
        ManagedPolicyArns:
          - { Ref: LambdaLoggingPolicy }
          - { Ref: DynamoPolicy }
          - { Ref: StepFunctionsPolicy }

    FlagRole:
      Type: AWS::IAM::Role
      Properties:
        AssumeRolePolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Principal:
                Service:
                  - lambda.amazonaws.com
              Action: sts:AssumeRole
        ManagedPolicyArns:
          - { Ref: LambdaLoggingPolicy }
          - { Ref: DynamoPolicy }

    RejectRole:
      Type: AWS::IAM::Role
      Properties:
        AssumeRolePolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Principal:
                Service:
                  - lambda.amazonaws.com
              Action: sts:AssumeRole
        ManagedPolicyArns:
          - { Ref: LambdaLoggingPolicy }
          - { Ref: DynamoPolicy }

    ApproveRole:
      Type: AWS::IAM::Role
      Properties:
        AssumeRolePolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Principal:
                Service:
                  - lambda.amazonaws.com
              Action: sts:AssumeRole
        ManagedPolicyArns:
          - { Ref: LambdaLoggingPolicy }
          - { Ref: DynamoPolicy }

    FindRole:
      Type: AWS::IAM::Role
      Properties:
        AssumeRolePolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Principal:
                Service:
                  - lambda.amazonaws.com
              Action: sts:AssumeRole
        ManagedPolicyArns:
          - { Ref: LambdaLoggingPolicy }
          - { Ref: DynamoPolicy }

    DataCheckingRole:
      Type: AWS::IAM::Role
      Properties:
        AssumeRolePolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Principal:
                Service:
                  - lambda.amazonaws.com
              Action: sts:AssumeRole
        ManagedPolicyArns:
          - { Ref: LambdaLoggingPolicy }

    ApplicationsDynamoDBTable:
      Type: 'AWS::DynamoDB::Table'
      Properties:
        TableName: ${self:custom.applicationsTable}
        AttributeDefinitions:
          -
            AttributeName: id
            AttributeType: S
          -
            AttributeName: state
            AttributeType: S
        KeySchema:
          -
            AttributeName: id
            KeyType: HASH
        BillingMode: PAY_PER_REQUEST
        GlobalSecondaryIndexes:
            -
                IndexName: state
                KeySchema:
                    -
                        AttributeName: state
                        KeyType: HASH
                Projection:
                    ProjectionType: ALL

    StepFunctionRole:
      Type: 'AWS::IAM::Role'
      Properties:
        AssumeRolePolicyDocument:
            Version: '2012-10-17'
            Statement:
                -
                  Effect: Allow
                  Principal:
                      Service: 'states.amazonaws.com'
                  Action: 'sts:AssumeRole'
        Policies:
            -
              PolicyName: lambda
              PolicyDocument:
                Statement:
                  -
                    Effect: Allow
                    Action: 'lambda:InvokeFunction'
                    Resource:
                        - Fn::GetAtt: [DataCheckingLambdaFunction, Arn]

    ProcessApplicationsStateMachine:
      Type: AWS::StepFunctions::StateMachine
      Properties:
        StateMachineName: ${self:service}__process_account_applications__${self:provider.stage}
        RoleArn: !GetAtt StepFunctionRole.Arn
        DefinitionString:
          !Sub
            - |-
              {
                "StartAt": "Check Name",
                "States": {
                    "Check Name": {
                        "Type": "Task",
                        "Parameters": {
                            "command": "CHECK_NAME",
                            "data": { "name.$": "$.application.name" }
                        },
                        "Resource": "#{dataCheckingLambdaArn}",
                        "ResultPath": "$.checks.name",
                        "Next": "Check Address"
                    },
                    "Check Address": {
                        "Type": "Task",
                        "Parameters": {
                            "command": "CHECK_ADDRESS",
                            "data": { "address.$": "$.application.address" }
                        },
                        "Resource": "#{dataCheckingLambdaArn}",
                        "ResultPath": "$.checks.address",
                        "Next": "Review Required?"
                    },
                    "Review Required?": {
                        "Type": "Choice",
                        "Choices": [
                          {
                            "Variable": "$.checks.name.flagged",
                            "BooleanEquals": true,
                            "Next": "Pending Review"
                          },
                          {
                            "Variable": "$.checks.address.flagged",
                            "BooleanEquals": true,
                            "Next": "Pending Review"
                          }
                        ],
                        "Default": "Approve Application"
                    },
                    "Pending Review": {
                        "Type": "Pass",
                        "End": true
                     },
                    "Approve Application": {
                        "Type": "Pass",
                        "End": true
                    }
                }
              }
            - {
              dataCheckingLambdaArn: !GetAtt [DataCheckingLambdaFunction, Arn],
            }
</textarea>
{{< /safehtml >}}

➡️ Step 3. Run:

```bash
sls deploy
```


Now that we’ve integrated our Account Applications service with our processing workflow state machine, we’ll trigger all future state machine executions by submitting new applications to the service (by invoking our SubmitApplication function), rather than executing the state machine directly with arbitrary input in the web console. 

### Try it out

➡️ Step 1. Run:

```bash
sls invoke -f SubmitApplication --data='{ "name": "Spock", "address": "AnInvalidAddress" }'
```

➡️ Step 2. Go back to the step functions web console’s detail view for our state machine and look for a new execution at the top of the list. It should have a timestamp close to right now and it will contain a name that starts with ‘ApplicationID-’. If you click in to view the details of this execution, you should see it also take the Pending Review path, as we expect (because we submitted an invalid address), and you should also be able to see an `id` attribute on the application input passed in, and through, the state machine’s steps.

Now that we know we're passing an application ID to the step function successfully, we're ready to have our Pending Review state notify our Account Applications service whenever it wants to flag an application and pause its workflow processing the application until a human makes a decision about it.