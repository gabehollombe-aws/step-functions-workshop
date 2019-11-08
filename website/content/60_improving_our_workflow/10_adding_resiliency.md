+++
title = "Improving resiliency by adding retries and error handling to our workflow"
chapter = false
weight = 10
+++

Until now, we haven’t taken the time to add any resiliency into our state machine. What happens if some of our Lambda function calls result in a timeout, or if they experience some other sort of transient error? What if they throw an exception? Let’s address these what-ifs now and leverage the built in retry and error handling capabilities of AWS Step Functions.

So, what kind of errors can occur? Here’s what the Step Functions developer guide has to say:


> Any state can encounter runtime errors. Errors can happen for various reasons:

> - State machine definition issues (for example, no matching rule in a `Choice` state) 

> - Task failures (for example, an exception in a Lambda function)

> - Transient issues (for example, network partition events)

> By default, when a state reports an error, AWS Step Functions causes the execution to fail entirely. 


For our example workflow, we’re probably OK with just allowing our workflow to fail when any unexpected errors occur. But some Lambda invocation errors are transient, so we should at least add some retry behavior to our Task states that invoke Lambda functions.

Task states (and others like Parallel states too, which we’ll get to later), have the capability to retry their work after they encounter an error. We just need to add a `Retry` parameter to our Task state definitions, telling them which types of errors they should retry for, and optionally specify additional configuration to control the rate of retries and the maximum number of retry attempts.

The developer guide identifies the [types of transient Lambda service errors](https://docs.aws.amazon.com/step-functions/latest/dg/bp-lambda-serviceexception.html) that should proactively handle with a retry as a best practice.   So let’s add `Retry` configurations to each of our Lambda invoking Task states to handle these transient errors.

### In this step, we will

* Add `Retry` configuration to all of the Task states in our state machine that invoke Lambda functions, providing automated retry resiliency for transient errors


### Make these changes

➡️ Step 1. Replace `serverless.yml` with <span class="clipBtn clipboard" data-clipboard-target="#id3724890c35904b27aff48e02310a3c36">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-id3724890c35904b27aff48e02310a3c36"></div> <pre style="display: none;" data-diff-for="diff-id3724890c35904b27aff48e02310a3c36">commit 43adfda72ed4228c5818e3b7b2c334dea6cdb340
Author: Gabe Hollombe <gabe@avantbard.com>
Date:   Wed Oct 16 11:19:09 2019 +0800

    Add retry config to the Lambda Task states

diff --git a/serverless.yml b/serverless.yml
index 4010aa8..f28884a 100644
--- a/serverless.yml
+++ b/serverless.yml
@@ -297,6 +297,9 @@ resources:
                         },
                         "Resource": "#{dataCheckingLambdaArn}",
                         "ResultPath": "$.checks.name",
+                        "Retry": [ {
+                            "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
+                        } ],
                         "Next": "Check Address"
                     },
                     "Check Address": {
@@ -307,6 +310,9 @@ resources:
                         },
                         "Resource": "#{dataCheckingLambdaArn}",
                         "ResultPath": "$.checks.address",
+                        "Retry": [ {
+                            "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
+                        } ],
                         "Next": "Review Required?"
                     },
                     "Review Required?": {
@@ -337,6 +343,9 @@ resources:
                           }
                       },
                       "ResultPath": "$.review",
+                      "Retry": [ {
+                          "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
+                      } ],
                       "Next": "Review Approved?"
                     },
                     "Review Approved?": {
@@ -359,6 +368,9 @@ resources:
                             "id.$": "$.application.id"
                         },
                         "Resource": "#{rejectApplicationLambdaArn}",
+                        "Retry": [ {
+                            "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
+                        } ],
                         "End": true
                      },
                      "Approve Application": {
@@ -367,6 +379,9 @@ resources:
                             "id.$": "$.application.id"
                         },
                         "Resource": "#{approveApplicationLambdaArn}",
