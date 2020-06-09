+++
title = "Fixing Permissions"
chapter = false
weight = 40
+++

Rather than continue to work in the web console and make these fixes by hand, we’ll return to our `template.yml` file to define our state machine alongside the other resources used in this workshop, and we’ll take care to also set up the appropriate permissions for this state machine to execute successfully.

### In this step, we will

* Define our new AWS Step Functions state machine inside `template.yml`

* Add a new IAM role for our state machine to assume when it executes. The role grants permission for the state machine to invoke our Data Checking Lambda function.

### Make these changes

Before we migrate our step function definition over to our `template.yml` file, we should delete the state machine we’ve been interacting with in the Step Functions web console so that we don’t get confused when a similar state machine is deployed as part of our Serverless stack deployment.

➡️ Step 1. In the left sidebar of the Step Functions web console, click ‘State machines’

➡️ Step 2. Select the state machne that we manually defined earlier, click ‘Delete’, and click ‘Delete state machine’ to confirm the deletion.

➡️ Step 3. Now, let’s re-define our state machine inside our `template.yaml` file. Replace `template.yml` with <span class="clipBtn clipboard" data-clipboard-target="#ida0d7df16df74104c36cb221ee8f4f61bab25ef76codevariantstemplateyml1fixingpermissions__templateyaml">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-ida0d7df16df74104c36cb221ee8f4f61bab25ef76codevariantstemplateyml1fixingpermissions__templateyaml"></div> <script type="text/template" data-diff-for="diff-ida0d7df16df74104c36cb221ee8f4f61bab25ef76codevariantstemplateyml1fixingpermissions__templateyaml">commit a0d7df16df74104c36cb221ee8f4f61bab25ef76
Author: Gabe Hollombe <gabe@avantbard.com>
Date:   Tue Jun 9 13:55:58 2020 +0800

    progress porting to SAM

diff --git a/code/variants/template.yml/1-fixing-permissions__template.yaml b/code/variants/template.yml/1-fixing-permissions__template.yaml
new file mode 100644
index 0000000..1261b13
--- /dev/null
+++ b/code/variants/template.yml/1-fixing-permissions__template.yaml
@@ -0,0 +1,137 @@
+AWSTemplateFormatVersion: "2010-09-09"
+Transform: AWS::Serverless-2016-10-31
+Description: Template for step-functions-workshop
+
+Resources:
+  ApplicationProcessingStateMachine:
+    Type: AWS::Serverless::StateMachine
+    Properties:
+      DefinitionUri: statemachine/account-application-workflow.asl.json
+      DefinitionSubstitutions:
+        DataCheckingFunctionArn: !GetAtt DataCheckingFunction.Arn
+      Policies:
+        - LambdaInvokePolicy:
+            FunctionName: !Ref DataCheckingFunction
+
+  ApproveApplicationFunction:
+    Type: AWS::Serverless::Function
+    Properties:
+      FunctionName: sfn-workshop-ApproveApplication
+      CodeUri: functions/account-applications/
+      Handler: approve.handler
+      Runtime: nodejs12.x
+      Environment:
+        Variables:
+          ACCOUNTS_TABLE_NAME: !Ref ApplicationsTable
+      Policies:
+        - DynamoDBCrudPolicy:
+            TableName: !Ref ApplicationsTable
+
+  DataCheckingFunction:
+    Type: AWS::Serverless::Function
+    Properties:
+      FunctionName: sfn-workshop-DataChecking
+      CodeUri: functions/data-checking/
+      Handler: data-checking.handler
+      Runtime: nodejs12.x
+
+  FindApplicationsFunction:
+    Type: AWS::Serverless::Function
+    Properties:
+      FunctionName: sfn-workshop-FindApplications
+      CodeUri: functions/account-applications/
+      Handler: find.handler
+      Runtime: nodejs12.x
+      Environment:
+        Variables:
+          ACCOUNTS_TABLE_NAME: !Ref ApplicationsTable
+      Policies:
+        - DynamoDBCrudPolicy:
+            TableName: !Ref ApplicationsTable
+
+  FlagApplicationFunction:
+    Type: AWS::Serverless::Function
+    Properties:
+      FunctionName: sfn-workshop-FlagApplication
+      CodeUri: functions/account-applications/
+      Handler: flag.handler
+      Runtime: nodejs12.x
+      Environment:
+        Variables:
+          ACCOUNTS_TABLE_NAME: !Ref ApplicationsTable
+      Policies:
+        - DynamoDBWritePolicy:
+            TableName: !Ref ApplicationsTable
+
+  RejectApplicationFunction:
+    Type: AWS::Serverless::Function
+    Properties:
+      FunctionName: sfn-workshop-RejectApplication
+      CodeUri: functions/account-applications/
+      Handler: reject.handler
+      Runtime: nodejs12.x
+      Environment:
+        Variables:
+          ACCOUNTS_TABLE_NAME: !Ref ApplicationsTable
+      Policies:
+        - DynamoDBWritePolicy:
+            TableName: !Ref ApplicationsTable
+
+  SubmitApplicationFunction:
+    Type: AWS::Serverless::Function
+    Properties:
+      FunctionName: sfn-workshop-SubmitApplication
+      CodeUri: functions/account-applications/
+      Handler: submit.handler
+      Runtime: nodejs12.x
+      Environment:
+        Variables:
+          ACCOUNTS_TABLE_NAME: !Ref ApplicationsTable
+      Policies:
+        - DynamoDBCrudPolicy:
+            TableName: !Ref ApplicationsTable
+
+  ApplicationsTable:
+    Type: 'AWS::DynamoDB::Table'
+    Properties:
+      TableName: !Sub StepFunctionWorkshop-AccountApplications-${AWS::StackName}
+      AttributeDefinitions:
+        -
+          AttributeName: id
+          AttributeType: S
+        -
+          AttributeName: state
+          AttributeType: S
+      KeySchema:
+        -
+          AttributeName: id
+          KeyType: HASH
+      BillingMode: PAY_PER_REQUEST
+      GlobalSecondaryIndexes:
+          -
+              IndexName: state
+              KeySchema:
+                  -
+                      AttributeName: state
+                      KeyType: HASH
+              Projection:
+                  ProjectionType: ALL
+Outputs:
+  SubmitApplicationFunctionArn:
+    Description: "Submit Application Function ARN"
+    Value: !GetAtt SubmitApplicationFunction.Arn
+  FlagApplicationFunctionArn:
+    Description: "Flag Application Function ARN"
+    Value: !GetAtt FlagApplicationFunction.Arn
+  FindApplicationsFunctionArn:
+    Description: "Find Applications Function ARN"
+    Value: !GetAtt FlagApplicationFunction.Arn
+  ApproveApplicationFunctionArn:
+    Description: "Approve Application Function ARN"
+    Value: !GetAtt FlagApplicationFunction.Arn
+  RejectApplicationFunctionArn:
+    Description: "Reject Application Function ARN"
+    Value: !GetAtt FlagApplicationFunction.Arn
+  DataCheckingFunctionArn:
+    Description: "Data Checking Function ARN"
+    Value: !GetAtt DataCheckingFunction.Arn
\ No newline at end of file
</script>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="ida0d7df16df74104c36cb221ee8f4f61bab25ef76codevariantstemplateyml1fixingpermissions__templateyaml" style="position: relative; left: -1000px; width: 1px; height: 1px;">AWSTemplateFormatVersion: "2010-09-09"
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
        - DynamoDBWritePolicy:
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
        - DynamoDBWritePolicy:
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
          ACCOUNTS_TABLE_NAME: !Ref ApplicationsTable
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref ApplicationsTable

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

