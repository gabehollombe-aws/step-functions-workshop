+++
title = "Creating the Data Checking service"
chapter = false
weight = 40
+++

To keep things simple, we’ll create the Data Checking service as just another Lambda function defined in our same `workshop-dir` project folder. 

Also, for the sake of keeping our code simple, we’ll implement our name and address checking logic with some overly-simple rules: 

* Any name will be flagged if it contains the lowercase string ‘evil’ anywhere in it. So ‘Spock’ is OK but ‘evil Spock’ is not.

* Any address will be flagged if it doesn’t match the pattern of number(s)-space-letter(s) OR letter(s)-space-number(s). So, ‘123 Enterprise Street’ is OK, and so are 'Enterprise Street 123' and 'E 1', but ‘123EnterpriseStreet’ and ‘Some Street’ and ‘123’ are not OK.

### In this step, we will:

* Create `data-checking.js` to implement our Data Checking service Lambda function.

* Add some additional configuration to `serverless.yml` to create a new AWS Lambda function called `DataChecking` and implemented by `data-checking.js` along with a new IAM role with permissions for the function to log to Amazon CloudWatch. 

### Make these changes

➡️ Step 1. Create `workshop-dir/data-checking.js` with <span class="clipBtn clipboard" data-clipboard-target="#ide876cc5b865e13312cc324cea45ab3ece5e1c5c1codedatacheckingjs">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-ide876cc5b865e13312cc324cea45ab3ece5e1c5c1codedatacheckingjs"></div> <script type="text/template" data-diff-for="diff-ide876cc5b865e13312cc324cea45ab3ece5e1c5c1codedatacheckingjs">commit e876cc5b865e13312cc324cea45ab3ece5e1c5c1
Author: Gabe Hollombe <gabe@avantbard.com>
Date:   Fri Nov 8 11:20:31 2019 +0800

    data-checking.js v1

diff --git a/code/data-checking.js b/code/data-checking.js
new file mode 100644
index 0000000..9dbdaf6
--- /dev/null
+++ b/code/data-checking.js
@@ -0,0 +1,35 @@
+'use strict';
+
+const checkName = (data) => {
+    const { name } = data
+
+    const flagged = (name.indexOf('evil') !== -1)
+    return { flagged }
+}
+
+const checkAddress = (data) => {
+    const { address } = data
+
+    const flagged = (address.match(/(\d+ \w+)|(\w+ \d+)/g) === null)
+    return { flagged }
+}
+
+
+const commandHandlers = {
+    'CHECK_NAME': checkName,
+    'CHECK_ADDRESS': checkAddress,
+}
+
+module.exports.handler = (event, context, callback) => {
+    try {
+        const { command, data } = event
+
+        const result = commandHandlers[command](data)
+        callback(null, result)
+    } catch (ex) {
+        console.error(ex)
+        console.info('event', JSON.stringify(event))
+        callback(ex)
+    }
+};
+
</script>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="ide876cc5b865e13312cc324cea45ab3ece5e1c5c1codedatacheckingjs" style="position: relative; left: -1000px; width: 1px; height: 1px;">'use strict';

const checkName = (data) => {
    const { name } = data

    const flagged = (name.indexOf('evil') !== -1)
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

➡️ Step 2. Replace `serverless.yml` with <span class="clipBtn clipboard" data-clipboard-target="#id03eee8d58ad56817b84197e45c12f2ce83ae8d52serverlessyml">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-id03eee8d58ad56817b84197e45c12f2ce83ae8d52serverlessyml"></div> <script type="text/template" data-diff-for="diff-id03eee8d58ad56817b84197e45c12f2ce83ae8d52serverlessyml">commit 03eee8d58ad56817b84197e45c12f2ce83ae8d52
Author: Gabe Hollombe <gabe@avantbard.com>
Date:   Mon Oct 14 16:45:44 2019 +0800

    Create the data checking service lambda

diff --git a/serverless.yml b/serverless.yml
index 2869132..07bc6d3 100644
--- a/serverless.yml
+++ b/serverless.yml
@@ -53,6 +53,11 @@ functions:
       ACCOUNTS_TABLE_NAME: ${self:custom.applicationsTable}
     role: ApproveRole
 
+  DataChecking:
+    name: ${self:service}__data_checking__${self:provider.stage}
+    handler: data-checking.handler
+    role: DataCheckingRole
+
 resources:
   Resources:
     LambdaLoggingPolicy:
@@ -167,6 +172,20 @@ resources:
           - { Ref: LambdaLoggingPolicy }
           - { Ref: DynamoPolicy }
 
+    DataCheckingRole:
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
+
     ApplicationsDynamoDBTable:
       Type: 'AWS::DynamoDB::Table'
       Properties:
</script>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="id03eee8d58ad56817b84197e45c12f2ce83ae8d52serverlessyml" style="position: relative; left: -1000px; width: 1px; height: 1px;">service: StepFunctionsWorkshop

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
</textarea>
{{< /safehtml >}}

➡️ Step 3. From the terminal, run:

```bash
sls deploy
```


### Try it out

After the deploy finishes, we can interact with our new data-checking lambda to check any name or address string we like. Try each check with valid and invalid inputs.


➡️ Step 1. Check a valid name. Run:

```
sls invoke -f DataChecking --data='{"command": "CHECK_NAME", "data": { "name": "Spock" } }'
```

➡️ Step 2. Check an invalid name. Run:

```
sls invoke -f DataChecking --data='{"command": "CHECK_NAME", "data": { "name": "evil Spock" } }'
```

➡️ Step 3. Check a valid address. Run:

```
sls invoke -f DataChecking --data='{"command": "CHECK_ADDRESS", "data": { "address": "123 Street" } }'
```

➡️ Step 4. Check an invalid address. Run:

```
sls invoke -f DataChecking --data='{"command": "CHECK_ADDRESS", "data": { "address": "DoesntMatchAddressPattern" } }'
```


As you can see, the Data Checking service just returns a simple JSON style response with one variable, `flagged` returning true if the value being checked requires further scrutiny by a human.

We now have all the basic capabilities we need in our services in order to begin connecting them together to implement the beginnings of our desired application processing workflow. The big question is ‘how should we connect these services together’?  