+++
title = "Pausing an execution and waiting for an external callback"
chapter = false
weight = 20
+++

Step Functions does its work by integrating with various AWS services directly, and you can control these AWS services using three different service integration patterns: 

* **Call a service and let Step Functions progress to the next state immediately after it gets an HTTP response.**

    You’ve already seen this integration type in action. It’s what we’re using to call the Data Checking Lambda function and get back a response.
    
* **Call a service and have Step Functions wait for a job to complete.**
    
    This is most commonly used for triggering batch style workloads, pausing, then resuming execution after the job completes. We won’t use this style of service integration in this workshop.
    
* **Call a service with a task token and have Step Functions wait until that token is returned along with a payload.**
    
    This is the integration pattern we want to use here, since we want to make a service call, and then wait for an asynchronous callback to arrive sometime in the future, and then resume execution.


Callback tasks provide a way to pause a workflow until a task token is returned. A task might need to wait for a human approval, integrate with a third party, or call legacy systems. For tasks like these, you can pause a Step Function execution and wait for an external process or workflow to complete.

In these situations, you can instruct a Task state to generate a unique task token (a unique ID that references a specific Task state in a specific execution), invoke your desired AWS service call, and then pause execution until the Step Functions  service receives that task token back via an API call from some other process.

We’ll need to make a few updates to our workflow in order for this to work. 

### In this step, we will

* Make our Pending Review state invoke our Account Applications Lambda function using a slightly different Task state definition syntax which includes a `.waitForTaskToken` suffix. This will generate a task token which we can pass on to the Account Applications service along with the application ID that we want to flag for review. 

* Make the Account Applications Lambda function update the application record to mark it as pending review and storing the taskToken alongside the record. Then, once a human reviews the pending application, the Account Applications service will make a callback to the Step Functions API, calling the SendTaskSuccesss endpoint, passing back the task token along with the relevant output from this step which, in our case, will be data to indicate if the human approved or rejected the application. This information will let the state machine decide what to do next based on what decision the human made.

* Create a new ReviewApplication Lambda function (and the necessary IAM permissions for it) to implement logic allowing a human to make a decision for an application that's flagged for review, calling back to the Step Functions API with the result of the human decision

* Add another Choice state called 'Review Approved?' that will examine the output from the Pending Review state and transition to the Approve Application state or a Reject Application state (which we’ll also add now).



### Make these changes

