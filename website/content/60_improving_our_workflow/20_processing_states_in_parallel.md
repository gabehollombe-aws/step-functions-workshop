+++
title = "Processing independant states in parallel"
chapter = false
weight = 20
+++

## Processing independent states in parallel

Up until now we have performed both of our data checking steps in a serial fashion, one after the other. But checking an applicant’s address doesn’t depend on the result from checking the applicant’s name. So, this is a great opportunity to speed things up and perform our two data check steps in parallel instead. 

Step Functions has a `Parallel` state type which, unsurprisingly, lets a state machine perform parallel executions of multiple states. A `Parallel` state causes the interpreter to execute each branch starting with the state named in its `StartAt` field, as concurrently as possible, and wait until each branch terminates (reaches a terminal state) before processing the Parallel state's `Next` field. 

### In this step, we will

* Update our state machine to run the Check Name and Check Address states in parallel using the `Parallel` state type

* Update our state machine's 'Review Required?' `Choice` state to handle the results from the parallel data checks. We need to do this because the Parallel state returns each check as an element in an array in the same order the steps are specified in the `Parallel` state definition.


### Make these changes

Let's refactor our state machine to  perform the name and address checks in parallel:

➡️ Step 1. Replace `serverless.yml` with <span class="clipBtn clipboard" data-clipboard-target="#idb59ef219f6ba4e0a8120a56f6b3681d3">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-idb59ef219f6ba4e0a8120a56f6b3681d3"></div> <pre style="display: none;" data-diff-for="diff-idb59ef219f6ba4e0a8120a56f6b3681d3">commit 8f6d5e019d11e6805e4124fb30cdd6a03b41a681
Author: Gabe Hollombe <gabe@avantbard.com>
Date:   Wed Oct 16 11:49:55 2019 +0800

    Refactor to parallel data checking states

