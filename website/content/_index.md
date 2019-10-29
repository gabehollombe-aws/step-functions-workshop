---
title: "Workshop - Introduction to service coordination using AWS Step Functions"
chapter: false
weight: 1
---

# Introduction to service coordination using AWS Step Functions

## IMPORTANT NOTE: This workshop is a work in progress and not yet intended for public consumption.


* * *

## Welcome

In this hands-on workshop, you’ll learn how to coordinate business workflows among distributed services using a simple, yet powerful, fully managed service called AWS Step Functions. We will deploy a pair of services as simple AWS Lambda functions and orchestrate them together into an example business workflow involving parallel executions, branching logic, and pause/resume on human interaction steps. 


### Learning goals

This workshop is designed to teach you the following:

- The advantages of implementing service orchestrations using a fully managed service

- The basics of authoring AWS Step Function state machines, including:
  - Performing work with AWS Lambda functions using the `Task` state

  - Encoding branching logic using the `Choice` state

  - Executing work in parallel using the `Parallel` state

  - Pausing and resuming execution based on a token & callback pattern using the `waitForTaskToken` service integration pattern

- Visualizing, debugging, and auditing workflow executions using the AWS Step Functions web console


### Before you begin

Before you begin, please ensure you have an AWS Accout with Administrator privileges. 

All set? <a href="#understanding-service-orchestration">Click here to skip ahead to the introduction.</a>

Need to create an account or a user with Admin rights? Please read on.

* * * *

#### Create an AWS Account
{{% notice warning %}}
Your account must have the ability to create new IAM roles and scope other IAM permissions.
{{% /notice %}}

{{% notice tip %}}
If you already have an AWS account, and have IAM Administrator access, you can <a href="#understanding-service-orchestration">skip ahead.</a>
{{% /notice %}}