➡️ Step 1. Replace `functions/account-applications/flag.js` with <span class="clipBtn clipboard" data-clipboard-target="#idsam_templatefunctionsaccountapplicationsflagjscodefinalaccountapplicationsflagjs">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-idsam_templatefunctionsaccountapplicationsflagjscodefinalaccountapplicationsflagjs"></div> <script type="text/template" data-diff-for="diff-idsam_templatefunctionsaccountapplicationsflagjscodefinalaccountapplicationsflagjs">diff --git a/sam_template/functions/account-applications/flag.js b/code/final/account-applications/flag.js
index 391c468..9096632 100644
--- a/sam_template/functions/account-applications/flag.js
+++ b/code/final/account-applications/flag.js
@@ -10,7 +10,7 @@ const dynamo = new AWS.DynamoDB.DocumentClient();
 const AccountApplications = require('./AccountApplications')(APPLICATIONS_TABLE_NAME, dynamo)
 
 const flagForReview = async (data) => {
-    const { id, flagType } = data
+    const { id, flagType, taskToken } = data
 
     if (flagType !== 'REVIEW' && flagType !== 'UNPROCESSABLE_DATA') {
         throw new Error("flagType must be REVIEW or UNPROCESSABLE_DATA")
@@ -32,6 +32,7 @@ const flagForReview = async (data) => {
         {
             state: newState,
             reason,
+            taskToken
         }
     )
     return updatedApplication
</script>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="idsam_templatefunctionsaccountapplicationsflagjscodefinalaccountapplicationsflagjs" style="position: relative; left: -1000px; width: 1px; height: 1px;">'use strict';
const REGION = process.env.REGION
const APPLICATIONS_TABLE_NAME = process.env.APPLICATIONS_TABLE_NAME

const AWS = require('aws-sdk')
AWS.config.update({region: REGION});

const dynamo = new AWS.DynamoDB.DocumentClient();

const AccountApplications = require('./AccountApplications')(APPLICATIONS_TABLE_NAME, dynamo)

const flagForReview = async (data) => {
    const { id, flagType, taskToken } = data

    if (flagType !== 'REVIEW' && flagType !== 'UNPROCESSABLE_DATA') {
        throw new Error("flagType must be REVIEW or UNPROCESSABLE_DATA")
    }

    let newState
    let reason
    if (flagType === 'REVIEW') {
        newState = 'FLAGGED_FOR_REVIEW'
        reason = data.reason
    }
    else {
        reason = JSON.parse(data.errorInfo.Cause).errorMessage
        newState = 'FLAGGED_WITH_UNPROCESSABLE_DATA'
    }

    const updatedApplication = await AccountApplications.update(
        id,
        {
            state: newState,
            reason,
            taskToken
        }
    )
    return updatedApplication
}

module.exports.handler = async(event) => {
    try {
        const result = await flagForReview(event)
        return result
    } catch (ex) {
        console.error(ex)
        console.info('event', JSON.stringify(event))
        throw ex
    }
};
</textarea>
{{< /safehtml >}}

➡️ Step 2. Run:
```bash
touch functions/account-applications/review.js
```

➡️ Step 3. Replace `functions/account-applications/review.js` with <span class="clipBtn clipboard" data-clipboard-target="#idsam_templatefunctionsaccountapplicationscodefinalaccountapplicationsreviewjs">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-idsam_templatefunctionsaccountapplicationscodefinalaccountapplicationsreviewjs"></div> <script type="text/template" data-diff-for="diff-idsam_templatefunctionsaccountapplicationscodefinalaccountapplicationsreviewjs">diff --git a/code/final/account-applications/review.js b/code/final/account-applications/review.js
new file mode 100644
index 0000000..1923429
--- /dev/null
+++ b/code/final/account-applications/review.js
@@ -0,0 +1,47 @@
+'use strict';
+const REGION = process.env.REGION
+const APPLICATIONS_TABLE_NAME = process.env.APPLICATIONS_TABLE_NAME
+
+const AWS = require('aws-sdk')
+AWS.config.update({region: REGION});
+
+const dynamo = new AWS.DynamoDB.DocumentClient();
+const stepfunctions = new AWS.StepFunctions();
+
+const AccountApplications = require('./AccountApplications')(APPLICATIONS_TABLE_NAME, dynamo)
+
+const updateApplicationWithDecision = (id, decision) => {
+    if (decision !== 'APPROVE' && decision !== 'REJECT') {
+        throw new Error("Required `decision` parameter must be 'APPROVE' or 'REJECT'")
+    }
+
+    switch(decision) {
+        case 'APPROVE': return AccountApplications.update(id, { state: 'REVIEW_APPROVED' })
+        case 'REJECT': return AccountApplications.update(id, { state: 'REVIEW_REJECTED' })
+    }
+}
+
+const updateWorkflowWithReviewDecision = async (data) => {
+    const { id, decision } = data
+
+    const updatedApplication = await updateApplicationWithDecision(id, decision)
+
+    let params = {
+        output: JSON.stringify({ decision }),
+        taskToken: updatedApplication.taskToken
+    };
+    await stepfunctions.sendTaskSuccess(params).promise()
+
+    return updatedApplication
+}
+
+module.exports.handler = async(event) => {
+    try {
+        const result = await updateWorkflowWithReviewDecision(event)
+        return result
+    } catch (ex) {
+        console.error(ex)
+        console.info('event', JSON.stringify(event))
+        throw ex
+    }
+};
\ No newline at end of file
</script>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="idsam_templatefunctionsaccountapplicationscodefinalaccountapplicationsreviewjs" style="position: relative; left: -1000px; width: 1px; height: 1px;">'use strict';
const REGION = process.env.REGION
const APPLICATIONS_TABLE_NAME = process.env.APPLICATIONS_TABLE_NAME

const AWS = require('aws-sdk')
AWS.config.update({region: REGION});

const dynamo = new AWS.DynamoDB.DocumentClient();
const stepfunctions = new AWS.StepFunctions();

const AccountApplications = require('./AccountApplications')(APPLICATIONS_TABLE_NAME, dynamo)

const updateApplicationWithDecision = (id, decision) => {
    if (decision !== 'APPROVE' && decision !== 'REJECT') {
        throw new Error("Required `decision` parameter must be 'APPROVE' or 'REJECT'")
    }

    switch(decision) {
        case 'APPROVE': return AccountApplications.update(id, { state: 'REVIEW_APPROVED' })
        case 'REJECT': return AccountApplications.update(id, { state: 'REVIEW_REJECTED' })
    }
}

const updateWorkflowWithReviewDecision = async (data) => {
    const { id, decision } = data

    const updatedApplication = await updateApplicationWithDecision(id, decision)

    let params = {
        output: JSON.stringify({ decision }),
        taskToken: updatedApplication.taskToken
    };
    await stepfunctions.sendTaskSuccess(params).promise()

    return updatedApplication
}

module.exports.handler = async(event) => {
    try {
        const result = await updateWorkflowWithReviewDecision(event)
        return result
    } catch (ex) {
        console.error(ex)
        console.info('event', JSON.stringify(event))
        throw ex
    }
};
</textarea>
{{< /safehtml >}}

➡️ Step 4. Replace `template.yaml` with <span class="clipBtn clipboard" data-clipboard-target="#idcodevariantstemplateyml2submitexecutesstepfunction__templateyamlcodevariantstemplateyml3addreviewapplication__templateyaml">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-idcodevariantstemplateyml2submitexecutesstepfunction__templateyamlcodevariantstemplateyml3addreviewapplication__templateyaml"></div> <script type="text/template" data-diff-for="diff-idcodevariantstemplateyml2submitexecutesstepfunction__templateyamlcodevariantstemplateyml3addreviewapplication__templateyaml">diff --git a/code/variants/template.yml/2-submit-executes-step-function__template.yaml b/code/variants/template.yml/3-add-review-application__template.yaml
index b9cbc1d..272c2b5 100644
--- a/code/variants/template.yml/2-submit-executes-step-function__template.yaml
+++ b/code/variants/template.yml/3-add-review-application__template.yaml
@@ -9,9 +9,12 @@ Resources:
       DefinitionUri: statemachine/account-application-workflow.asl.json
       DefinitionSubstitutions:
         DataCheckingFunctionArn: !GetAtt DataCheckingFunction.Arn
+        FlagApplicationFunctionName: !Ref FlagApplicationFunction
       Policies:
         - LambdaInvokePolicy:
             FunctionName: !Ref DataCheckingFunction
+        - LambdaInvokePolicy:
+            FunctionName: !Ref FlagApplicationFunction
 
   ApproveApplicationFunction:
     Type: AWS::Serverless::Function
@@ -77,6 +80,27 @@ Resources:
         - DynamoDBCrudPolicy:
             TableName: !Ref ApplicationsTable
 
+  ReviewApplicationFunction:
+    Type: AWS::Serverless::Function
+    Properties:
+      FunctionName: sfn-workshop-ReviewApplication
+      CodeUri: functions/account-applications/
+      Handler: review.handler
+      Runtime: nodejs12.x
+      Environment:
+        Variables:
+          APPLICATIONS_TABLE_NAME: !Ref ApplicationsTable
+      Policies:
+        - DynamoDBCrudPolicy:
+            TableName: !Ref ApplicationsTable
+        - Statement:
+          - Sid: AllowCallbacksToStateMachinePolicy
+            Effect: "Allow"
+            Action:
+              - "states:SendTaskSuccess"
+              - "states:SendTaskFailure"
+            Resource: !Ref ApplicationProcessingStateMachine
+
   SubmitApplicationFunction:
     Type: AWS::Serverless::Function
     Properties:
</script>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="idcodevariantstemplateyml2submitexecutesstepfunction__templateyamlcodevariantstemplateyml3addreviewapplication__templateyaml" style="position: relative; left: -1000px; width: 1px; height: 1px;">AWSTemplateFormatVersion: "2010-09-09"
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
      Policies:
        - LambdaInvokePolicy:
            FunctionName: !Ref DataCheckingFunction
        - LambdaInvokePolicy:
            FunctionName: !Ref FlagApplicationFunction

  ApproveApplicationFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: sfn-workshop-ApproveApplication
      CodeUri: functions/account-applications/
      Handler: approve.handler
      Runtime: nodejs12.x
      Environment:
        Variables:
          APPLICATIONS_TABLE_NAME: !Ref ApplicationsTable
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
          APPLICATIONS_TABLE_NAME: !Ref ApplicationsTable
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
          APPLICATIONS_TABLE_NAME: !Ref ApplicationsTable
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
          APPLICATIONS_TABLE_NAME: !Ref ApplicationsTable
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
          APPLICATIONS_TABLE_NAME: !Ref ApplicationsTable
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
          APPLICATIONS_TABLE_NAME: !Ref ApplicationsTable
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

➡️ Step 5. Replace `statemachine/account-application-workflow.asl.json` with <span class="clipBtn clipboard" data-clipboard-target="#idcodevariantsstatemachine3addreviewrequired__accountapplicationworkflowasljsoncodevariantsstatemachine4integratecallbackfromreview__accountapplicationworkflowasljson">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-idcodevariantsstatemachine3addreviewrequired__accountapplicationworkflowasljsoncodevariantsstatemachine4integratecallbackfromreview__accountapplicationworkflowasljson"></div> <script type="text/template" data-diff-for="diff-idcodevariantsstatemachine3addreviewrequired__accountapplicationworkflowasljsoncodevariantsstatemachine4integratecallbackfromreview__accountapplicationworkflowasljson">diff --git a/code/variants/statemachine/3-add-review-required__account-application-workflow.asl.json b/code/variants/statemachine/4-integrate-callback-from-review__account-application-workflow.asl.json
index 79596f9..b61bc94 100644
--- a/code/variants/statemachine/3-add-review-required__account-application-workflow.asl.json
+++ b/code/variants/statemachine/4-integrate-callback-from-review__account-application-workflow.asl.json
@@ -42,6 +42,35 @@
             "Default": "Approve Application"
         },
         "Pending Review": {
+            "Type": "Task",
+            "Resource": "arn:aws:states:::lambda:invoke.waitForTaskToken",
+            "Parameters": {
+                "FunctionName": "${FlagApplicationFunctionName}",
+                "Payload": {
+                    "id.$": "$.application.id",
+                    "flagType": "REVIEW",
+                    "taskToken.$": "$$.Task.Token"
+                }
+            },
+            "ResultPath": "$.review",
+            "Next": "Review Approved?"
+        },
+        "Review Approved?": {
+            "Type": "Choice",
+            "Choices": [
+                {
+                    "Variable": "$.review.decision",
+                    "StringEquals": "APPROVE",
+                    "Next": "Approve Application"
+                },
+                {
+                    "Variable": "$.review.decision",
+                    "StringEquals": "REJECT",
+                    "Next": "Reject Application"
+                }
+            ]
+        },
+        "Reject Application": {
             "Type": "Pass",
             "End": true
         },
</script>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="idcodevariantsstatemachine3addreviewrequired__accountapplicationworkflowasljsoncodevariantsstatemachine4integratecallbackfromreview__accountapplicationworkflowasljson" style="position: relative; left: -1000px; width: 1px; height: 1px;">{
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
            "Type": "Pass",
            "End": true
        },
        "Approve Application": {
            "Type": "Pass",
            "End": true
        }
    }
}
</textarea>
{{< /safehtml >}}

