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

* Grant the SubmitApplication Lambda function permission to start the execution of our state machine

### Make these changes

➡️ Step 1. Replace `functions/account-applications/submit.js` with <span class="clipBtn clipboard" data-clipboard-target="#id509c5f4da832d190d3285f30d91fd29c3253b6fbcodeaccountapplicationssubmitjs">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-id509c5f4da832d190d3285f30d91fd29c3253b6fbcodeaccountapplicationssubmitjs"></div> <script type="text/template" data-diff-for="diff-id509c5f4da832d190d3285f30d91fd29c3253b6fbcodeaccountapplicationssubmitjs">commit 509c5f4da832d190d3285f30d91fd29c3253b6fb
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
</script>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="id509c5f4da832d190d3285f30d91fd29c3253b6fbcodeaccountapplicationssubmitjs" style="position: relative; left: -1000px; width: 1px; height: 1px;">'use strict';
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

➡️ Step 2. Replace `template.yaml` with <span class="clipBtn clipboard" data-clipboard-target="#idcodevariantstemplateyml1fixingpermissions__templateyamlcodevariantstemplateyml2submitexecutesstepfunction__templateyaml">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-idcodevariantstemplateyml1fixingpermissions__templateyamlcodevariantstemplateyml2submitexecutesstepfunction__templateyaml"></div> <script type="text/template" data-diff-for="diff-idcodevariantstemplateyml1fixingpermissions__templateyamlcodevariantstemplateyml2submitexecutesstepfunction__templateyaml">diff --git a/code/variants/template.yml/1-fixing-permissions__template.yaml b/code/variants/template.yml/2-submit-executes-step-function__template.yaml
index cfd3d70..b9cbc1d 100644
--- a/code/variants/template.yml/1-fixing-permissions__template.yaml
+++ b/code/variants/template.yml/2-submit-executes-step-function__template.yaml
@@ -22,7 +22,7 @@ Resources:
       Runtime: nodejs12.x
       Environment:
         Variables:
-          ACCOUNTS_TABLE_NAME: !Ref ApplicationsTable
+          APPLICATIONS_TABLE_NAME: !Ref ApplicationsTable
       Policies:
         - DynamoDBCrudPolicy:
             TableName: !Ref ApplicationsTable
@@ -44,7 +44,7 @@ Resources:
       Runtime: nodejs12.x
       Environment:
         Variables:
-          ACCOUNTS_TABLE_NAME: !Ref ApplicationsTable
+          APPLICATIONS_TABLE_NAME: !Ref ApplicationsTable
       Policies:
         - DynamoDBCrudPolicy:
             TableName: !Ref ApplicationsTable
@@ -58,7 +58,7 @@ Resources:
       Runtime: nodejs12.x
       Environment:
         Variables:
-          ACCOUNTS_TABLE_NAME: !Ref ApplicationsTable
+          APPLICATIONS_TABLE_NAME: !Ref ApplicationsTable
       Policies:
         - DynamoDBCrudPolicy:
             TableName: !Ref ApplicationsTable
@@ -72,7 +72,7 @@ Resources:
       Runtime: nodejs12.x
       Environment:
         Variables:
-          ACCOUNTS_TABLE_NAME: !Ref ApplicationsTable
+          APPLICATIONS_TABLE_NAME: !Ref ApplicationsTable
       Policies:
         - DynamoDBCrudPolicy:
             TableName: !Ref ApplicationsTable
@@ -86,10 +86,13 @@ Resources:
       Runtime: nodejs12.x
       Environment:
         Variables:
-          ACCOUNTS_TABLE_NAME: !Ref ApplicationsTable
+          APPLICATIONS_TABLE_NAME: !Ref ApplicationsTable
+          APPLICATION_PROCESSING_STEP_FUNCTION_ARN: !Ref ApplicationProcessingStateMachine
       Policies:
         - DynamoDBCrudPolicy:
             TableName: !Ref ApplicationsTable
+        - StepFunctionsExecutionPolicy:
+            StateMachineName: !GetAtt ApplicationProcessingStateMachine.Name
 
   ApplicationsTable:
     Type: 'AWS::DynamoDB::Table'
</script>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="idcodevariantstemplateyml1fixingpermissions__templateyamlcodevariantstemplateyml2submitexecutesstepfunction__templateyaml" style="position: relative; left: -1000px; width: 1px; height: 1px;">AWSTemplateFormatVersion: "2010-09-09"
Transform: AWS::Serverless-2016-10-31
Description: Template for step-functions-workshop

Resources:
  ApplicationProcessingStateMachine:
    Type: AWS::Serverless::StateMachine
    Properties:
      DefinitionUri: statemachine/account-application-workflow.asl.json
      DefinitionSubstitutions:
        DataCheckingFunctionArn: !GetAtt DataCheckingFunction.Arn
      Policies:
        - LambdaInvokePolicy:
            FunctionName: !Ref DataCheckingFunction

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

➡️ Step 3. Run:

```bash
sam build && sam deploy
```


Now that we’ve integrated our Account Applications service with our processing workflow state machine, we’ll trigger all future state machine executions by submitting new applications to the service (by invoking our SubmitApplication function), rather than executing the state machine directly with arbitrary input in the web console. 

### Try it out

➡️ Step 1. Run:

```bash
aws lambda invoke --function-name sfn-workshop-SubmitApplication --payload '{ "name": "Spock", "address": "AnInvalidAddress" }' /dev/stdout 
```

➡️ Step 2. Go back to the step functions web console’s detail view for our state machine and look for a new execution at the top of the list. It should have a timestamp close to right now and it will contain a name that starts with ‘ApplicationID-’. If you click in to view the details of this execution, you should see it also take the Pending Review path, as we expect (because we submitted an invalid address), and you should also be able to see an `id` attribute on the application input passed in, and through, the state machine’s steps.

Now that we know we're passing an application ID to the step function successfully, we're ready to have our Pending Review state notify our Account Applications service whenever it wants to flag an application and pause its workflow processing the application until a human makes a decision about it.