1. **If you don't already have an AWS account with Administrator access**: [create
one now](https://aws.amazon.com/getting-started/)

1. Once you have an AWS account, ensure you are following the remaining workshop steps
as an **IAM user** with administrator access to the AWS account:
[Create a new IAM user to use for the workshop](https://console.aws.amazon.com/iam/home?region=us-east-1#/users$new)

1. Enter the user details:
![Create User](images/iam-1-create-user.png)

1. Attach the AdministratorAccess IAM Policy:
![Attach Policy](images/iam-2-attach-policy.png)

1. Click to create the new user:
![Confirm User](images/iam-3-create-user.png)

1. Take note of the login URL and save:
![Login URL](images/iam-4-save-url.png)


#### Create an AWS Cloud9 Workspace

AWS Cloud9 is a cloud-based integrated development environment (IDE) that lets you write, run, and debug your code with just a browser. It includes a code editor, debugger, and terminal. Cloud9 comes prepackaged with essential tools for popular programming languages, including JavaScript, Python, PHP, and more, so you don't need to install files or configure your development machine to start new projects.

{{% notice warning %}}
The Cloud9 workspace should be built by an IAM user with Administrator privileges,
not the root account user. Please ensure you are logged in as an IAM user, not the root
account user.
{{% /notice %}}

{{% notice info %}}
Ad blockers, JavaScript disablers, and tracking blockers should be disabled for
the Cloud9 domain, otherwise connecting to the workspace might be impacted.
{{% /notice %}}

### Create a new environment

1. Go to the [Cloud9 web console](https://us-west-2.console.aws.amazon.com/cloud9/home?region=us-west-2).
1. At the top right corner of the console, make sure you're using one of these regions: Virginia (us-east-1), Oregon (us-west-2), Ireland (eu-west-1) or Singapore (ap-southeast-1)
1. Select **Create environment**
1. Name it **workshop**, and go to the **Next step**
1. Select **Create a new instance for environment (EC2)** and pick **t2.medium**
2. Leave all of the environment settings as they are, and go to the **Next step**
3. Click **Create environment**

### Clean up the layout

When the environment comes up, customize the layout by closing the **welcome tab**
and **lower work area**, and opening a new **terminal** tab in the main work area:
![c9before](images/c9before.png)

Your workspace should now look like this:
![c9after](images/c9after.png)

* * * * *

# Introduction

## Understanding service orchestration

We use the term *orchestration* to describe the act of coordinating distributed services via a centralized workflow manager process, similar to how a conductor understands each part of an orchestra and directs each instrument section to act together to create a specific performance result. 

Orchestration’s main benefit for service coordination is that it places all of the logic required to usher data between services to achieve a specific workflow in one central place, rather than encoding that logic across many services that need to know how to work with each other. This means that if anything about processing a workflow needs to change, there’s only one place to update: the process that’s managing the orchestration. It also means it’s easier to understand how various services are used together in concert, since you only need to look in one place to understand the entire flow from start to finish.

This approach works best when there is a higher level of coordination needed between services, often involving the need for robust retries, specific error handling, and optimized processing logic like conducting some steps in parallel or waiting for some steps to complete before continuing to execute a particular process. 

## Our example business domain

It’s much easier to explore concepts around distributed service coordination when we have concrete systems to talk about. For this workshop, we’ll discuss a set of services (in our case they’ll all be implemented with simple AWS Lambda functions) that comprise a very small slice of a very simplified banking system. The workshop will focus on implementing the workflow to handle processing new bank account applications by checking particulars of an applicant’s information and handling cases that require human review. 

Our demo system is comprised of a few services with the following responsibilities:

* **Account Applications service** - handles the processing of new bank account applications from submission. Requires answers from the Data Checking service to provide validation checks against the applicant’s name and address. 
* **Data Checking service** - validates data related to names and addresses
* **Accounts service** - could be responsible for opening and operating bank accounts. We won’t actually implement this service in this workshop (because we’ll focus on the orchestration between the Account Applications and Data Checking services) but it’s useful to think about it as a placeholder that we might want to interact with in cases when our application workflow ends with an approval result.

In the picture below, we can see how an orchestration-based approach for our bank account application processing workflow could work.

![Workflow collaboration](images/orchestration-collaboration.png)

So this is exactly the design we’ll implement now in this workshop.  We’ll use orchestration to manage our bank account processing workflow — the Account Applications service will accept incoming applications and process each application (by collaborating with the Data Checking service and waiting for humans to review flagged applications). Once an application has moved all the way through the workflow and if a decision is made to approve the application, the workflow could end by notifying an Accounts service to open an account for a user.

OK! We’ve covered enough background. It’s time to get hands-on and learn by building.


## Our example workflow: processing new bank account applications

Whenever a new bank account application comes in to our example system, we want to check some of the applicant's information and then either automatically approve the application if there were no issues with the data, or flag it for human review if any of our data checks come back with a flag. A human reviewer will periodically check for flagged applications and decide to approve or reject each flagged application. In principle, once we have an approval decision made for an account application, we could include a step to collaborate with an Accounts service to automatically open an account, but for simplicity’s sake, we’re just going to focus on making a decision for an application, since there is enough material to focus on here to illustrate many important orchestration concepts.

To sum up, here is the workflow that we want to manage:

- Check an applicant’s name and address against a service to detect if they’re suspicious or otherwise warrant review by a human before processing the account application

- If the name and address checks come back without any issues, then automatically approve the application. If we encounter an error trying to check the name or the address, flag the application as unprocessable and stop. Otherwise, if the name or address checks reveal a concern about the data, proceed to step 3

- Flag the application for review by a human and pause further processing

- Wait for a human to review the flagged application and make an approve or reject decision for the application

- Approve or reject the application, as per the reviewer’s decision

Here is a diagram to illustrate our this same workflow with boxes and arrows instead of words:
![Workflow collaboration](images/full-desired-workflow.png)

# Our first orchestration

## Preparing to create our example services

Now that we have an idea of the workflow we’d like, we need to stand up some services that will handle the various steps in our workflow.  Once we have some services deployed, we can orchestrate them together to implement this workflow. Let’s get to it!

For the purposes of this workshop, rather than deploying full web services, we’ll just deploy each of our services into their own AWS Lambda functions and invoke these functions directly. This way we keep our deployments simple with less moving parts so we can focus our attention on how to orchestrate these services, rather than on providing an external interface (like a set of HTTP REST endpoints) to authenticate and front these services.

In this project, we’ll use the <a href="https://serverless.com/">Serverless Framework</a> to help us write, deploy, and test the functionality in our services. 

{{% notice tip %}}
You absolutely do not need to use the Serverless Framework to work with AWS Lambda or AWS Step Functions, but it has some nice developer ergonomics that makes it useful for us. Since this workshop doesn't include any sort of GUI to work with the API we'll be deploying, we're just going to invoke deployed AWS Lambda functions directly by name, which the Serverless Framework makes really easy.  
<br/>
Also, if you're used to AWS CloudFormation for managing your infrastructure as code, you'll feel right at home with the way the Serverless Framework defines resources. In fact, you can (and we will) embed CloudFormation resources into the `serverless.yml` file that the framework uses for deployments.
{{% /notice %}}




## Creating the Account Application service

To start, we’ll create several functions that, when taken collectively, could be considered to be our Account Applications service. Namely, we’ll make functions allowing us to submit new applications (consisting of just a record with a name and an address), flag applications for review, and mark applications as approved or rejected. We’ll also add a capability to list all applications in a certain state (like SUBMITTED or FLAGGED) to save ourselves the trouble of inspecting the service’s data store directly.

### In this step, we will:

- Install the Serverless CLI tool, initialize a new project, and install a few dependencies from NPM

- Download v1 of our Account Applications service functions (so you don't need to create a lot of initial files by hand). These functions will each be implemented with Node.js. 

- Set up a v1 of the `serverless.yml` file, which is how we tell the Serverless Framework about all of the cloud resources that our system will use, including the AWS Lambda functions that implement each action in our API, an Amazon DynamoDB table to store the state of each application, and the necessary AWS IAM roles and permissions to ensure our Lambda functions can operate successfully and securely.


### Make these changes

First, install the Serverless CLI tool, initialize a new project, install two dependencies from NPM, and remove the default Lambda function handler created by the new project. 

Step 1. In the terminal command line, run these commands to handle all of the housekeeping of getting our first version of the Account Applications service deployed:

    ```bash
    # Install the Serverless Framework CLI
    npm install -g serverless

    # Make a directory for all our source code for this workshop
    mkdir workshop-dir
    cd workshop-dir

    # Initialize a new Serverless Framework project in this directory
    serverless create --template aws-nodejs

    # Remove some boilerplate files
    rm handler.js
    rm serverless.yml

    # Create a directory for all the Account Applications service Lambda functions
    mkdir account-applications
    pushd account-applications

    # Bootstrap our initial service with a few files we'll extract from a zip archive
    git clone https://github.com/gabehollombe-aws/step-functions-workshop.git
    pushd step-functions-workshop
    git checkout c186b8f24783bcaf4914c329bc456831ea0fd0f3
    mv account-applications/* ..
    mv serverless.yml ../..
    popd
    rm -rf step-functions-workshop

    # Back to workshop-dir
    popd

    # Install dependencies
    npm init --yes
    npm install --save serverless-cf-vars uuid
     
    ```

Step 2. Use the Serverless Framework command to deploy our Lambda functions and Dynamo DB table. 

From the terminal, run:

```bash
sls deploy
```

{{% notice warn %}}
By default, the Serverless Framework will deploy resources into the `us-east-1` region. When using the AWS Web Console during this workshop, please ensure you're in the `N. Virginia` (us-east-1) region.<br/><br/>If you want to override this default region setting, you can do so by specifying a region argument to the `sls deploy` command. See [the Serverless Framework CLI deploy command documentation](https://serverless.com/framework/docs/providers/aws/cli-reference/deploy/) for more details.
{{% /notice %}}

{{% notice note %}}
Take a few moments to look at some of the files we just created in `workshop-dir` to understand what we deployed.
<br/><br/>
Here are some important files worth looking at:
<br/><br/>
`account-applications/submit.js`<br/>This implements our SubmitApplication Lambda function. There are similar files for `find`, `flag`, `reject`, and `approve` as well.<br/><br/>
`account-applications/AccountApplications.js`<br/>This is a common file that provides CRUD style operations for our Account Application data type. It's used by the various `account-applications/*.js` Lambda functions.<br/><br/>
`serverless.yml`<br/>This is the file that the Serverless Framework looks at to determine what we want resources we want to cloud create and deploy as part of our solution. If you're familiar with AWS CloudFormation, the structure of this file will look pretty familar to you. Notice we are defining seperate roles for each Lambda function, and each role is built up of cusom shared policies we define in the file as well.
{{% /notice %}}


Now we have a fully-deployed Lambda function that can handle all of the steps involved to move an application from SUBMITTED, to FLAGGED, to APPROVED or REJECTED. 

Let’s take a moment to manually interact with each of these functions to understand the surface area of our first version of the Account Application Service API.


## Exploring the Account Applications service API

The Account Application service is implemented as a collection of AWS Lambda functions. This first version of our service gives us a basic set of capabilities: we can:
- Submit new applications
- View a list of applications for each state
- Flag an application for review
- Approve or reject applications


{{% notice note %}}
Please note that while this service includes the ability to allow us to flag an application, we have not yet encoded any logic to determine *when* a submitted application might get flagged. We’re just setting up the basic capabilities that we will need in order to orchestrate together with another Data Checking service to implement our full example account application processing workflow.
{{% /notice %}}

### Try it out

Using the Serverless Framework CLI, we can invoke any of the service’s functions with the following parameters depending on what we’d like to do. Try running each of these commands in turn to understand what we can do with applications right now.

{{% notice info %}}
Below, we're using the Serverless Framework, via `sls invoke ...`, to directly invoke a deployed AWS Lambda function with our desired payloads. We haven't started AWS Step Functions yet. Here, we are just exploring the surface area of the Lambda functions that we will begin to orchestrate using Step Functions a bit later on in this workshop.
{{% /notice %}}

1. Submit a new application. In the terminal, run:

    ```bash
    sls invoke -f SubmitApplication --data='{ "name": "Spock", "address": "123 Enterprise Street" }'
    ```

    ![Workflow collaboration](images/copy-application-id.png)

    Copy the ID of the new application, shown in the output from the above command. We’ll use it in the next step.


2. Flag an application for review (replace REPLACE_WITH_ID below with the ID of the application you just created in step 1). Run with replacement:

    ```bash
    sls invoke -f FlagApplication --data='{ "id": "REPLACE_WITH_ID", "flagType": "REVIEW" }'
    ```

3. List all of the applications that are currently flagged for review. Run:

    ```bash
    sls invoke -f FindApplications --data='{ "state": "FLAGGED_FOR_REVIEW" }'
    ```

    We could also run the above function with other states like ‘SUBMITTED’ or ‘APPROVED’ or ‘REJECTED’.

4. Approve the application (replace REPLACE_WITH_ID below with the ID of the application ID you copied in step 1). Run with replacement:

    ```bash
    sls invoke -f ApproveApplication --data='{ "id": "REPLACE_WITH_ID" }'
    ```



We just manually took an application through the steps of being submitted, then flagged for review, then approved. But, the workflow we  want to implement requires the Account Applications service to collaborate with a Data Checking service, checking an applicant’s name and address against some business rules to decide if an application needs to be reviewed by a human. 

Next, we’ll create the Data Checking service, and then we’ll connect the Account Applications service to the Data Checking service with some orchestration glue so we can automatically decide if an application should be flagged for review or not.



## Creating the Data Checking service

To keep things simple, we’ll create the Data Checking service as just another Lambda function defined in our same `workshop-dir` project folder. 

Also, for the sake of keeping our code simple, we’ll implement our name and address checking logic with some overly-simple rules: 

* Any name will be flagged if it contains the lowercase string ‘evil’ anywhere in it. So ‘Spock’ is OK but ‘evil Spock’ is not.

* Any address will be flagged if it doesn’t match the pattern of number(s)-space-letter(s) OR letter(s)-space-number(s). So, ‘123 Enterprise Street’ is OK, and so are 'Enterprise Street 123' and 'E 1', but ‘123EnterpriseStreet’ and ‘Some Street’ and ‘123’ are not OK.

### In this step, we will:

* Create `data-checking.js` to implement our Data Checking service Lambda function.

* Add some additional configuration to `serverless.yml` to create a new AWS Lambda function called `DataChecking` and implemented by `data-checking.js` along with a new IAM role with permissions for the function to log to Amazon CloudWatch. 

### Make these changes

Step 1. Create `workshop-dir/data-checking.js` with <button class="clipboard" data-clipboard-target="#idafda3a78b92c4a4496e120325053d4ef">this content</button> (click the gray button to copy to clipboard).{{% safehtml %}}<pre id="idafda3a78b92c4a4496e120325053d4ef" style="position: absolute; left: -1000px; top: -1000px; width: 1px; height: 1px;">'use strict';

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

</pre>{{% /safehtml %}}

Step 2. Replace `serverless.yml` with <button class="clipboard" data-clipboard-target="#id98b7e4244ad54bc699b8ca0add6b16d0">this content</button> (click the gray button to copy to clipboard).{{% safehtml %}}<pre id="id98b7e4244ad54bc699b8ca0add6b16d0" style="position: absolute; left: -1000px; top: -1000px; width: 1px; height: 1px;">service: StepFunctionsWorkshop

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
</pre>{{% /safehtml %}}

<div class="notices note">
    <p>
        Specifically, here are the relevant additions you will have added after pasting the new <code>serverless.yml</code>.<br/><br/>But, <strong>please don't make the edits by hand</strong>. The copy/paste here reduces the risk of typos.
    </p>

    <pre>
    DataChecking:
        name: ${self:service}__data_checking__${self:provider.stage}
        handler: data-checking.handler
        role: DataCheckingRole

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
    </pre>
</div>


Step 3. From the terminal, run:

```bash
sls deploy
```


### Try it out

After the deploy finishes, we can interact with our new data-checking lambda to check any name or address string we like. Try each check with valid and invalid inputs.


1. Check a valid name. Run:
    ```
    sls invoke -f DataChecking --data='{"command": "CHECK_NAME", "data": { "name": "Spock" } }'
    ```

2. Check an invalid name. Run:
    ```
    sls invoke -f DataChecking --data='{"command": "CHECK_NAME", "data": { "name": "evil Spock" } }'
    ```

3. Check a valid address. Run:
    ```
    sls invoke -f DataChecking --data='{"command": "CHECK_ADDRESS", "data": { "address": "123 Street" } }'
    ```

4. Check an invalid address. Run:
    ```
    sls invoke -f DataChecking --data='{"command": "CHECK_ADDRESS", "data": { "address": "DoesntMatchAddressPattern" } }'
    ```


As you can see, the Data Checking service just returns a simple JSON style response with one variable, `flagged` returning true if the value being checked requires further scrutiny by a human.

We now have all the basic capabilities we need in our services in order to begin connecting them together to implement the beginnings of our desired application processing workflow. The big question is ‘how should we connect these services together’?  


## How should we connect our services together?

Given our earlier exploration of the orchestration patterns, this case feels like a very strong candidate for orchestration. We have the beginnings of a workflow here, with logic dictating what state an application should end up in after checking an applicant’s name and address. So, the next question is *how should we implement this orchestration?*

At first glance, the most straightforward solution that may occur to you is to simply add more logic to our Account Applications service. When an application is submitted, we could make two cross-service calls out to the Data Checking service to check the name and address. Then, once we have the responses for both, we can flag the application for review if either data check came back with a flag, otherwise we can approve the application automatically. Certainly this approach will work, but there are some drawbacks that may not be immediately obvious.

For one, we’ll need to elegantly handle timeout and error conditions. What happens if we don’t get a timely response from our cross-service call, or if we can a transient error and we want to retry the request?  If we’re gluing these services together directly in code, we’ll need to add some backoff/retry logic. In and of itself, this isn’t a big deal, but it ties up our main processing thread while its sleeping and waiting to retry those requests. 

Another missed benefit here is that if we simply encoded this logic into application code, it’s not easy to generate a visual representation of this workflow design or its execution history. There is tremendous business value in being able to visualize the shape of business workflows, since it helps non-technical users understand and validate the business logic we’re encoding into our system. Furthermore, this workflow is starting out very simply, but as our workflows evolve, it often become increasingly difficult to audit the entirely of our workflow executions and to debug issues that arise from unexpected inputs into our system.

Fortunately, AWS has a simple but extremely powerful tool to help us orchestrate our workflows in a way that addresses all of these concerns: AWS Step Functions.


## Intro to AWS Step Functions

AWS Step Functions lets you coordinate services via fully-managed serverless workflows so you can build and update apps quickly. Workflows are made up of a series of steps, with the output of one step acting as input into the next. Application development is simpler and more intuitive using Step Functions because it translates your workflow into a state machine diagram that is easy to understand, easy to explain to others, and easy to change. You can monitor each of the steps of a workflow’s execution as they occur (and after as well), which helps you quickly identify problems and fix them. Step Functions automatically triggers and tracks each step, and can retry steps when there are errors, so your application workflow executes reliably, and in the order you expect.

There’s a lot to explore in the description above, and by the end of this workshop you’ll see all of the benefits just mentioned first-hand. But the best way to understand a new service is to use it, so we’ll dive right in to Step Functions by starting with the basic concepts and steps we need to connect our services together.

Step Functions works by representing our workflow as a state machine.  If you’re not familiar with the concept of a state machine, it will likely feel familiar pretty quickly, because it’s just a formalization of things you probably already have a very strong intuitive understanding of from writing any basic programming code. 

A state machine is just a way to describe a collection of workflow steps that are split into named states. Each state machine has one starting state and always only one active state (during its execution).  The active state has some input, and often takes some action using that input, which generates some new output. State machines transition from one state to the next based on their state and the explicit connections we allow between states.

Let’s get hands-on so you can see this in action.  We’ll start by writing our first Step Functions state machine to model a simplified version of our desired workflow. With AWS Step functions, there are several different types of states (or steps) that we can use to create our workflow’s state machine, and the simplest one is the Pass State. The Pass State simply passes its input to its output, performing no work. Pass States are useful when constructing and debugging state machines, so we’ll use them here to begin to sketch out our workflow.

### Make these changes

To start out, let’s just try to model the steps involved to check a name, check an address, and then approve an application. Our simple workflow will start out like this:

![Simplified workflow](images/simplified-workflow-sm.png)

1. Open the [AWS Step Functions web console](https://console.aws.amazon.com/states/home?region=us-east-1)

2. If the left sidebar is collapsed, expand it

3. Make sure you’re in the State machines section and click the ‘Create state machine’  button on the right

4. In the Name field, enter ‘Process_New_Account_Applications’

5. In the ‘State machine definition’ section, replace the example state machine definition with the following JSON instead:

    ```
    {
    "StartAt": "Check Name",
    "States": {
        "Check Name": {
        "Type": "Pass",
        "Next": "Check Address"
        },
        "Check Address": {
        "Type": "Pass",
        "Next": "Approve Application"
        },
        "Approve Application": {
        "Type": "Pass",
        "End": true
        }
    }
    }
    ```

1. Click the refresh icon and you should see a diagram matching the one above. This is really helpful for making sure we’re connecting our states together in the right way.
2. Click ‘Next’ to continue
3. We need to specify an IAM role for the Step Function to assume when it executes. For now we can just start with the default role. Select ‘Create an IAM role for me’ and enter a name for the role like ‘Process_New_Account_Applications_Role’
4. Click ‘Create state machine’


{{% notice info %}}
In AWS Step Functions, we define our state machines using a JSON-based structured language called Amazon States Language.  You can read more about the full language specification and all of the supported state types at https://states-language.net/spec.html
{{% /notice %}}

At this point, although we’ve created a valid step function, it doesn’t really *do* anything because the Pass state we’re using in our definition just passes input straight through to its output without performing any work. Our state machine just transitions through three Pass states and ends. Nevertheless, let’s quickly try out a simple execution so we can see this for ourselves.

### Try it out

1. Click ‘Start execution’

2. Every time we ask Step Functions to execute a state machine, we can provide some initial input if we want. Let’s just leave the initial example input as-is and click ‘Start execution’

3. You’ll now see the details page for the execution we just triggered. Click on any of the step names in the visualization and notice how we can see the input and output values for each state in the execution.
    
    ![Workflow simplified all pass states](images/simplified-workflow-vis-all-pass.png)



Now that you understand how to define and execute a state machine, let’s update our state machine definition to actually perform some work by calling out to the Data Checking service to check the name and the address. For our new definition, we’ll use the Task state to perform some work. 


## Introducing the Task state

The Task State causes the interpreter to execute work identified by the state’s Resource field. Below, we’ll use Task states to invoke our Data Checking service Lambda function, passing appropriate name and address attributes from our application in to the Lambda function invocations.


{{% notice info %}}
In the Task states below, in addition to specifying the ARN of the Lambda function we want the Task state to use, we also include a Parameters section. This is how we pass data from the state’s input into the target Lambda function’s input. You’ll notice that we’re using a syntax that includes dollar signs at the end of each property name and the beginning of each property value. This is so that Step Functions knows we want to inject state data into these parameters instead of actually sending a raw string of `$.application.name` for example.  
{{% /notice %}}

The state machine description we use below assumes that the state machine will receive an initial input object with a single property called `application` that has `name` and `address` properties on it. We’ll specify this input for execution in a moment after we update our state machine definition.

### Make these changes

1. Back in the Step Functions web console, click ‘Edit state machine’

2. Next, we’re going to update our state machine definition. Note that after you paste the content below,  you will see a few lines with error indicators because our new state machine definition has some placeholder strings called ‘REPLACE_WITH_DATA_CHECKING_LAMBDA_ARN’.  We’ll fix this in the next step. Replace our existing definition with the following updated state machine definition:

```
{
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
            "Resource": "REPLACE_WITH_DATA_CHECKING_LAMBDA_ARN",
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
            "Resource": "REPLACE_WITH_DATA_CHECKING_LAMBDA_ARN",
            "Next": "Approve Application"
        },
        "Approve Application": {
            "Type": "Pass",
            "End": true
        }
    }
}
```

1. Back on your terminal, run:

    ```
    sls info --verbose | grep DataCheckingLambdaFunctionQualifiedArn | cut -d ' ' -f 2
    ```
    
    This shows the ARN of the Data Checking Lambda.
   
2. Copy the ARN to your clipboard.

3. In the state machine definition you pasted in step 3, go back and find the two occurrences of REPLACE_WITH_DATA_CHECKING_LAMBDA_ARN and replace them with the ARN you just copied.

4. Click ‘Save’

5. Notice how we receive a warning that our IAM role may need to change in order to allow our updated state machine to execute. This is a helpful reminder. In fact, we *have* changed our state machine in way that will require permissions changes. Now, we require the ability to invoke our Data Checking Lambda function in order to execute this state machine. We’ll address this next. Click ‘Save anyway’ to continue.

### Try it out

The warning we saw just now when we updated our state machine definition was correct. We *will* need to update our IAM role permissions in order for this to work. But let’s try another execution anyway just to see what an insufficient permission failure looks like.

1. Click ‘Start execution’

2. Paste the following JSON into the input field:

    ```
    {
        "application": { 
            "name": "Spock", 
            "address": "123 Enterprise Street" 
        }
    }
    ```

1. Click ‘Start execution’. 
    
    After a moment, you should see the results of this failed execution. The ‘Execution Status’ label shows ‘Failed’ underneath it, and you’ll see a big red background in the visualization section, highlighting the state that experienced a failure. 

1. Click the failed state, then expand the Exception area on the right-hand side to see more details about the failure. You should see something like the screenshot below.


    ![Check name failure](images/simplified-workflow-vis-name-fail.png)
    This failure isn’t surprising. When this state machine executes, it assumes an IAM role in order to determine which sorts of actions it’s allowed to take inside the AWS cloud. And, of course, we haven’t yet added any explicit permissions to allow this role to invoke our Data Checking Lambda so, to keep things secure, we get a failure when this state machine tries to run.

Let’s fix this by adding the appropriate permissions to the role that our Step Function assumes during execution. 

However, rather than continue to work in the web console and make these fixes by hand, we’ll return to our `serverless.yml` file to define our state machine alongside the other resources used in this workshop, and we’ll take care to also set up the appropriate permissions for this state machine to execute successfully.

### In this step, we will

* Define our new AWS Step Functions state machine inside `serverless.yml`

* Add a new IAM role for our state machine to assume when it executes. The role grants permission for the state machine to invoke our Data Checking Lambda function.

### Make these changes

Before we migrate our step function definition over to our `serverless.yml` file, we should delete the function we’ve been interacting with in the Step Functions web console so that we don’t get confused when a similar state machine is deployed as part of our Serverless stack deployment.

Step 1. In the left sidebar of the Step Functions web console, click ‘State machines’

Step 2. Select the step function we defined manually earlier, click ‘Delete’, and click ‘Delete state machine’ to confirm the deletion.

Step 3. Now, let’s re-define our state machine inside our `serverless.yaml` file. Replace `serverless.yml` with <button class="clipboard" data-clipboard-target="#id21eaba7c00d44be6a907ab249e842be3">this content</button> (click the gray button to copy to clipboard).{{% safehtml %}}<pre id="id21eaba7c00d44be6a907ab249e842be3" style="position: absolute; left: -1000px; top: -1000px; width: 1px; height: 1px;">service: StepFunctionsWorkshop

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
</pre>{{% /safehtml %}}

<div class="notices note">
        <p>
            Specifically, here are the relevant additions you will have added after pasting the new <code>serverless.yml</code>.<br/><br/>But, <strong>please don't make the edits by hand</strong>. The copy/paste here reduces the risk of typos.
        </p>

        <pre>
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
        </pre>
</div>

Step 4. Run:

```bash
sls deploy
```


### Try it out

1. Head back to the Step Functions web console and look for a state machine named `StepFunctionsWorkshop__process_account_applications__dev` and click it. This is the re-deployed version of our state machine. The new version of our state machine hasn’t changed, except that we granted its IAM role permissions to invoke our Data Checking lambda. Let’s try executing it again with some sample input to see what happens.



2. Click ‘Start execution’
3. Paste the following JSON into the input field
    ```json
    {
        "application": { 
            "name": "Spock", 
            "address": "123 Enterprise Street" 
        }
    }
    ```
4. Click ‘Start execution’


After a moment, you should see that the execution **failed**. But, this time, we don’t have any red states, because our failure mode is different. 

Now, we know that our state machine was able to execute our Data Checking lambda function because the ‘Check Name’ state is green. But, notice how the ‘Check Address’ state has a dark gray background. If you look at the color code at the bottom of the visualization section, you’ll see that this means the state was cancelled. Let’s see why.

![Workflow simplified address cancelled](images/simplified-workflow-vis-address-error.png)

### Do these steps

1. In the ‘Execution event history’ section, expand the last row, which should show ‘Execution failed’

2. Notice that the error message gives us a helpful description of what went wrong.

    ```
    {
    "error": "States.Runtime",
    "cause": "An error occurred while executing the state 'Check Address' 
    (entered at the event id #7). 
    The JSONPath '$.application.address' specified for 
    the field 'address.$' could not be found 
    in the input '\"{\\\"flagged\\\":false}\"'"
    }
    ```

Let’s unpack this so we can understand why the state was cancelled.  If you look back at our state machine definition for the Check Address state (shown below), you’ll see that it expects to have an `application` object in its input, and it tries to pass `application.address` down into the Data Checking lambda. 


```json
[...],
"Check Address": {
          "Type": "Task",
          "Parameters": {
              "command": "CHECK_ADDRESS",
              "data": {
                  "address.$": "$.application.address"
              }
          },
          "Resource": "...",
          "Next": "Approve Application"
      },
[...],      
```


The error message is telling us that it couldn’t find `application.address` in the state’s input. To understand why, we need to learn a bit more about how an active state generates its output and passes it to the next state’s input.


## Managing state inputs and outputs

Each Step Function state machine execution receives a JSON document as input and passes that input to the first state in the workflow. Individual states receive JSON as input and usually pass JSON as output to the next state. Understanding how this information flows from state to state, and learning how to filter and manipulate this data, is key to effectively designing and implementing workflows in AWS Step Functions. The [Input and Output Processing](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-input-output-filtering.html) section of the AWS Step Functions developer guide provides a comprehensive explanation, but for now we’ll just cover the bit of knowledge we need to get our state machine working.

The output of a state can be a copy of its input, or the result it produces (for example, output from a `Task` state’s Lambda function), or a combination of its input and result. We can use the `ResultPath` property inside our state machine task definitions to control which combination of these result configurations is passed to the state output (which then, in turn, becomes the input for the next state). 

The reason why our execution failed above is because the default behavior of a Task, if we don’t specify a `ResultPath` property, is to take the task’s output and use it as the input for the next state. In our case, since the previous state (Check Name) generated output of `{ "flagged": false }` this because the input to the next state (Check Address). Instead, what we want to do is preserve the original input, which contains our applicant’s info, merge Check Name’s result into that state, and pass the whole thing down to the Check Address.  Then, Check Address could do the same. What we want to do is get both data checking steps to execute correctly and merge their outputs together for some later step to inspect for further downstream routing logic.

So, to fix our current issue, we need to add a `ResultPath` statement, instructing the state machine to generate its output by taking the Lambda function’s output and merging it with the state’s input. It’s a simple change, really. We just need to add a tiny bit of additional configuration to our Task state definitions: `"ResultPath": "$.SomePropertyName"`. In Amazon States Language, the dollar sign syntax you see here means *the state’s input.* So what we’re saying here is, put the result of this task execution (in this case it’s the Lambda function’s output) into a new property of the object containing the input state, and use that as the state’s output.

### In this step, we will

* Add `ResultPath` properties to our Check Name and Check Address states inside our state machine defined in `serverless.yml`

### Make these changes

Below is a new version of our serverless.yml file that contains updated Check Name and Check Address states, using the ResultPath property to merge their outputs into helpfully-named keys that we can be used later on.


Step 1. Replace `serverless.yml` with <button class="clipboard" data-clipboard-target="#id83b891e8d0654019bb93f03e53a75c8b">this content</button> (click the gray button to copy to clipboard).{{% safehtml %}}<pre id="id83b891e8d0654019bb93f03e53a75c8b" style="position: absolute; left: -1000px; top: -1000px; width: 1px; height: 1px;">service: StepFunctionsWorkshop

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
</pre>{{% /safehtml %}}

<div class="notices note">
    <p>
        Specifically, here are the relevant additions you will have added after pasting the new <code>serverless.yml</code>.<br/><br/>But, <strong>please don't make the edits by hand</strong>. The copy/paste here reduces the risk of typos.
    </p>

    <pre>
    {
        [...]
        "States": {
            "Check Name": {
                [...]

                "ResultPath": "$.checks.name",

                [...]
            },
            "Check Address": {
                [...]

                "ResultPath": "$.checks.address",

                [...]
            },
            [...]
        }
    }
    </pre>
</div>

Step 2. Run:

```bash
sls deploy
```

### Try it out

With our new version deployed, each data checking step will now pass its whole input to its output as well as adding the data checking result to a new property in its output, too. Let’s retry another execution to see how things go.

1. Back in the Step Functions web console, click ‘New Execution’

2. Leave the input the same as before and click ‘Start execution’. This time, you should see the execution succeed.

3. Click on the Check Address state in the visualization section and expand the Input and Output nodes on the right. 

Notice how the Check Name state kept our original input and appended its results inside of `$.checks.name` and how our Check Address took that output as its input and appended its own address check result inside of `$.checks.address`.  That’s the power of `ResultPath` at work!

![Workflow simplified all working](images/simplified-workflow-vis-working.png)

At this point, we have a workflow that executes successfully, but it’s still missing some important logic. Our workflow goes directly from Check Address to Approve Application.  What we actually want is to automatically approve an application only if both the name and address come back without flags, and otherwise we want to queue the application up for review by a human.  

Eventually we will incorporate a step that will wait for a human response on flagged applications. But before that, we need to learn how to inspect the workflow’s state and execute some branching logic based on the checks we define.  To do this, we’ll need to add a new type of state to our state machine called the Choice state.


## Introducing the Choice state type

A Choice state adds branching logic to a state machine. You can think of this like a *switch *statement common in many programming languages. A Choice state has an array of rules.  Each rule contains two things: an expression that evaluates some boolean expression, and a reference to the next state to transition to if this rule matches successfully. All of the rules are evaluated in order and the first rule to match successfully causes the state machine to transition to the next state defined by the rule.

In our example workflow, we want to wait for a human to review an application if either the name or address check comes back as flagged. Otherwise, we want to automatically approve the application.  Let’s add in a Choice state that implements this flow.

Here is what our updated flow will look like after we're done with this step:
![Adding review required check](images/workflow-add-review-required-sm.png)

### In this step, we will

* Add a new placeholder state called 'Pending Review'

* Add a ‘Review Required?’ state that uses the Choice state type to transition to the Pending Review state if either the name or the address checks return with a flag

* Update the Check Address step to transition to the ‘Review Required?’ state

### Make these changes

Step 1. Replace `serverless.yml` with <button class="clipboard" data-clipboard-target="#id9c0896dbaf6c40259494fa85ea9c83ca">this content</button> (click the gray button to copy to clipboard).{{% safehtml %}}<pre id="id9c0896dbaf6c40259494fa85ea9c83ca" style="position: absolute; left: -1000px; top: -1000px; width: 1px; height: 1px;">service: StepFunctionsWorkshop

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
            }
</pre>{{% /safehtml %}}

<div class="notices note">
    <p>
        Specifically, here are the relevant additions you will have added after pasting the new <code>serverless.yml</code>.<br/><br/>But, <strong>please don't make the edits by hand</strong>. The copy/paste here reduces the risk of typos.
    </p>

    <pre>
    {
    [...]

    "States": {
        [...]

        "Check Address": {
            [...]

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
            "Type": "Pass",
            "End": true
        },
        
        
        [...]
        }
    } 
    </pre>
</div>


Step 2. Run:

```bash
sls deploy
```



We just added two new states to our workflow: ‘Review Required?’ and Pending Review.  The ‘Review Required?’ state examines its input (which is the output from the Check Address state) and runs through a series of checks. You can see that there’s an array of two choice rules in the state’s definition, each of which specifies what state name to go to next if its rule matches successfully. There is also a default state name specified to transition to in the event of no rule matches.  

One of our Choices rules says that if the value inside the input located at `checks.name.flagged` is true, then the next state should be Pending Review. The other choice rule expresses something similar, except it looks at `checks.address.flagged` to see if its true, in which case it also transitions to the Pending Review state. Finally, our choice state’s default value indicates that if none of our choice rules match, the state machine should transition to the Approve Application state.

{{% notice tip %}}
For a deeper discussion on the behavior and types of comparisons supported by the Choice state, see our developer guide https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-choice-state.html
{{% /notice %}}


### Try it out

Let’s try some executions to see our Choice state in action:

1. Back in the Step Functions web console, click ‘New execution’

2. Try a valid application by pasting this as input:

    `{ "application": { "name": "Spock", "address": "123 Enterprise Street" } }`

3. Click ‘Start execution’. 

    Notice how the ‘Review Required?’ state transitions to the Approve Application state. That’s because our name and our address both contained valid values.  

4. Try another execution with this invalid application (flagged for an evil name):

    `{ "application": { "name": "evil Spock", "address": "123 Enterprise Street" } }`

    Notice how this time, because we passed in a troublesome name (remember, our name checking logic will flag anything with the string ‘evil’ in the name), our workflow routes to the Pending Review State.

5. Finally, for the sake of completeness, let’s do one more execution with this invalid address:

    `{ "application": { "name": "Spock", "address": "Somewhere" } }`
   
    Once again, notice how we route to the Pending Review state gain, this time because we passed in a troublesome address (our address checking logic will flag anything that does not match the number(s)-space-letter(s) pattern)


Thanks to the Choice state, we are now routing our workflow the way we want. But, we still have placeholder Pass states for our Approve Application and Pending Review steps. We’ll hold off on implementing the Approve Application step until later in the workshop (since we already know how to integrate with a Lambda function call from a step function). Instead, we’ll keep our learning momentum going and learn how to implement our Pending Review state. 



## Starting our workflow when a new application is submitted


In our Pending Review state, we want to have the state machine call out to the Account Applications service to flag the application for review, and then to pause and wait for a callback from the Account Applications service, which will occur after a human reviews the application and makes a decision. Of course, in order for our step function to notify the Account Applications service that a record should be flagged, it’s going to need to pass it an application ID. And the only way the step function will be able to pass an ID back to our applications service is if we include an ID as part of the application information when the step function execution starts. Let’s take care of this now.

To do this, we will integrate our Account Applications service with our application processing step function, starting a new execution each time a new application is submitted to the service. When we start the execution, in addition to passing the applicant’s name and address as input (so the name and address checks can execute), we’ll also pass in the application ID so that the step function can execute the Account Applications service’s FlagApplication function to flag applications for review.

### In this step, we will

* Pass the state machine’s ARN as an environment variable to the SubmitApplication lambda function

* Update the SubmitApplication Lambda function to execute our Step Functions state machine when a new application is submitted, passing the relevant applicant details into the state machine’s input

* Create a new IAM policy that allows executing and interacting with our state machine, and attached this policy to the role used by the SubmitApplication Lambda function

### Make these changes

Step 1. Replace `account-applications/submit.js` with <button class="clipboard" data-clipboard-target="#id722da4bce48b4cb4a573338a58959282">this content</button> (click the gray button to copy to clipboard).{{% safehtml %}}<pre id="id722da4bce48b4cb4a573338a58959282" style="position: absolute; left: -1000px; top: -1000px; width: 1px; height: 1px;">'use strict';
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
    stepfunctions.startExecution(params).promise()
}

module.exports.handler = async(event) => {
    let application
    try {
        application = await submitNewAccountApplication(event)
        await startStateMachineExecution(application)
        return application
    } catch (ex) {
        console.error(ex)
        console.info('event', JSON.stringify(event))

        if (application !== undefined) {
            await AccountApplications.delete(application.id)
        }
        throw ex
    }
}
</pre>{{% /safehtml %}}

<div class="notices note">
    <p>
        Specifically, here are the relevant additions you will have added after pasting the new <code>account-applications/submit.js</code>.<br/><br/>But, <strong>please don't make the edits by hand</strong>. The copy/paste here reduces the risk of typos.
    </p>

    <pre>
    const APPLICATION_PROCESSING_STEP_FUNCTION_ARN = process.env.APPLICATION_PROCESSING_STEP_FUNCTION_ARN

    const stepfunctions = new AWS.StepFunctions();

    const startStateMachineExecution = (application) => {
        const params = {
            "input": JSON.stringify({ application }),
            "name": `ApplicationID-${application.id}`,
            "stateMachineArn": APPLICATION_PROCESSING_STEP_FUNCTION_ARN
        }
        stepfunctions.startExecution(params).promise()
    }

    module.exports.handler = async(event) => {
        let application
        try {
            application = await submitNewAccountApplication(event)
            await startStateMachineExecution(application)
            return application
        }

        // ...
    }
    </pre>
</div>

Step 2. Replace `serverless.yml` with <button class="clipboard" data-clipboard-target="#idf859720a38684150b8d12c789c22caa9">this content</button> (click the gray button to copy to clipboard).{{% safehtml %}}<pre id="idf859720a38684150b8d12c789c22caa9" style="position: absolute; left: -1000px; top: -1000px; width: 1px; height: 1px;">service: StepFunctionsWorkshop

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
            }
</pre>{{% /safehtml %}}

<div class="notices note">
    <p>
        Specifically, here are the relevant additions you will have added after pasting the new <code>serverless.yml</code>.<br/><br/>But, <strong>please don't make the edits by hand</strong>. The copy/paste here reduces the risk of typos.
    </p>

    <pre>
    functions:
        SubmitApplication:
            # ...
            environment:
                # ...
                APPLICATION_PROCESSING_STEP_FUNCTION_ARN: { Ref: "ProcessApplicationsStateMachine" }

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
        # ...
            ManagedPolicyArns:
            # ...
            - { Ref: StepFunctionsPolicy }

    </pre>
</div>

Step 3. Run:

```bash
sls deploy
```


Now that we’ve integrated our Account Applications service with our processing workflow state machine, we’ll trigger all future state machine executions by submitting new applications to the service (by invoking our SubmitApplication function), rather than executing the state machine directly with arbitrary input in the web console. 

### Try it out

1. Run:

    ```bash
    sls invoke -f SubmitApplication --data='{ "name": "Spock", "address": "AnInvalidAddress" }'
    ```

2. Go back to the step functions web console’s detail view for our state machine and look for a new execution at the top of the list. It should have a timestamp close to right now and it will contain a name that starts with ‘ProcessAccountApplication’. If you click in to view the details of this execution, you should see it also take the Pending Review path, as we expect (because we submitted an invalid address), and you should also be able to see an `id` attribute on the application input passed in, and through, the state machine’s steps.

Now that we know we're passing an application ID to the step function successfully, we're ready to have our Pending Review state notify our Account Applications service whenever it wants to flag an application and pause its workflow processing the application until a human makes a decision about it.


## Pausing an execution and waiting for an external callback

Step Functions does its work by integrating with various AWS services directly, and you can control these AWS services using three different service integration patterns: 

* Call a service and let Step Functions progress to the next state immediately after it gets an HTTP response. 
    
    You’ve already seen this integration type in action. It’s what we’re using to call the Data Checking Lambda function and get back a response.
    
* Call a service and have Step Functions wait for a job to complete. 
    
    This is most commonly used for triggering batch style workloads, pausing, then resuming execution after the job completes. We won’t use this style of service integration in this workshop.
    
* Call a service with a task token and have Step Functions wait until that token is returned along with a payload.
    
    This is the integration pattern we want to use here, since we want to make a service call, and then wait for an asynchronous callback to arrive sometime in the future, and then resume execution.


Callback tasks provide a way to pause a workflow until a task token is returned. A task might need to wait for a human approval, integrate with a third party, or call legacy systems. For tasks like these, you can pause a Step Function execution and wait for an external process or workflow to complete.

 In these situations, you can instruct a Task state to generate a unique task token (a unique ID that references a specific Task state in a specific execution), invoke your desired AWS service call, and then pause execution until the Step Functions  service receives that task token back via an API call from some other process.

We’ll need to make a few updates to our workflow in order for this to work. 

### In this step, we will

* Make our Pending Review state invoke our Account Applications Lambda function using a slightly different Task state definition syntax which includes a `.waitForTaskToken` suffix. This will generate a task token which we can pass on to the Account Applications service along with the application ID that we want to flag for review. 

* Make the Account Applications Lambda function update the application record to mark it as pending review and storing the taskToken alongside the record. Then, once a human reviews the pending application, the Account Applications service will make a callback to the Step Functions API, calling the SendTaskSuccesss endpoint, passing back the task token along with the relevant output from this step which, in our case, will be data to indicate if the human approved or rejected the application. This information will let the state machine decide what to do next based on what decision the human made.

* Add another Choice state called 'Review Approved?' that will examine the output from the Pending Review state and transition to the Approve Application state or a Reject Application state (which we’ll also add now).



### Make these changes

Step 1. Replace `account-applications/flag.js` with <button class="clipboard" data-clipboard-target="#idade4d7851dc340879b91b665419ce909">this content</button> (click the gray button to copy to clipboard).{{% safehtml %}}<pre id="idade4d7851dc340879b91b665419ce909" style="position: absolute; left: -1000px; top: -1000px; width: 1px; height: 1px;">'use strict';
const REGION = process.env.REGION
const ACCOUNTS_TABLE_NAME = process.env.ACCOUNTS_TABLE_NAME

const AWS = require('aws-sdk')
AWS.config.update({region: REGION});

const dynamo = new AWS.DynamoDB.DocumentClient();

const AccountApplications = require('./AccountApplications')(ACCOUNTS_TABLE_NAME, dynamo)

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
</pre>{{% /safehtml %}}

<div class="notices note">
    <p>
        Specifically, here are the relevant additions you will have added after pasting the new <code>account-applications/flag.js</code>.<br/><br/>But, <strong>please don't make the edits by hand</strong>. The copy/paste here reduces the risk of typos.
    </p>

    <pre>
    const flagForReview = async (data) => {
        const { id, flagType, taskToken } = data
        // ...
    }

    const updatedApplication = await AccountApplications.update(
        // ...
        {
            // ...
            taskToken
        }
    )
    </pre>
</div>

Step 2. Create `account-applications/review.js` with <button class="clipboard" data-clipboard-target="#id211e5dd84d16405c97a9efa7fdbd5e51">this content</button> (click the gray button to copy to clipboard).{{% safehtml %}}<pre id="id211e5dd84d16405c97a9efa7fdbd5e51" style="position: absolute; left: -1000px; top: -1000px; width: 1px; height: 1px;">'use strict';
const REGION = process.env.REGION
const ACCOUNTS_TABLE_NAME = process.env.ACCOUNTS_TABLE_NAME

const AWS = require('aws-sdk')
AWS.config.update({region: REGION});

const dynamo = new AWS.DynamoDB.DocumentClient();
const stepfunctions = new AWS.StepFunctions();

const AccountApplications = require('./AccountApplications')(ACCOUNTS_TABLE_NAME, dynamo)

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
</pre>{{% /safehtml %}}

Step 3. Replace `serverless.yml` with <button class="clipboard" data-clipboard-target="#ide5ddaa8aedbf47b389385a8474ea0dbe">this content</button> (click the gray button to copy to clipboard).{{% safehtml %}}<pre id="ide5ddaa8aedbf47b389385a8474ea0dbe" style="position: absolute; left: -1000px; top: -1000px; width: 1px; height: 1px;">service: StepFunctionsWorkshop

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
</pre>{{% /safehtml %}}

<div class="notices note">
    <p>
        Specifically, here are the relevant additions you will have added after pasting the new <code>serverless.yml</code>.<br/><br/>But, <strong>please don't make the edits by hand</strong>. The copy/paste here reduces the risk of typos.
    </p>

    <pre>
    ReviewApplication:
        name: ${self:service}__account_applications__review__${self:provider.stage}
        handler: account-applications/review.handler
        environment:
            REGION: ${self:provider.region}
            ACCOUNTS_TABLE_NAME: ${self:custom.applicationsTable}
        role: ReviewRole

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

    StepFunctionRole:
        #...
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
        #...
        DefinitionString:
        !Sub
            - |-
            {
                [...]

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
            }
        - {
            dataCheckingLambdaArn: !GetAtt [DataCheckingLambdaFunction, Arn],
            flagApplicationLambdaName: !Ref FlagApplicationLambdaFunction,
        }
    </pre>
</div>

Step 4. Run:

```bash
sls deploy
```

### Try it out

Now we should be able to submit an invalid application, see that our application gets flagged for review, manually approve or reject the review, and then see our review decision feed back into the state machine for continued execution.

Let’s test this:

1. Submit an invalid application so it gets flagged. Run:

```bash
sls invoke -f SubmitApplication --data='{ "name": "Spock", "address": "123EnterpriseStreet" }'
```

2. Check to see that our application is flagged for review. Run:

```bash
sls invoke -f FindApplications --data='{ "state": "FLAGGED_FOR_REVIEW" }' 
```

3. Copy the application’s ID from the results, which we’ll use in a step below to provide a review decision for the application.

4. In Step Functions web console, refresh the details page for our state machine, and look for the most recent execution. You should see that it is labeled as ‘Running’. 

5. Click in to the running execution and you’ll see in the visualization section that the Pending Review state is in-progress. This is the state machine indicating that it’s now paused and waiting for a callback before it will resume execution.

6. To trigger this callback that it’s waiting for, act as a human reviewer and approve the review (we haven't built a web interface for this, so we'll just invoke another function in the Account Applications service. Take care to paste the ID you copied in Step 3 above into this command when you run it, replacing REPLACE_WITH_APPLICATION_ID. 

    Run with replacement:

    ```bash
    sls invoke -f ReviewApplication --data='{ "id": "REPLACE_WITH_APPLICATION_ID", "decision": "APPROVE" }'
    ```

7. Go back to the execution details page in the Step Functions web console (you shouldn’t need to refresh it), and notice that the execution resumed and, because we approved the review, the state machine transitioned into the Approve Application state after examining the input provided to it by our callback.  You can click on the the ‘Review Approved?‘ step to see our review decision passed into the step’s input (via the SendTaskSuccess callback that `account-applications/review.js` called).


Pretty cool, right?

Finally, all we need to do to finish implementing our example workflow is to replace our Approve Application and Reject Application steps.  Currently they’re just placeholder Pass states, so let’s update them with Task states that will invoke the ApproveApplication and RejectApplication Lambda functions we’ve created..


## Finishing the workflow - approving and rejecting account applications

Until now, we’ve left the Approve Application state empty, using the Pass state a kind of placeholder reminding us to implement the step later. And we just added another placeholder state for Reject Application, too.  Let’s finish our workflow by replacing these Pass states with Task states that invoke appropriate Lambda functions.


### In this step, we will

* Update our state machine, changing the Approve Application and Reject Application states from placeholder Pass state types to Task types that invoke the appropriate Lambda functions in the Data Checking service

* Grant additional permissions to the IAM role that the step function executes under, so that it can invoke the necessary Lambda functions from the Account Applications service


### Make these changes

Step 1. Replace `serverless.yml` with <button class="clipboard" data-clipboard-target="#idf1bbee08bb224d87ac2c46af6bcc04ee">this content</button> (click the gray button to copy to clipboard).{{% safehtml %}}<pre id="idf1bbee08bb224d87ac2c46af6bcc04ee" style="position: absolute; left: -1000px; top: -1000px; width: 1px; height: 1px;">service: StepFunctionsWorkshop

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
                        "Type": "Task",
                        "Parameters": {
                            "id.$": "$.application.id"
                        },
                        "Resource": "#{rejectApplicationLambdaArn}",
                        "End": true
                     },
                     "Approve Application": {
                        "Type": "Task",
                        "Parameters": {
                            "id.$": "$.application.id"
                        },
                        "Resource": "#{approveApplicationLambdaArn}",
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
</pre>{{% /safehtml %}}

<div class="notices note">
    <p>
        Specifically, here are the relevant additions you will have added after pasting the new <code>serverless.yml</code>.<br/><br/>But, <strong>please don't make the edits by hand</strong>. The copy/paste here reduces the risk of typos.
    </p>

    <pre>
    StepFunctionRole:
        #...
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
        #...
        "Reject Application": {
            "Type": "Task",
            "Parameters": {
                "id.$": "$.application.id"
            },
            "Resource": "#{rejectApplicationLambdaArn}",
            "End": true
        },
        "Approve Application": {
            "Type": "Task",
            "Parameters": {
                "id.$": "$.application.id"
            },
            "Resource": "#{approveApplicationLambdaArn}",
            "End": true
        }
        #...
    </pre>
</div> 

Step 2. Run:

```bash
sls deploy
```



With that deploy done, the first fully-working version of our example workflow is complete!  We could take the time now to try another full run through of our workflow and seeing if our application records end up with APPROVED or REJECTED states, but let's hold off on this for now since it's not *that* interesting and we still have room for a bit of improvement in our solution. Specifically, how should we handle errors when things go wrong?


## Improving resiliency by adding retries and error handling to our workflow

Until now, we haven’t taken the time to add any resiliency into our state machine. What happens if some of our Lambda function calls result in a timeout, or if they experience some other sort of transient error? What if they throw an exception? Let’s address these what-ifs now and leverage the built in retry and error handling capabilities of AWS Step Functions.

So, what kind of errors can occur? Here’s what the Step Functions developer guide has to say:


> Any state can encounter runtime errors. Errors can happen for various reasons:

> - State machine definition issues (for example, no matching rule in a `Choice` state) 

> - Task failures (for example, an exception in a Lambda function)

> - Transient issues (for example, network partition events)

> By default, when a state reports an error, AWS Step Functions causes the execution to fail entirely. 


For our example workflow, we’re probably OK with just allowing our workflow to fail when any unexpected errors occur. But some Lambda invocation errors are transient, so we should at least add some retry behavior to our Task states that invoke Lambda functions.

Task states (and others like Parallel states too, which we’ll get to later), have the capability to retry their work after they encounter an error. We just need to add a `Retry` parameter to our Task state definitions, telling them which types of errors they should retry for, and optionally specify additional configuration to control the rate of retries and the maximum number of retry attempts.

The [developer guide identifies the types of transient Lambda service errors that should proactively handle with a retry](https://docs.aws.amazon.com/step-functions/latest/dg/bp-lambda-serviceexception.html) as a best practice.   So let’s add `Retry` configurations to each of our Lambda invoking Task states to handle these transient errors.

### In this step, we will

* Add `Retry` configuration to all of the Task states in our state machine that invoke Lambda functions, providing automated retry resiliency for transient errors


### Make these changes

Step 1. Replace `serverless.yml` with <button class="clipboard" data-clipboard-target="#idc15ede4f8a9842329bb5fcda238e86a3">this content</button> (click the gray button to copy to clipboard).{{% safehtml %}}<pre id="idc15ede4f8a9842329bb5fcda238e86a3" style="position: absolute; left: -1000px; top: -1000px; width: 1px; height: 1px;">service: StepFunctionsWorkshop

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
</pre>{{% /safehtml %}}

<div class="notices note">
    <p>
        Specifically, here are the relevant additions you will have added after pasting the new <code>serverless.yml</code>.<br/><br/>But, <strong>please don't make the edits by hand</strong>. The copy/paste here reduces the risk of typos.
    </p>

    <pre>
    ProcessApplicationsStateMachine:
        #...

        "Check Name": {
            #...
            "Retry": [ {
                "ErrorEquals": [ 
                    "Lambda.ServiceException", 
                    "Lambda.AWSLambdaException", 
                    "Lambda.SdkClientException", 
                    "Lambda.TooManyRequestsException"
                ]
            } ]
            #...
        },

        "Check Address": {
            #...
            "Retry": [ {
                "ErrorEquals": [ 
                    "Lambda.ServiceException", 
                    "Lambda.AWSLambdaException", 
                    "Lambda.SdkClientException", 
                    "Lambda.TooManyRequestsException"
                ]
            } ]
            #...
        },

        #...
    </pre>
</div> 

Step 2. Run:

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

Step 1. Replace `data-checking.js` with <button class="clipboard" data-clipboard-target="#id39703d60a91f4d55995a4d71c69a6078">this content</button> (click the gray button to copy to clipboard).{{% safehtml %}}<pre id="id39703d60a91f4d55995a4d71c69a6078" style="position: absolute; left: -1000px; top: -1000px; width: 1px; height: 1px;">'use strict';

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

</pre>{{% /safehtml %}}

<div class="notices note">
    <p>
        Specifically, here are the relevant additions you will have added after pasting the new <code>data-checking.js</code>.<br/><br/>But, <strong>please don't make the edits by hand</strong>. The copy/paste here reduces the risk of typos.
    </p>

    <pre>
    // ...

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

    // ...
    </pre>
</div> 

Step 2. Replace `serverless.yml` with <button class="clipboard" data-clipboard-target="#ideb03baae78534437887bcf1b31a2a8e6">this content</button> (click the gray button to copy to clipboard).{{% safehtml %}}<pre id="ideb03baae78534437887bcf1b31a2a8e6" style="position: absolute; left: -1000px; top: -1000px; width: 1px; height: 1px;">service: StepFunctionsWorkshop

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
</pre>{{% /safehtml %}}

<div class="notices note">
    <p>
        Specifically, here are the relevant additions you will have added after pasting the new <code>serverless.yml</code>.<br/><br/>But, <strong>please don't make the edits by hand</strong>. The copy/paste here reduces the risk of typos.
    </p>

    <pre>
    ProcessApplicationsStateMachine:
        # ...

        "Check Name": {
            # ...

            "Catch": [ {
                "ErrorEquals": ["UnprocessableDataException"],
                "ResultPath": "$.error-info",
                "Next": "Flag Application As Unprocessable"
            } ]
            
            # ...
        },

        # ...

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

        # ...
    </pre>
</div> 
    
Step 3. Run:

```bash
sls deploy
```

### Try it out

Let’s test out our new error handling capabilities:

1. Try submitting a new application that contains our simulated unprocessable data for the applicant’s name field. 

    Run:

    ```bash
    sls invoke -f SubmitApplication --data='{ "name": "UNPROCESSABLE_DATA", "address": "123 Street" }'
    ```

1. Refresh the state machine in the AWS web console, find the most recent execution, and click into it to view its execution details.

    Notice that our state machine now shows that it encountered, and handled, an error by transitioning to our new Flag Application As Unprocessable state.

2. If you like, you can see that our application record was flagged correctly by running this command:

    ```bash
    sls invoke -f FindApplications --data='{ "state": "FLAGGED_WITH_UNPROCESSABLE_DATA" }'
    ```

![Catching errors](images/workflow-vis-error-catch.png)
Finally, before we wrap up, there’s one more improvement we can make to our workflow.


## Processing independant states in parallel

Up until now we have performed both of our data checking steps in a serial fashion, one after the other. But checking an applicant’s address doesn’t depend on the result from checking the applicant’s name. So, this is a great opportunity to speed things up and perform our two data check steps in parallel instead. 

Step Functions has a `Parallel` state type which, unsurprisingly, lets a state machine perform parallel executions of multiple states. A `Parallel` state causes the interpreter to execute each branch starting with the state named in its `StartAt` field, as concurrently as possible, and wait until each branch terminates (reaches a terminal state) before processing the Parallel state's `Next` field. 

### In this step, we will

* Update our state machine to run the Check Name and Check Address states in parallel using the `Parallel` state type

* Update our state machine's 'Review Requried?' `Choice` state to handle the results from the parallel data checks. We need to do this because the Parallel state returns each check as an element in an array in the same order the steps are specified in the `Parallel` state definition.


### Make these changes

Let's refactor our state machine to  perform the name and address checks in parallel:

Step 1. Replace `serverless.yml` with <button class="clipboard" <button class="clipboard" data-clipboard-target="#idb4777fff9869432893a4624fe24d5013">this content</button> (click the gray button to copy to clipboard).{{% safehtml %}}<pre id="idb4777fff9869432893a4624fe24d5013" style="position: absolute; left: -1000px; top: -1000px; width: 1px; height: 1px;">service: StepFunctionsWorkshop

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
</pre>{{% /safehtml %}}

<div class="notices note">
    <p>
        Specifically, here are the relevant additions you will have added after pasting the new <code>serverless.yml</code>.<br/><br/>But, <strong>please don't make the edits by hand</strong>. The copy/paste here reduces the risk of typos.
    </p>

    <pre>
    ProcessApplicationsStateMachine:
        "StartAt": "Check Applicant Data",
        "States": {
            "Check Applicant Data": {
                "Type": "Parallel",
                "Branches": [
                    {
                        "StartAt": "Check Name",
                        "States": {
                            "Check Name": { ... }
                        },
                    },
                    {
                        "StartAt": "Check Address",
                        "States": {
                            "Check Address": { ... }
                        },
                    }
                ],
                "Catch": [ {
                    "ErrorEquals": ["UnprocessableDataException"],
                    "ResultPath": "$.error-info",
                    "Next": "Flag Application As Unprocessable"
                } ],
                "ResultPath": "$.checks",
                "Next": "Review Required?
            },

              "Review Required?": {
                "Type": "Choice",
                "Choices": [
                    {
                        "Variable": "$.checks[0].flagged",
                        # ...
                    },
                    {
                        "Variable": "$.checks[1].flagged",
                        # ...
                    }
                ],
                "Default": "Approve Application"
            },

            # ...
        }
    </pre>
</div> 

Step 2. Run:

```bash
sls deploy
```

### Try it out

Now you can try a few types of application submissions to see how they each execute:

1. Submit a valid application and see it auto approve after checking the data fields in parallel. Run:
    ```bash
    sls invoke -f SubmitApplication --data='{ "name": "Spock", "address": "123 Enterprise Street" }'
    ```

    Here is what a valid application execution flow looks like:

    ![Parallel check auto approving](images/workflow-vis-parallel-approved.png)

2. Submit an application with an invalid name or address (or both) and see the parallel checks result in the workflow routing to wait for a review. Run:
    ```bash
    sls invoke -f SubmitApplication --data='{ "name": "Gabe", "address": "ABadAddress" }'
    ```

    Here is what an invalid application execution flow looks like:

    ![Parallel check pending](images/workflow-vis-parallel-pending.png)

3. Submit an application with our test unprocessable name to see the parallel data checking state throw the error and route to the state to flag an application as unprocessable. Run: 
    ```bash
    sls invoke -f SubmitApplication --data='{ "name": "UNPROCESSABLE_DATA", "address": "123 Street" }'
    ```

    Here is what an unprocessable application execution flow looks like:
    
    ![Parallel check unprocessable](images/workflow-vis-parallel-unprocessable.png)

At this point, we have a well structured state machine to manage the workflow of processing new account applications for our simple banking system. If we wanted to, we could add on another step in our workflow to handle further downstream logic involved with opening up a bank account for applications that get approved. But, this is a good place to wrap up because you already have all the experience needed to continue implementing these further steps on your own, if you wish.


## Wrapping Up

### Congratulations!

If you’ve taken the time to work through all of the steps in this workshop, you’re now well equipped with the basic knowledge and experience required to begin orchestrating your own service collaborations with AWS Step Functions.

Thanks for choosing to spend your valuable time working through this material.

### Further Learning

{{% notice tip %}}
Did you know that Step Functions can do more than just orchestrate Lambda functions together?<br/><br/>See the points below for some other exciting capabilities that we didn't cover in this workshop.
{{% /notice %}}

**[Activities](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-activities.html)** are an AWS Step Functions feature that **enables you to have a task in your state machine where the work is performed by a worker that can be hosted anywhere**, including Amazon Elastic Compute Cloud (Amazon EC2), Amazon Elastic Container Service (Amazon ECS), mobile devices, or anywhere else you can have a process poll the AWS Step Functions API over HTTPS.

**The [Map](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-map-state.html) state can be used to run a set of steps for each element of an input array.** While the Parallel state executes multiple branches of steps using the same input, a Map state will execute the same steps for multiple entries of an array in the state input.

**The [Wait](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-wait-state.html) state delays the state machine from continuing for a specified time.** You can choose either a relative time, specified in seconds from when the state begins, or an absolute end time, specified as a timestamp. 

**Step Functions can integrate directly with _many_ other AWS Services** including AWS Batch, Amazon DynamoDB, Amazon ECS and Fargate, Amazon SQS and SNS, AWS Glue, Amazon Sagemaker, and more! Check out the [full list of AWS service integrations](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-service-integrations.html) for more info.

### Next Steps

If you'd like to continue your Step Functions learning journey, the best next step is to read through the [Developer Guide](https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html).  After that, check out some [sample projects](https://docs.aws.amazon.com/step-functions/latest/dg/create-sample-projects.html). Finally, you can browse relevant webinars, blog posts, reference architectures, videos, and more at the [AWS Step Functions Resources](https://aws.amazon.com/step-functions/resources/) page.


### Cleaning up

If you want to clean up the resources you've deployed in this workshop, just follow the steps below.

#### Removing the resources we provisioned

1. The Serverless Framework can remove everything it provisioned. From the Cloud9 terminal, run: 
   
    ```bash
    sls remove
    ```


#### Deleting the Cloud9 workspace

1. Go to your [Cloud9 Environment](https://us-east-1.console.aws.amazon.com/cloud9/home?region=us-east-1)

2. Select the environment named **workshop** and pick **Delete**

3. **Type the phrase** 'Delete' into the confirmation box and click **Delete**
