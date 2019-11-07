+++
title = "Fixing Permissions"
chapter = false
weight = 40
+++

Rather than continue to work in the web console and make these fixes by hand, we’ll return to our `serverless.yml` file to define our state machine alongside the other resources used in this workshop, and we’ll take care to also set up the appropriate permissions for this state machine to execute successfully.

### In this step, we will

* Define our new AWS Step Functions state machine inside `serverless.yml`

* Add a new IAM role for our state machine to assume when it executes. The role grants permission for the state machine to invoke our Data Checking Lambda function.

### Make these changes

Before we migrate our step function definition over to our `serverless.yml` file, we should delete the function we’ve been interacting with in the Step Functions web console so that we don’t get confused when a similar state machine is deployed as part of our Serverless stack deployment.

➡️ Step 1. In the left sidebar of the Step Functions web console, click ‘State machines’

➡️ Step 2. Select the state machne that we manually defined earlier, click ‘Delete’, and click ‘Delete state machine’ to confirm the deletion.

➡️ Step 3. Now, let’s re-define our state machine inside our `serverless.yaml` file. Replace `serverless.yml` with <span class="clipBtn clipboard" data-clipboard-target="#id9f8a6b1306e349bfa86142e515000923">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-id9f8a6b1306e349bfa86142e515000923"></div> <pre style="display: none;" data-diff-for="diff-id9f8a6b1306e349bfa86142e515000923">commit c9b0e65eca70946d4da2fceaca4b26bfc6641a76
Author: Gabe Hollombe <gabe@avantbard.com>
Date:   Tue Oct 15 16:13:21 2019 +0800

    Add StepFunction simplified workflow to serverless.yml

diff --git a/serverless.yml b/serverless.yml
index 07bc6d3..0b9f3b9 100644
--- a/serverless.yml
+++ b/serverless.yml
@@ -210,4 +210,65 @@ resources:
                         AttributeName: state
                         KeyType: HASH
                 Projection:
-                    ProjectionType: ALL
\ No newline at end of file
+                    ProjectionType: ALL
+
+    StepFunctionRole:
+      Type: 'AWS::IAM::Role'
+      Properties:
+        AssumeRolePolicyDocument:
+            Version: '2012-10-17'
+            Statement:
+                -
+                  Effect: Allow
+                  Principal:
+                      Service: 'states.amazonaws.com'
+                  Action: 'sts:AssumeRole'
+        Policies:
+            -
+              PolicyName: lambda
+              PolicyDocument:
+                Statement:
+                  -
+                    Effect: Allow
+                    Action: 'lambda:InvokeFunction'
+                    Resource:
+                        - Fn::GetAtt: [DataCheckingLambdaFunction, Arn]
+
+    ProcessApplicationsStateMachine:
+      Type: AWS::StepFunctions::StateMachine
+      Properties:
+        StateMachineName: ${self:service}__process_account_applications__${self:provider.stage}
+        RoleArn: !GetAtt StepFunctionRole.Arn
+        DefinitionString:
+          !Sub
+            - |-
+              {
+                "StartAt": "Check Name",
+                "States": {
+                    "Check Name": {
+                        "Type": "Task",
+                        "Parameters": {
+                            "command": "CHECK_NAME",
+                            "data": { "name.$": "$.application.name" }
+                        },
+                        "Resource": "#{dataCheckingLambdaArn}",
+                        "Next": "Check Address"
+                    },
+                    "Check Address": {
+                        "Type": "Task",
+                        "Parameters": {
+                            "command": "CHECK_ADDRESS",
+                            "data": { "address.$": "$.application.address" }
+                        },
+                        "Resource": "#{dataCheckingLambdaArn}",
+                        "Next": "Approve Application"
+                    },
+                    "Approve Application": {
+                        "Type": "Pass",
+                        "End": true
+                    }
+                }
+              }
+            - {
+              dataCheckingLambdaArn: !GetAtt [DataCheckingLambdaFunction, Arn],
+            }
\ No newline at end of file
</pre>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="id9f8a6b1306e349bfa86142e515000923" style="position: relative; left: -1000px; width: 1px; height: 1px;">service: StepFunctionsWorkshop

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
                        "Next": "Check Address"
                    },
                    "Check Address": {
                        "Type": "Task",
                        "Parameters": {
                            "command": "CHECK_ADDRESS",
                            "data": { "address.$": "$.application.address" }
                        },
                        "Resource": "#{dataCheckingLambdaArn}",
                        "Next": "Approve Application"
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

➡️ Step 4. Run:

```bash
sls deploy
```


### Try it out

➡️ Step 1. Head back to the Step Functions web console and look for a state machine named `StepFunctionsWorkshop__process_account_applications__dev` and click it. This is the re-deployed version of our state machine. The new version of our state machine hasn’t changed, except that we granted its IAM role permissions to invoke our Data Checking lambda. Let’s try executing it again with some sample input to see what happens.

➡️ Step 2. Click ‘Start execution’

➡️ Step 3. Paste the following JSON into the input field

```json
{
    "application": { 
        "name": "Spock", 
        "address": "123 Enterprise Street" 
    }
}
```

➡️ Step 4. Click ‘Start execution’


After a moment, you should see that the execution **failed**. But, this time, we don’t have any red states, because our failure mode is different. 

Now, we know that our state machine was able to execute our Data Checking lambda function because the ‘Check Name’ state is green. But, notice how the ‘Check Address’ state has a dark gray background. If you look at the color code at the bottom of the visualization section, you’ll see that this means the state was cancelled. Let’s see why.

![Workflow simplified address cancelled](/images/simplified-workflow-vis-address-error.png)

### Do these steps

➡️ Step 1. In the ‘Execution event history’ section, expand the last row, which should show ‘Execution failed’

➡️ Step 2. Notice that the error message gives us a helpful description of what went wrong.

```
{
  "error": "States.Runtime",
  "cause": "An error occurred while executing the state 'Check Address' (entered at the event id #7). The JSONPath '$.application.address' specified for the field 'address.$' could not be found in the input '{\"flagged\":false}'"
}
```

Let’s unpack this so we can understand why the state was cancelled.  If you look back at our state machine definition for the Check Address state (shown below), you’ll see that it expects to have an `application` object in its input, and it tries to pass `application.address` down into the Data Checking lambda. 

![Check Address expected data](/images/check_address_expectation.png)

The error message is telling us that it couldn’t find `application.address` in the state’s input. To understand why, we need to learn a bit more about how an active state generates its output and passes it to the next state’s input.