+                        "Retry": [ {
+                            "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
+                        } ],
                         "End": true
                      }
                 }
</pre>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="id3724890c35904b27aff48e02310a3c36" style="position: relative; left: -1000px; width: 1px; height: 1px;">service: StepFunctionsWorkshop

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
                        "Retry": [ {
                            "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
                        } ],
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
                        "Retry": [ {
                            "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
                        } ],
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


{{% notice tip %}}
We could have specified additional configuration for our `Retry` parameters, including `IntervalSeconds` (defaults to  1), `MaxAttempts` (defaults to  3), and `BackoffRate` (defaults to 2), but the defaults are fine for our case, so we’ll just go with the default values.
{{% /notice %}}

Now, we can’t actually test any of these errors easily, because all of the exceptions we’ve added retries for are transient in nature. But now you know how to add these types of retries yourself as a best practice. Moving on, let’s learn how to handle specific application-level errors, too.

In addition to handling transient problems with Retries, Step Functions also allows us to catch specific errors and respond by transitioning to appropriate states to handle these errors. For example, let’s pretend that there are some types of names that our Data Checking service can’t handle. In these cases, we don’t want to flag the application for review, but we want to flag the application in a way that signifies to the business that it is unprocessable to due to incompatible data. 

To show this in action, we’ll update our Data Checking Lambda, telling it to throw an error if it sees a specific test string come through in an applicant’s name. We’ll update our state machine to catch this specific type of custom error and redirect to a new state, Flag Application As Unprocessable, that will flag the application appropriately.

### In this step, we will

* Update `data-checking.js` to throw an `UnprocessableDataException` whenever someone passes in a special string of `UNPROCESSABLE_DATA` as a name to be checked

* Add a new Flag Application As Unprocessable state to our state machine which will update our account application appropriately

* Add a `Catch` configuration to our Check Name state in our state machine, causing a transition to the Flag Application As Unprocessable state

### Make these changes

➡️ Step 1. Replace `data-checking.js` with <span class="clipBtn clipboard" data-clipboard-target="#id69b12ea735724221b10f609e591d879a">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-id69b12ea735724221b10f609e591d879a"></div> <pre style="display: none;" data-diff-for="diff-id69b12ea735724221b10f609e591d879a">commit de0c16350f24b069e52895f60c94dc110e81e39b
Author: Gabe Hollombe <gabe@avantbard.com>
Date:   Fri Nov 8 11:20:55 2019 +0800

    data-checking.js v2

diff --git a/code/data-checking.js b/code/data-checking.js
index 9dbdaf6..ff12893 100644
--- a/code/data-checking.js
+++ b/code/data-checking.js
@@ -3,7 +3,13 @@
 const checkName = (data) => {
     const { name } = data
 
-    const flagged = (name.indexOf('evil') !== -1)
+    if (name.includes("UNPROCESSABLE_DATA")) {
+        const simulatedError = new Error(`Simulated error: Name '${name}' is not possible to check.`)
+        simulatedError.name = 'UnprocessableDataException'
+        throw simulatedError
+    }
+
+    const flagged = name.includes('evil')
     return { flagged }
 }
 
@@ -32,4 +38,3 @@ module.exports.handler = (event, context, callback) => {
         callback(ex)
     }
 };
-
</pre>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="id69b12ea735724221b10f609e591d879a" style="position: relative; left: -1000px; width: 1px; height: 1px;">'use strict';

const checkName = (data) => {
    const { name } = data

    if (name.includes("UNPROCESSABLE_DATA")) {
        const simulatedError = new Error(`Simulated error: Name '${name}' is not possible to check.`)
        simulatedError.name = 'UnprocessableDataException'
        throw simulatedError
    }

    const flagged = name.includes('evil')
    return { flagged }
}

const checkAddress = (data) => {
    const { address } = data

    const flagged = (address.match(/(\d+ \w+)|(\w+ \d+)/g) === null)
    return { flagged }
}