diff --git a/serverless.yml b/serverless.yml
index 47f7742..c463339 100644
--- a/serverless.yml
+++ b/serverless.yml
@@ -287,49 +287,63 @@ resources:
           !Sub
             - |-
               {
-                "StartAt": "Check Name",
+                "StartAt": "Check Applicant Data",
                 "States": {
-                    "Check Name": {
-                        "Type": "Task",
-                        "Parameters": {
-                            "command": "CHECK_NAME",
-                            "data": { "name.$": "$.application.name" }
-                        },
-                        "Resource": "#{dataCheckingLambdaArn}",
-                        "ResultPath": "$.checks.name",
-                        "Retry": [ {
-                            "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
-                        } ],
-                        "Catch": [ {
-                          "ErrorEquals": ["UnprocessableDataException"],
-                          "ResultPath": "$.error-info",
-                          "Next": "Flag Application As Unprocessable"
-                        } ],
-                        "Next": "Check Address"
-                    },
-                    "Check Address": {
-                        "Type": "Task",
-                        "Parameters": {
-                            "command": "CHECK_ADDRESS",
-                            "data": { "address.$": "$.application.address" }
-                        },
-                        "Resource": "#{dataCheckingLambdaArn}",
-                        "ResultPath": "$.checks.address",
-                        "Retry": [ {
-                            "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
-                        } ],
-                        "Next": "Review Required?"
+                    "Check Applicant Data": {
+                      "Type": "Parallel",
+                      "Branches": [{
+                              "StartAt": "Check Name",
+                              "States": {
+                                  "Check Name": {
+                                      "Type": "Task",
+                                      "Parameters": {
+                                          "command": "CHECK_NAME",
+                                          "data": { "name.$": "$.application.name" }
+                                      },
+                                      "Resource": "#{dataCheckingLambdaArn}",
+                                      "Retry": [ {
+                                          "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException" ]
+                                      } ],
+                                      "End": true
+                                  }
+                              }
+                          },
+                          {
+                              "StartAt": "Check Address",
+                              "States": {
+                                  "Check Address": {
+                                      "Type": "Task",
+                                      "Parameters": {
+                                          "command": "CHECK_ADDRESS",
+                                          "data": { "address.$": "$.application.address" }
+                                      },
+                                      "Resource": "#{dataCheckingLambdaArn}",
+                                      "Retry": [ {
+                                          "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
+                                      } ],
+                                      "End": true
+                                  }
+                              }
+                          }
+                      ],
+                      "Catch": [ {
+                        "ErrorEquals": ["UnprocessableDataException"],
+                        "ResultPath": "$.error-info",
+                        "Next": "Flag Application As Unprocessable"
+                      } ],
+                      "ResultPath": "$.checks",
+                      "Next": "Review Required?"
                     },
                     "Review Required?": {
                         "Type": "Choice",
                         "Choices": [
                           {
-                            "Variable": "$.checks.name.flagged",
+                            "Variable": "$.checks[0].flagged",
                             "BooleanEquals": true,
                             "Next": "Pending Review"
                           },
                           {
-                            "Variable": "$.checks.address.flagged",
+                            "Variable": "$.checks[1].flagged",
                             "BooleanEquals": true,
                             "Next": "Pending Review"
                           }
@@ -367,7 +381,7 @@ resources:
                             }
                         ]
                     },
-                     "Reject Application": {
+                    "Reject Application": {
                         "Type": "Task",
                         "Parameters": {
                             "id.$": "$.application.id"
@@ -377,8 +391,8 @@ resources:
                             "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
                         } ],
                         "End": true
-                     },
-                     "Approve Application": {
+                    },
+                    "Approve Application": {
                         "Type": "Task",
                         "Parameters": {
                             "id.$": "$.application.id"
@@ -388,7 +402,7 @@ resources:
                             "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
                         } ],
                         "End": true
-                     },
+                    },
                     "Flag Application As Unprocessable": {
                       "Type": "Task",
                       "Resource": "arn:aws:states:::lambda:invoke",
</pre>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="idb59ef219f6ba4e0a8120a56f6b3681d3" style="position: relative; left: -1000px; width: 1px; height: 1px;">service: StepFunctionsWorkshop

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
                        - Fn::GetAtt: [ApproveApplicationLambdaFunction, Arn]
                        - Fn::GetAtt: [RejectApplicationLambdaFunction, Arn]

    ProcessApplicationsStateMachine:
      Type: AWS::StepFunctions::StateMachine
      Properties:
        StateMachineName: ${self:service}__process_account_applications__${self:provider.stage}
        RoleArn: !GetAtt StepFunctionRole.Arn
        DefinitionString:
          !Sub
            - |-
              {
                "StartAt": "Check Applicant Data",
                "States": {
                    "Check Applicant Data": {
                      "Type": "Parallel",
                      "Branches": [{
                              "StartAt": "Check Name",
                              "States": {
                                  "Check Name": {
                                      "Type": "Task",
                                      "Parameters": {
                                          "command": "CHECK_NAME",
                                          "data": { "name.$": "$.application.name" }
                                      },
                                      "Resource": "#{dataCheckingLambdaArn}",
                                      "Retry": [ {
                                          "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException" ]
                                      } ],
                                      "End": true
                                  }
                              }
                          },
                          {
                              "StartAt": "Check Address",
                              "States": {
                                  "Check Address": {
                                      "Type": "Task",
                                      "Parameters": {
                                          "command": "CHECK_ADDRESS",
                                          "data": { "address.$": "$.application.address" }
                                      },
                                      "Resource": "#{dataCheckingLambdaArn}",
                                      "Retry": [ {
                                          "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
                                      } ],
                                      "End": true
                                  }
                              }
                          }
                      ],
                      "Catch": [ {
                        "ErrorEquals": ["UnprocessableDataException"],
                        "ResultPath": "$.error-info",
                        "Next": "Flag Application As Unprocessable"
                      } ],
                      "ResultPath": "$.checks",
                      "Next": "Review Required?"
                    },
                    "Review Required?": {
                        "Type": "Choice",
                        "Choices": [
                          {
                            "Variable": "$.checks[0].flagged",
                            "BooleanEquals": true,
                            "Next": "Pending Review"
                          },
                          {
                            "Variable": "$.checks[1].flagged",
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
                      "Retry": [ {
                          "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
                      } ],
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
                        "Type": "Task",
                        "Parameters": {
                            "id.$": "$.application.id"
                        },
                        "Resource": "#{rejectApplicationLambdaArn}",
                        "Retry": [ {
                            "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
                        } ],
                        "End": true
                    },
                    "Approve Application": {
                        "Type": "Task",
                        "Parameters": {
                            "id.$": "$.application.id"
                        },
                        "Resource": "#{approveApplicationLambdaArn}",
                        "Retry": [ {
                            "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
                        } ],
                        "End": true
                    },
                    "Flag Application As Unprocessable": {
                      "Type": "Task",
                      "Resource": "arn:aws:states:::lambda:invoke",
                      "Parameters": {
                          "FunctionName": "#{flagApplicationLambdaName}",
                          "Payload": {
                              "id.$": "$.application.id",
                              "flagType": "UNPROCESSABLE_DATA",
                              "errorInfo.$": "$.error-info"
                          }
                      },
                      "ResultPath": "$.review",
                      "Retry": [ {
                          "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
                      } ],
                      "End": true
                    }
                }
              }
            - {
              dataCheckingLambdaArn: !GetAtt [DataCheckingLambdaFunction, Arn],
              flagApplicationLambdaName: !Ref FlagApplicationLambdaFunction,
              rejectApplicationLambdaArn: !GetAtt [RejectApplicationLambdaFunction, Arn],
              approveApplicationLambdaArn: !GetAtt [ApproveApplicationLambdaFunction, Arn],
            }
</textarea>
{{< /safehtml >}}

➡️ Step 2. Run:

```bash
sls deploy
```

### Try it out

Now you can try a few types of application submissions to see how they each execute:

➡️ Step 1. Submit a valid application and see it auto approve after checking the data fields in parallel. Run:

```bash
sls invoke -f SubmitApplication --data='{ "name": "Spock", "address": "123 Enterprise Street" }'
```

Here is what a valid application execution flow looks like:

![Parallel check auto approving](images/workflow-vis-parallel-approved.png)

➡️ Step 2. Submit an application with an invalid name or address (or both) and see the parallel checks result in the workflow routing to wait for a review. Run:

```bash
sls invoke -f SubmitApplication --data='{ "name": "Gabe", "address": "ABadAddress" }'
```

Here is what an invalid application execution flow looks like:

![Parallel check pending](images/workflow-vis-parallel-pending.png)

➡️ Step 3. Submit an application with our test unprocessable name to see the parallel data checking state throw the error and route to the state to flag an application as unprocessable. Run: 

```bash
sls invoke -f SubmitApplication --data='{ "name": "UNPROCESSABLE_DATA", "address": "123 Street" }'
```

Here is what an unprocessable application execution flow looks like:

![Parallel check unprocessable](images/workflow-vis-parallel-unprocessable.png)

At this point, we have a well structured state machine to manage the workflow of processing new account applications for our simple banking system. If we wanted to, we could add on another step in our workflow to handle further downstream logic involved with opening up a bank account for applications that get approved. But, this is a good place to wrap up because you already have all the experience needed to continue implementing these further steps on your own, if you wish.