➡️ Step 6. Run:

```bash
sam build && sam deploy
```

### Try it out

Now we should be able to submit an invalid application, see that our application gets flagged for review, manually approve or reject the review, and then see our review decision feed back into the state machine for continued execution.

Let’s test this:

➡️ Step 1. Submit an invalid application with a bad address so it gets flagged. Run:

```bash
aws lambda invoke --function-name sfn-workshop-SubmitApplication --payload '{ "name": "Spock", "address": "InvalidAddressFormat" }' /dev/stdout 
```

➡️ Step 2. Check to see that our application is flagged for review. Run:

```bash
aws lambda invoke --function-name sfn-workshop-FindApplications --payload '{ "state": "FLAGGED_FOR_REVIEW" }' /dev/stdout 
```

➡️ Step 3. Copy the application’s ID from the results, which we’ll use in a step below to provide a review decision for the application.

➡️ Step 4. In Step Functions web console, refresh the details page for our state machine, and look for the most recent execution. You should see that it is labeled as ‘Running’. 

➡️ Step 5. Click in to the running execution and you’ll see in the visualization section that the Pending Review state is in-progress. This is the state machine indicating that it’s now paused and waiting for a callback before it will resume execution.

➡️ Step 6. To trigger this callback that it’s waiting for, act as a human reviewer and approve the review (we haven't built a web interface for this, so we'll just invoke another function in the Account Applications service. Take care to paste the ID you copied in Step 3 above into this command when you run it, replacing REPLACE_WITH_APPLICATION_ID. 

Run with replacement:

```bash
aws lambda invoke --function-name sfn-workshop-ReviewApplication --payload '{ "id": "REPLACE_WITH_APPLICATION_ID", "decision": "APPROVE" }' /dev/stdout 
```

➡️ Step 7. Go back to the execution details page in the Step Functions web console (you shouldn’t need to refresh it), and notice that the execution resumed and, because we approved the review, the state machine transitioned into the Approve Application state after examining the input provided to it by our callback.  You can click on the the ‘Review Approved?‘ step to see our review decision passed into the step’s input (via the SendTaskSuccess callback that `functions/account-applications/review.js` called).


Pretty cool, right?

Finally, all we need to do to finish implementing our example workflow is to replace our Approve Application and Reject Application steps.  Currently they’re just placeholder Pass states, so let’s update them with Task states that will invoke the ApproveApplication and RejectApplication Lambda functions we’ve created..