const commandHandlers = {
    'CHECK_NAME': checkName,
    'CHECK_ADDRESS': checkAddress,
}

module.exports.handler = (event, context, callback) => {
    try {
        const { command, data } = event

        const result = commandHandlers[command](data)
        callback(null, result)
    } catch (ex) {
        console.error(ex)
        console.info('event', JSON.stringify(event))
        callback(ex)
    }
};

</textarea>
{{< /safehtml >}}

➡️ Step 2. Replace `serverless.yml` with <span class="clipBtn clipboard" data-clipboard-target="#id0bd5041459fb4d9481379086c63fc9b2">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-id0bd5041459fb4d9481379086c63fc9b2"></div> <pre style="display: none;" data-diff-for="diff-id0bd5041459fb4d9481379086c63fc9b2">commit afebf4c40193cc6a39c685ac9a15b27f9438a52b
Author: Gabe Hollombe <gabe@avantbard.com>
Date:   Wed Oct 16 11:37:27 2019 +0800

    Add error handling example for UNPROCESSABLE_DATA in Name

diff --git a/serverless.yml b/serverless.yml
index f28884a..47f7742 100644
--- a/serverless.yml
+++ b/serverless.yml
@@ -300,6 +300,11 @@ resources:
                         "Retry": [ {
                             "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
                         } ],
+                        "Catch": [ {
+                          "ErrorEquals": ["UnprocessableDataException"],
+                          "ResultPath": "$.error-info",
+                          "Next": "Flag Application As Unprocessable"
+                        } ],
                         "Next": "Check Address"
                     },
                     "Check Address": {
@@ -383,7 +388,24 @@ resources:
                             "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
                         } ],
                         "End": true
-                     }
+                     },
+                    "Flag Application As Unprocessable": {
+                      "Type": "Task",
+                      "Resource": "arn:aws:states:::lambda:invoke",
+                      "Parameters": {
+                          "FunctionName": "#{flagApplicationLambdaName}",
+                          "Payload": {
+                              "id.$": "$.application.id",
+                              "flagType": "UNPROCESSABLE_DATA",
+                              "errorInfo.$": "$.error-info"
+                          }
+                      },
+                      "ResultPath": "$.review",
+                      "Retry": [ {
+                          "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
+                      } ],
+                      "End": true
+                    }
                 }
               }
             - {
</pre>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="id0bd5041459fb4d9481379086c63fc9b2" style="position: relative; left: -1000px; width: 1px; height: 1px;">service: StepFunctionsWorkshop

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
                        "Retry": [ {
                            "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
                        } ],
                        "Catch": [ {
                          "ErrorEquals": ["UnprocessableDataException"],
                          "ResultPath": "$.error-info",
                          "Next": "Flag Application As Unprocessable"
                        } ],
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
                        "Retry": [ {
                            "ErrorEquals": [ "Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"]
                        } ],
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
    
➡️ Step 3. Run:

```bash
sls deploy
```

### Try it out

Let’s test out our new error handling capabilities:

➡️ Step 1. Try submitting a new application that contains our simulated unprocessable data for the applicant’s name field. 

Run:

```bash
sls invoke -f SubmitApplication --data='{ "name": "UNPROCESSABLE_DATA", "address": "123 Street" }'
```

➡️ Step 2. Refresh the state machine in the AWS web console, find the most recent execution, and click into it to view its execution details.

Notice that our state machine now shows that it encountered, and handled, an error by transitioning to our new Flag Application As Unprocessable state.

➡️ Step 3. If you like, you can see that our application record was flagged correctly by running this command:

```bash
sls invoke -f FindApplications --data='{ "state": "FLAGGED_WITH_UNPROCESSABLE_DATA" }'
```

![Catching errors](/images/workflow-vis-error-catch.png)

Finally, before we wrap up, there’s one more improvement we can make to our workflow.