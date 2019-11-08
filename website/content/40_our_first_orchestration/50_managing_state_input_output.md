+++
title = "Managing State Inputs and Outputs"
chapter = false
weight = 50
+++

Each Step Function state machine execution receives a JSON document as input and passes that input to the first state in the workflow. Individual states receive JSON as input and usually pass JSON as output to the next state. Understanding how this information flows from state to state, and learning how to filter and manipulate this data, is key to effectively designing and implementing workflows in AWS Step Functions. The [Input and Output Processing](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-input-output-filtering.html) section of the AWS Step Functions developer guide provides a comprehensive explanation, but for now we’ll just cover the bit of knowledge we need to get our state machine working.

The output of a state can be a copy of its input, or the result it produces (for example, output from a `Task` state’s Lambda function), or a combination of its input and result. We can use the `ResultPath` property inside our state machine task definitions to control which combination of these result configurations is passed to the state output (which then, in turn, becomes the input for the next state). 

The reason why our execution failed above is because the default behavior of a Task, if we don’t specify a `ResultPath` property, is to take the task’s output and use it as the input for the next state. In our case, since the previous state (Check Name) generated output of `{ "flagged": false }` this became the input to the next state (Check Address). Instead, what we want to do is preserve the original input, which contains our applicant’s info, merge Check Name’s result into that state, and pass the whole thing down to the Check Address.  Then, Check Address could do the same. What we want to do is get both data checking steps to execute correctly and merge their outputs together for some later step to inspect for further downstream routing logic.

So, to fix our current issue, we need to add a `ResultPath` statement, instructing the state machine to generate its output by taking the Lambda function’s output and merging it with the state’s input. It’s a simple change, really. We just need to add a tiny bit of additional configuration to our Task state definitions: `"ResultPath": "$.SomePropertyName"`. In Amazon States Language, the dollar sign syntax you see here means *the state’s input.* So what we’re saying here is, put the result of this task execution (in this case it’s the Lambda function’s output) into a new property of the object containing the input state, and use that as the state’s output.

### In this step, we will

* Add `ResultPath` properties to our Check Name and Check Address states inside our state machine defined in `serverless.yml`

### Make these changes

Below is a new version of our serverless.yml file that contains updated Check Name and Check Address states, using the ResultPath property to merge their outputs into helpfully-named keys that we can be used later on.


➡️ Step 1. Replace `serverless.yml` with <span class="clipBtn clipboard" data-clipboard-target="#id14f663b34a7646269434b5fbc047a177">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-id14f663b34a7646269434b5fbc047a177"></div> <pre style="display: none;" data-diff-for="diff-id14f663b34a7646269434b5fbc047a177">commit 4114d55fdb744943184a1b480c94da7d77cfc80d
Author: Gabe Hollombe <gabe@avantbard.com>
Date:   Tue Oct 15 17:02:48 2019 +0800

    Add ResultPath to data checking steps

diff --git a/serverless.yml b/serverless.yml
index 0b9f3b9..83b94ce 100644
--- a/serverless.yml
+++ b/serverless.yml
@@ -252,6 +252,7 @@ resources:
                             "data": { "name.$": "$.application.name" }
                         },
                         "Resource": "#{dataCheckingLambdaArn}",
+                        "ResultPath": "$.checks.name",
                         "Next": "Check Address"
                     },
                     "Check Address": {
@@ -261,6 +262,7 @@ resources:
                             "data": { "address.$": "$.application.address" }
                         },
                         "Resource": "#{dataCheckingLambdaArn}",
+                        "ResultPath": "$.checks.address",
                         "Next": "Approve Application"
                     },
                     "Approve Application": {
</pre>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="id14f663b34a7646269434b5fbc047a177" style="position: relative; left: -1000px; width: 1px; height: 1px;">service: StepFunctionsWorkshop

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

➡️ Step 2. Run:

```bash
sls deploy
```

### Try it out

With our new version deployed, each data checking step will now pass its whole input to its output as well as adding the data checking result to a new property in its output, too. Let’s retry another execution to see how things go.

➡️ Step 1. Back in the Step Functions web console, click ‘New Execution’

➡️ Step 2. Leave the input the same as before and click ‘Start execution’. This time, you should see the execution succeed.

➡️ Step 3. Click on the Check Address state in the visualization section and expand the Input and Output nodes on the right. 

Notice how the Check Name state kept our original input and appended its results inside of `$.checks.name` and how our Check Address took that output as its input and appended its own address check result inside of `$.checks.address`.  That’s the power of `ResultPath` at work!

![Workflow simplified all working](/images/simplified-workflow-vis-working.png)

At this point, we have a workflow that executes successfully, but it’s still missing some important logic. Our workflow goes directly from Check Address to Approve Application.  What we actually want is to automatically approve an application only if both the name and address come back without flags, and otherwise we want to queue the application up for review by a human.  

Eventually we will incorporate a step that will wait for a human response on flagged applications. But before that, we need to learn how to inspect the workflow’s state and execute some branching logic based on the checks we define.  To do this, we’ll need to add a new type of state to our state machine called the Choice state.