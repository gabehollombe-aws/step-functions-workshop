+++
title = "Finishing the workflow"
chapter = false
weight = 30
+++

## Approving and rejecting account applications

Until now, we’ve left the Approve Application state empty, using the Pass state as a kind of placeholder reminding us to implement the step later. And we just added another placeholder state for Reject Application, too.  Let’s finish our workflow by replacing these Pass states with Task states that invoke appropriate Lambda functions.


### In this step, we will

* Update our state machine, changing the Approve Application and Reject Application states from placeholder Pass state types to Task types that invoke the appropriate Lambda functions in the Data Checking service

* Grant additional permissions to the IAM role that the step function executes under so that it can invoke the necessary Lambda functions from the Account Applications service


### Make these changes

➡️ Step 1. Replace `statemachine/account-application-workflow.asl.json` with <span class="clipBtn clipboard" data-clipboard-target="#idcodevariantsstatemachine4integratecallbackfromreview__accountapplicationworkflowasljsoncodevariantsstatemachine5addapprovereject__accountapplicationworkflowasljson">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-idcodevariantsstatemachine4integratecallbackfromreview__accountapplicationworkflowasljsoncodevariantsstatemachine5addapprovereject__accountapplicationworkflowasljson"></div> <script type="text/template" data-diff-for="diff-idcodevariantsstatemachine4integratecallbackfromreview__accountapplicationworkflowasljsoncodevariantsstatemachine5addapprovereject__accountapplicationworkflowasljson">diff --git a/code/variants/statemachine/4-integrate-callback-from-review__account-application-workflow.asl.json b/code/variants/statemachine/5-add-approve-reject__account-application-workflow.asl.json
index b61bc94..fe142b0 100644
--- a/code/variants/statemachine/4-integrate-callback-from-review__account-application-workflow.asl.json
+++ b/code/variants/statemachine/5-add-approve-reject__account-application-workflow.asl.json
@@ -71,11 +71,19 @@
             ]
         },
         "Reject Application": {
-            "Type": "Pass",
+            "Type": "Task",
+            "Parameters": {
+                "id.$": "$.application.id"
+            },
+            "Resource": "${RejectApplicationFunctionArn}",
             "End": true
         },
         "Approve Application": {
-            "Type": "Pass",
+            "Type": "Task",
+            "Parameters": {
+                "id.$": "$.application.id"
+            },
+            "Resource": "${ApproveApplicationFunctionArn}",
             "End": true
         }
     }
