Foo

Step 3. Replace `serverless.yml` with <span class="clipBtn clipboard" data-clipboard-target="#idde4b3de4e6214c079bb600d7dea20246">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-idde4b3de4e6214c079bb600d7dea20246"></div> <pre style="display: none;" data-diff-for="diff-idde4b3de4e6214c079bb600d7dea20246">commit 278b0babefb143aafbbf1bb5c773a62fcd3f374f
Author: Gabe Hollombe <gabe@avantbard.com>
Date:   Wed Oct 16 10:58:50 2019 +0800

    Call out to Lambda from Pending Review state, add Review Approved? choice state that transitions to Approve or Reject pass states. Create a review lambda that calls back to Step Functions with review decision in SendTaskSuccess

diff --git a/serverless.yml b/serverless.yml
index eec141d..acc14c6 100644
--- a/serverless.yml
+++ b/serverless.yml
@@ -30,6 +30,14 @@ functions:
       ACCOUNTS_TABLE_NAME: ${self:custom.applicationsTable}
     role: FlagRole
 
+  ReviewApplication:
+    name: ${self:service}__account_applications__review__${self:provider.stage}
+    handler: account-applications/review.handler
+    environment:
+      REGION: ${self:provider.region}
+      ACCOUNTS_TABLE_NAME: ${self:custom.applicationsTable}
+    role: ReviewRole
+
   FindApplications:
     name: ${self:service}__account_applications__find__${self:provider.stage}
     handler: account-applications/find.handler
@@ -144,6 +152,22 @@ resources:
           - { Ref: LambdaLoggingPolicy }
           - { Ref: DynamoPolicy }
 
+    ReviewRole:
+      Type: AWS::IAM::Role
+      Properties:
+        AssumeRolePolicyDocument:
+          Version: '2012-10-17'
+          Statement:
+            - Effect: Allow
+              Principal:
+                Service:
+                  - lambda.amazonaws.com
+              Action: sts:AssumeRole
+        ManagedPolicyArns:
+          - { Ref: LambdaLoggingPolicy }
+          - { Ref: DynamoPolicy }
+          - { Ref: StepFunctionsPolicy }
+
     RejectRole:
       Type: AWS::IAM::Role
       Properties:
@@ -250,6 +274,7 @@ resources:
                     Action: 'lambda:InvokeFunction'
                     Resource:
                         - Fn::GetAtt: [DataCheckingLambdaFunction, Arn]
+                        - Fn::GetAtt: [FlagApplicationLambdaFunction, Arn]
 
     ProcessApplicationsStateMachine:
       Type: AWS::StepFunctions::StateMachine
@@ -299,8 +324,36 @@ resources:
                         "Default": "Approve Application"
                     },
                     "Pending Review": {
-                        "Type": "Pass",
-                        "End": true
+                      "Type": "Task",
+                      "Resource": "arn:aws:states:::lambda:invoke.waitForTaskToken",
+                      "Parameters": {
+                          "FunctionName": "#{flagApplicationLambdaName}",
+                          "Payload": {
+                              "id.$": "$.application.id",
+                              "flagType": "REVIEW",
+                              "taskToken.$": "$$.Task.Token"
+                          }
+                      },
+                      "ResultPath": "$.review",
+                      "Next": "Review Approved?"
+                    },
+                    "Review Approved?": {
+                        "Type": "Choice",
+                        "Choices": [{
+                                "Variable": "$.review.decision",
+                                "StringEquals": "APPROVE",
+                                "Next": "Approve Application"
+                            },
+                            {
+                                "Variable": "$.review.decision",
+                                "StringEquals": "REJECT",
+                                "Next": "Reject Application"
+                            }
+                        ]
+                    },
+                    "Reject Application": {
+                         "Type": "Pass",
+                         "End": true
                      },
                     "Approve Application": {
                         "Type": "Pass",
@@ -310,4 +363,5 @@ resources:
               }
             - {
               dataCheckingLambdaArn: !GetAtt [DataCheckingLambdaFunction, Arn],
+              flagApplicationLambdaName: !Ref FlagApplicationLambdaFunction,
             }
\ No newline at end of file
</pre>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="idde4b3de4e6214c079bb600d7dea20246" style="position: relative; left: -1000px; width: 1px; height: 1px;">service: StepFunctionsWorkshop

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

  ReviewApplication:
    name: ${self:service}__account_applications__review__${self:provider.stage}
    handler: account-applications/review.handler
    environment:
      REGION: ${self:provider.region}
      ACCOUNTS_TABLE_NAME: ${self:custom.applicationsTable}
    role: ReviewRole

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

    ReviewRole:
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
                        - Fn::GetAtt: [FlagApplicationLambdaFunction, Arn]

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
                      "Type": "Task",
                      "Resource": "arn:aws:states:::lambda:invoke.waitForTaskToken",
                      "Parameters": {
                          "FunctionName": "#{flagApplicationLambdaName}",
                          "Payload": {
                              "id.$": "$.application.id",
                              "flagType": "REVIEW",
                              "taskToken.$": "$$.Task.Token"
                          }
                      },
                      "ResultPath": "$.review",
                      "Next": "Review Approved?"
                    },
                    "Review Approved?": {
                        "Type": "Choice",
                        "Choices": [{
                                "Variable": "$.review.decision",
                                "StringEquals": "APPROVE",
                                "Next": "Approve Application"
                            },
                            {
                                "Variable": "$.review.decision",
                                "StringEquals": "REJECT",
                                "Next": "Reject Application"
                            }
                        ]
                    },
                    "Reject Application": {
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
              flagApplicationLambdaName: !Ref FlagApplicationLambdaFunction,
            }
</textarea>
{{< /safehtml >}}

ABCD