➡️ Step 4. From inside `workshop-dir` run:
```bash
mkdir -p statemachine && pushd statemachine && touch account-application-workflow.asl.json && popd
```

This will create a `statemachine/account-application-workflow.asl.json` inside `workshop-dir`.

➡️ Step 5. Replace `statemachine/account-application-workflow.asl.json` with <span class="clipBtn clipboard" data-clipboard-target="#ida0d7df16df74104c36cb221ee8f4f61bab25ef76codevariantsstatemachine1firstversion__accountapplicationworkflowasljson">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-ida0d7df16df74104c36cb221ee8f4f61bab25ef76codevariantsstatemachine1firstversion__accountapplicationworkflowasljson"></div> <script type="text/template" data-diff-for="diff-ida0d7df16df74104c36cb221ee8f4f61bab25ef76codevariantsstatemachine1firstversion__accountapplicationworkflowasljson">commit a0d7df16df74104c36cb221ee8f4f61bab25ef76
Author: Gabe Hollombe <gabe@avantbard.com>
Date:   Tue Jun 9 13:55:58 2020 +0800

    progress porting to SAM

diff --git a/code/variants/statemachine/1-first-version__account-application-workflow.asl.json b/code/variants/statemachine/1-first-version__account-application-workflow.asl.json
new file mode 100644
index 0000000..ebc80ed
--- /dev/null
+++ b/code/variants/statemachine/1-first-version__account-application-workflow.asl.json
@@ -0,0 +1,31 @@
+    {
+        "StartAt": "Check Name",
+        "States": {
+            "Check Name": {
+                "Type": "Task",
+                "Parameters": {
+                    "command": "CHECK_NAME",
+                    "data": {
+                        "name.$": "$.application.name"
+                    }
+                },
+                "Resource": "${DataCheckingFunctionArn}",
+                "Next": "Check Address"
+            },
+            "Check Address": {
+                "Type": "Task",
+                "Parameters": {
+                    "command": "CHECK_ADDRESS",
+                    "data": {
+                        "address.$": "$.application.address"
+                    }
+                },
+                "Resource": "${DataCheckingFunctionArn}",
+                "Next": "Approve Application"
+            },
+            "Approve Application": {
+                "Type": "Pass",
+                "End": true
+            }
+        }
+    }
\ No newline at end of file
</script>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="ida0d7df16df74104c36cb221ee8f4f61bab25ef76codevariantsstatemachine1firstversion__accountapplicationworkflowasljson" style="position: relative; left: -1000px; width: 1px; height: 1px;">    {
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
                "Next": "Approve Application"
            },
            "Approve Application": {
                "Type": "Pass",
                "End": true
            }
        }
    }
</textarea>
{{< /safehtml >}}


➡️ Step 6. Redeploy our application:

```bash
sam build && sam deploy
```


### Try it out

➡️ Step 1. Head back to the Step Functions web console and look for a state machine named `ApplicationProcessingStateMachine-xxxxxxxxxxxx` and click it (note: the x's shown here are placehodlers for a suffix unique to your deployment). This is the re-deployed version of our state machine. The new version of our state machine hasn’t changed, except that we granted its IAM role permissions to invoke our Data Checking lambda. Let’s try executing it again with some sample input to see what happens.

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