</script>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="idcodevariantsstatemachine4integratecallbackfromreview__accountapplicationworkflowasljsoncodevariantsstatemachine5addapprovereject__accountapplicationworkflowasljson" style="position: relative; left: -1000px; width: 1px; height: 1px;">{
    "StartAt": "Check Name",
    "States": {
        "Check Name": {
            "Type": "Task",
            "Parameters": {
                "command": "CHECK_NAME",
                "data": {
                    "name.$": "$.application.name"
                }
            },
            "Resource": "${DataCheckingFunctionArn}",
            "ResultPath": "$.checks.name",
            "Next": "Check Address"
        },
        "Check Address": {
            "Type": "Task",
            "Parameters": {
                "command": "CHECK_ADDRESS",
                "data": {
                    "address.$": "$.application.address"
                }
            },
            "Resource": "${DataCheckingFunctionArn}",
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
                "FunctionName": "${FlagApplicationFunctionName}",
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
            "Choices": [
                {
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
            "Resource": "${RejectApplicationFunctionArn}",
            "End": true
        },
        "Approve Application": {
            "Type": "Task",
            "Parameters": {
                "id.$": "$.application.id"
            },
            "Resource": "${ApproveApplicationFunctionArn}",
            "End": true
        }
    }
}
</textarea>
{{< /safehtml >}}

➡️ Step 2. Replace `template.yaml` with <span class="clipBtn clipboard" data-clipboard-target="#idcodevariantstemplateyml3addreviewapplication__templateyamlcodevariantstemplateyml4passapproverejecttosfn__templateyaml">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-idcodevariantstemplateyml3addreviewapplication__templateyamlcodevariantstemplateyml4passapproverejecttosfn__templateyaml"></div> <script type="text/template" data-diff-for="diff-idcodevariantstemplateyml3addreviewapplication__templateyamlcodevariantstemplateyml4passapproverejecttosfn__templateyaml">diff --git a/code/variants/template.yml/3-add-review-application__template.yaml b/code/variants/template.yml/4-pass-approve-reject-to-sfn__template.yaml
index 497d8c4..4d7e0f2 100644
--- a/code/variants/template.yml/3-add-review-application__template.yaml
+++ b/code/variants/template.yml/4-pass-approve-reject-to-sfn__template.yaml
@@ -10,11 +10,17 @@ Resources:
       DefinitionSubstitutions:
         DataCheckingFunctionArn: !GetAtt DataCheckingFunction.Arn
         FlagApplicationFunctionName: !Ref FlagApplicationFunction
+        ApproveApplicationFunctionArn: !GetAtt ApproveApplicationFunction.Arn
+        RejectApplicationFunctionArn: !GetAtt RejectApplicationFunction.Arn
       Policies:
         - LambdaInvokePolicy:
             FunctionName: !Ref DataCheckingFunction
         - LambdaInvokePolicy:
             FunctionName: !Ref FlagApplicationFunction
+        - LambdaInvokePolicy:
+            FunctionName: !Ref ApproveApplicationFunction
+        - LambdaInvokePolicy:
+            FunctionName: !Ref RejectApplicationFunction
 
   ApproveApplicationFunction:
     Type: AWS::Serverless::Function
</script>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="idcodevariantstemplateyml3addreviewapplication__templateyamlcodevariantstemplateyml4passapproverejecttosfn__templateyaml" style="position: relative; left: -1000px; width: 1px; height: 1px;">AWSTemplateFormatVersion: "2010-09-09"
Transform: AWS::Serverless-2016-10-31
Description: Template for step-functions-workshop

Resources:
  ApplicationProcessingStateMachine:
    Type: AWS::Serverless::StateMachine
    Properties:
      DefinitionUri: statemachine/account-application-workflow.asl.json
      DefinitionSubstitutions:
        DataCheckingFunctionArn: !GetAtt DataCheckingFunction.Arn
        FlagApplicationFunctionName: !Ref FlagApplicationFunction
        ApproveApplicationFunctionArn: !GetAtt ApproveApplicationFunction.Arn
        RejectApplicationFunctionArn: !GetAtt RejectApplicationFunction.Arn
      Policies:
        - LambdaInvokePolicy:
            FunctionName: !Ref DataCheckingFunction
        - LambdaInvokePolicy:
            FunctionName: !Ref FlagApplicationFunction
        - LambdaInvokePolicy:
            FunctionName: !Ref ApproveApplicationFunction
        - LambdaInvokePolicy:
            FunctionName: !Ref RejectApplicationFunction

  ApproveApplicationFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: sfn-workshop-ApproveApplication
      CodeUri: functions/account-applications/
      Handler: approve.handler
      Runtime: nodejs12.x
      Environment:
        Variables:
          ACCOUNTS_TABLE_NAME: !Ref ApplicationsTable
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref ApplicationsTable

  DataCheckingFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: sfn-workshop-DataChecking
      CodeUri: functions/data-checking/
      Handler: data-checking.handler
      Runtime: nodejs12.x

  FindApplicationsFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: sfn-workshop-FindApplications
      CodeUri: functions/account-applications/
      Handler: find.handler
      Runtime: nodejs12.x
      Environment:
        Variables:
          ACCOUNTS_TABLE_NAME: !Ref ApplicationsTable
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref ApplicationsTable

  FlagApplicationFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: sfn-workshop-FlagApplication
      CodeUri: functions/account-applications/
      Handler: flag.handler
      Runtime: nodejs12.x
      Environment:
        Variables:
          ACCOUNTS_TABLE_NAME: !Ref ApplicationsTable
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref ApplicationsTable

  RejectApplicationFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: sfn-workshop-RejectApplication
      CodeUri: functions/account-applications/
      Handler: reject.handler
      Runtime: nodejs12.x
      Environment:
        Variables:
          ACCOUNTS_TABLE_NAME: !Ref ApplicationsTable
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref ApplicationsTable

  ReviewApplicationFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: sfn-workshop-ReviewApplication
      CodeUri: functions/account-applications/
      Handler: review.handler
      Runtime: nodejs12.x
      Environment:
        Variables:
          ACCOUNTS_TABLE_NAME: !Ref ApplicationsTable
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref ApplicationsTable
        - Statement:
          - Sid: AllowCallbacksToStateMachinePolicy
            Effect: "Allow"
            Action:
              - "states:SendTaskSuccess"
              - "states:SendTaskFailure"
            Resource: !Ref ApplicationProcessingStateMachine

  SubmitApplicationFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: sfn-workshop-SubmitApplication
      CodeUri: functions/account-applications/
      Handler: submit.handler
      Runtime: nodejs12.x
      Environment:
        Variables:
          ACCOUNTS_TABLE_NAME: !Ref ApplicationsTable
          APPLICATION_PROCESSING_STEP_FUNCTION_ARN: !Ref ApplicationProcessingStateMachine
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref ApplicationsTable
        - StepFunctionsExecutionPolicy:
            StateMachineName: !GetAtt ApplicationProcessingStateMachine.Name

  ApplicationsTable:
    Type: 'AWS::DynamoDB::Table'
    Properties:
      TableName: !Sub StepFunctionWorkshop-AccountApplications-${AWS::StackName}
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
Outputs:
  SubmitApplicationFunctionArn:
    Description: "Submit Application Function ARN"
    Value: !GetAtt SubmitApplicationFunction.Arn
  FlagApplicationFunctionArn:
    Description: "Flag Application Function ARN"
    Value: !GetAtt FlagApplicationFunction.Arn
  FindApplicationsFunctionArn:
    Description: "Find Applications Function ARN"
    Value: !GetAtt FlagApplicationFunction.Arn
  ApproveApplicationFunctionArn:
    Description: "Approve Application Function ARN"
    Value: !GetAtt FlagApplicationFunction.Arn
  RejectApplicationFunctionArn:
    Description: "Reject Application Function ARN"
    Value: !GetAtt FlagApplicationFunction.Arn
  DataCheckingFunctionArn:
    Description: "Data Checking Function ARN"
    Value: !GetAtt DataCheckingFunction.Arn
</textarea>
{{< /safehtml >}}

➡️ Step 3. Run:

```bash
sam build && sam deploy
```



With that deploy done, the first fully-working version of our example workflow is complete!  We could take the time now to try another full run through of our workflow and seeing if our application records end up with APPROVED or REJECTED states, but let's hold off on this for now since it's not *that* interesting and we still have room for a bit of improvement in our solution. Specifically, how should we handle errors when things go wrong?
