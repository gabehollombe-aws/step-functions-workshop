# Workshop - The Art of the State: Building fully-managed service coordination workflows powered by state machines in the cloud using AWS Step Functions

* * *

## Important note to internal reviewers

Hello! Thanks for taking the time to review this workshop content! At this stage, the content is a first draft. The steps should work, and the explanations are here, but I’m sure there are many things that could be improved. More pictures? More or less words? As you're going through this, please feel empowered to suggest any and all improvements you think might help, even if you're not 100% sure they are improvements, more feedback is better than less! 

Feel free to leave feedback as comments in this quip doc, or email/Chime me directly at [gabehol@amazon.com](mailto:gabehol@amazon.com)

Thanks! 
Gabe Hollombe
* * *

## Welcome

In this workshop, you’ll learn how to coordinate workflows involving distributed services using a simple, yet powerful, fully managed service called AWS Step Functions.

TODO: write more intro text here

TODO: add pre-requisites step with info on requiring AWS account, user with admin privs, etc.


## Our example business domain

It’s much easier to explore concepts around distributed service coordination when we have concrete systems to talk about. For this workshop, we’ll discuss a set of services (in our case they’ll all be implemented with simple AWS Lambda functions) that comprise a very small slice of a very simplified banking system. The workshop will focus on implementing the workflow to handle processing new bank account applications by checking particulars of an applicant’s information and handling cases that require human review. 

Our demo system is comprised of a few services with the following responsibilities:

* **Account Applications service** - handles the processing of new bank account applications from submission. Requires answers from the Data Checking service to provide validation checks against the applicant’s name and address. 
* **Data Checking service** - validates data related to names and addresses
* **Accounts service** - could be responsible for opening and operating bank accounts. We won’t actually implement this service in this workshop (because we’ll focus on the orchestration between the Account Applications and Data Checking services) but it’s useful to think about it as a placeholder that we might want to interact with as well.



## Our desired workflow

We use the term *orchestration* to describe the act of coordinating distributed services via a centralized workflow manager process, similar to how a conductor understands each part of a orchestra and directs each instrument section to act together to create a specific performance result. 

Orchestration’s main benefit for service coordination is that it places all of the logic required to usher data between services to achieve a specific workflow in one central place, rather than encoding that logic across many services that need to know how to work with each other. This means that if anything about processing a workflow needs to change, there’s only one place to update: the process that’s managing the orchestration. It also means it’s easier to understand how various services are used together in concert, since you only need to look in one place to understand the entire flow from start to finish.

This approach works best when there is a higher level of coordination needed between services, often involving the need for robust retries, specific error handling, and optimized processing logic like conducting some steps in parallel or waiting for some steps to complete before continuing to execute a particular process. In the picture below, we can see how an orchestration-based approach for our bank account application processing workflow could work.

[Image: image.png]
In our example workflow, orchestration is a good fit for managing the bank account application process because the logic is almost all singularly focused on moving an account application through to the point where a decision can be made to approve or reject the application. The Account Applications service uses the Data Checking service in its workflow to do its job, but it feels right that the Account Applications service should own and drive this workflow and manage the services it collaborates to accomplish its goals of processing account applications.

So this is exactly the design we’ll implement now in this workshop.  We’ll use orchestration to manage our bank account processing workflow — the Account Applications service will accept incoming applications and process each application (by collaborating with the Data Checking service and waiting for humans to review flagged applications). Once an application has moved all the way through the workflow and if a decision is made to approve the application, the workflow could end by notifying an Accounts service to open an account for a user.

OK! We’ve covered enough background. It’s time to get hands-on and learn by building.


## Processing new bank account applications

Once a new account application comes in to our example system, we want to check some of its data and then either automatically approve it if there were no issues with the data, or flag it for human review if any of our data checks come back with a flag. A human reviewer will periodically check for flagged applications and decide to approve or reject each flagged application. In principle, once we have an approval decision made for an account application, we could automatically open an account, but for simplicity’s sake, we’re just going to focus on making a decision for an application, since there’s enough to focus on here to illustrate many important orchestration concepts.

To sum up, here is the workflow we want to manage:

1. Check an applicant’s name and address against a service to detect if they’re suspicious or otherwise warrant review by a human before processing the account application
2. If the name and address checks come back without any issues, then automatically approve the application. If we encounter an error trying to check the name or the address, flag the application as unprocessable and stop. Otherwise, if the name or address checks reveal a concern about the data, proceed to step 3
3. Flag the application for review by a human and pause further processing
4. Wait for a human to review the flagged application and make an approve or reject decision for the application
5. Approve or reject the application, as per the reviewer’s decision


And here’s a diagram to illustrate our desired workflow for processing account applications:
[Image: image.png]



## Preparing to create our example services

Now that we have an idea of the workflow we’d like, we need to stand up some services that will handle the various steps in our workflow.  Once we have some services deployed, we can orchestrate them together to implement this workflow. Let’s get to it!

For the purposes of this workshop, rather than deploying full web services, we’ll just deploy each of our services into their own AWS Lambda functions and invoke these functions directly. This way we keep our deployments simple with less moving parts so we can focus our attention on how to orchestrate these services, rather than on providing an external interface (like a set of HTTP REST endpoints) to authenticate and front these services.

In this project, we’ll use the Serverless Framework to help us write, deploy, and test the functionality in our services. 


## Creating the Account Application service

To start, we’ll create several functions that, when taken collectively, could be considered to be our Account Applications service. Namely, we’ll make functions allowing us to submit new applications (consisting of just a record with a name and an address), flag applications for review, and mark applications as approved or rejected. We’ll also add a capability to list all applications of in a certain state (like SUBMITTED or FLAGGED) to save ourselves the trouble of inspecting the service’s data store directly.


### Make these changes

First, install the Serverless CLI tool, initialize a new project, install two dependencies from NPM, and remove the default Lambda function handler created by the new project:

```
npm install -g serverless
mkdir workshop-dir
cd workshop-dir
serverless create --template aws-nodejs
npm install --save serverless-cf-vars uuid
rm handler.js
```


Next, we’ll create the first version of a set of functions that make up the feature set of our Account Applications service. Rather than creating all of the necessary files by hand, you can copy/paste the following script directly into a Bash shell,

```
# Create a directory for all our Account Applications Lambda functions
mkdir account-applications
pushd account-applications

# approve.js
#------------------------------------------------------------------------
cat <<EOT >> approve.js
'use strict';
const REGION = process.env.REGION
const ACCOUNTS_TABLE_NAME = process.env.ACCOUNTS_TABLE_NAME

const AWS = require('aws-sdk')
AWS.config.update({region: REGION});

const dynamo = new AWS.DynamoDB.DocumentClient();



const getApplication = async (id) => {
    const params = {
      TableName: ACCOUNTS_TABLE_NAME,
      Key: { id: id }
    };
    
    const result = await dynamo.get(params).promise()    
    return result.Item
}


const updateApplication = async (id, attributes) => {
    const application = await getApplication(id)
    const updatedApplication = Object.assign(application, attributes)
    const params = {
        TransactItems: [
            {
                Put: {
                    TableName: ACCOUNTS_TABLE_NAME,
                    Item: updatedApplication
                }
            }
        ]
    };
    await dynamo.transactWrite(params).promise()
    return updatedApplication
}


const approveApplication = async (data) => {
    const { id } = data

    const updatedApplication = await updateApplication(
        id, 
        { state: 'APPROVED' }
    )

    return updatedApplication
}

module.exports.handler = async(event) => {
    try {
        const result = await approveApplication(event)
        return result
    } catch (ex) {
        console.error(ex)
        console.info('event', JSON.stringify(event))
        throw ex
    }
};
EOT

# find.js
#------------------------------------------------------------------------
cat <<EOT >> find.js
'use strict';
const REGION = process.env.REGION
const ACCOUNTS_TABLE_NAME = process.env.ACCOUNTS_TABLE_NAME

const AWS = require('aws-sdk')
AWS.config.update({region: REGION});

const dynamo = new AWS.DynamoDB.DocumentClient();

const findAllByState = async (data) => {
    const { state, paginationKey=null } = data
    const params = {
        TableName: ACCOUNTS_TABLE_NAME,
        IndexName: 'state',
        KeyConditionExpression: '#state = :state',
        ExclusiveStartKey: paginationKey,
        ExpressionAttributeNames: { '#state': 'state' },
        ExpressionAttributeValues: { ':state': state }
    }
    const result = await dynamo.query(params).promise()
    return result
}

module.exports.handler = async(event) => {
    try {
        const result = await findAllByState(event)
        return result
    } catch (ex) {
        console.error(ex)
        console.info('event', JSON.stringify(event))
    }
};
EOT


# flag.js
#------------------------------------------------------------------------
cat <<EOT >> flag.js
'use strict';
const REGION = process.env.REGION
const ACCOUNTS_TABLE_NAME = process.env.ACCOUNTS_TABLE_NAME

const AWS = require('aws-sdk')
AWS.config.update({region: REGION});

const dynamo = new AWS.DynamoDB.DocumentClient();

const getApplication = async (id) => {
    const params = {
      TableName: ACCOUNTS_TABLE_NAME,
      Key: { id: id }
    };

    const result = await dynamo.get(params).promise()
    return result.Item
}

const updateApplication = async (id, attributes) => {
    const application = await getApplication(id)
    const updatedApplication = Object.assign(application, attributes)
    const params = {
        TransactItems: [
            {
                Put: {
                    TableName: ACCOUNTS_TABLE_NAME,
                    Item: updatedApplication
                }
            }
        ]
    };
    await dynamo.transactWrite(params).promise()
    return updatedApplication
}

const flagForReview = async (data) => {
    const { id, flagType } = data

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

    const updatedApplication = await updateApplication(
        id,
        {
            state: newState,
            reason,
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
EOT

# reject.js
#------------------------------------------------------------------------
cat <<EOT >> reject.js
'use strict';
const REGION = process.env.REGION
const ACCOUNTS_TABLE_NAME = process.env.ACCOUNTS_TABLE_NAME

const AWS = require('aws-sdk')
AWS.config.update({region: REGION});

const dynamo = new AWS.DynamoDB.DocumentClient();



const getApplication = async (id) => {
    const params = {
      TableName: ACCOUNTS_TABLE_NAME,
      Key: { id: id }
    };
    
    const result = await dynamo.get(params).promise()    
    return result.Item
}


const updateApplication = async (id, attributes) => {
    const application = await getApplication(id)
    const updatedApplication = Object.assign(application, attributes)
    const params = {
        TransactItems: [
            {
                Put: {
                    TableName: ACCOUNTS_TABLE_NAME,
                    Item: updatedApplication
                }
            }
        ]
    };
    await dynamo.transactWrite(params).promise()
    return updatedApplication
}


const rejectApplication = async (data) => {
    const { id } = data

    const updatedApplication = await updateApplication(
        id, 
        { state: 'REJECTED' }
    )

    return updatedApplication
}

module.exports.handler = async(event) => {
    try {
        const result = await rejectApplication(event)
        return result
    } catch (ex) {
        console.error(ex)
        console.info('event', JSON.stringify(event))
        throw ex
    }
};
EOT


# submit.js
#------------------------------------------------------------------------
cat <<EOT >> submit.js
'use strict';
const REGION = process.env.REGION
const ACCOUNTS_TABLE_NAME = process.env.ACCOUNTS_TABLE_NAME

const AWS = require('aws-sdk')
const uuid = require('uuid/v4')
AWS.config.update({region: REGION});

const dynamo = new AWS.DynamoDB.DocumentClient();

const applicationKey = id => `application|${id}`

const submitNewAccountApplication = async (data) => {
    const id = uuid()
    const { name, address } = data
    const application = { id: applicationKey(id), name, address, state: 'SUBMITTED' }
    let params = {
        TransactItems: [
            {
                Put: {
                    TableName: ACCOUNTS_TABLE_NAME,
                    Item: application
                }
            }
        ]
    };
    await dynamo.transactWrite(params).promise()

    return application
} 

module.exports.handler = async(event) => {
    try {
        const result = await submitNewAccountApplication(event)
        return result
    } catch (ex) {
        console.error(ex)
        console.info('event', JSON.stringify(event))
        throw ex
    }
};
EOT


# serverless.yml
#------------------------------------------------------------------------
cat <<EOT >> serverless.yml
service: StepFunctionsWorkshop

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
EOT


popd
```


TODO: insert explanation about serverless.yml and the resources we’re creating

Finally, perform our first deployment of our new service:

Run: `sls deploy`

Now we have a fully-deployed Lambda function that can handle all of the steps involved to move an application from SUBMITTED, to FLAGGED, to APPROVED or REJECTED. 

Let’s take a moment to manually interact with each of these functions to understand the surface area of our first version of the Account Application Service API.


## Exploring The Account Application service API

The Account Application service is implemented as a collection of AWS Lambda functions. This first version of our service gives us a basic set of capabilities: we can submit new applications, view a list of applications for each state, flag an application for review, and approve or reject applications.  One thing that’s important to note here is that while this service includes the ability to allow us to flag an application, we have not yet encoded any logic to determine *when* a submitted application might get flagged. We’re just setting up the basic capabilities that we’ll orchestrate together along with other services later to implement our full example account application processing workflow.

Using the Serverless framework CLI, we can invoke any of the service’s functions with the following parameters depending on what we’d like to do. Try running each of these commands in turn to understand what we can do with applications right now.


1. Submit a new application

`sls invoke -f SubmitApplication --log --data='{ "name": "Spock", "address": "123 Enterprise Street" }'`

Copy the ID of the new application, shown in the output from the above command. We’ll use it in the next step.


1. Flag an application for review (replace REPLACE_WITH_ID below with the ID of the application you just created in step 1):

`sls invoke -f FlagApplication --log --data='{ "id": "REPLACE_WITH_ID", "flagType": "REVIEW" }'`


1. List all of the applications that are currently flagged for review:

`sls invoke -f FindApplications --log --data='{ "state": "FLAGGED_FOR_REVIEW" }'`

We could also run the above function with other states like ‘SUBMITTED’ or ‘APPROVED’ or ‘REJECTED’.


1. Approve the application (replace REPLACE_WITH_ID below with the ID of the application ID you copied in step 1):

`sls invoke -f ApproveApplication --log --data='{ "id": "REPLCE_WITH_ID" }'`


We just manually took an application through the steps of being submitted, then flagged for review, then approved. But, the workflow we  want to implement requires the Account Applications service to collaborate with a Data Checking service, checking an applicant’s name and address against some business rules to decide if an application needs to be reviewed by a human. 

Next, we’ll create the Data Checking service, and then we’ll connect the Account Applications service to the Data Checking service with some orchestration glue so we can automatically decide if an application should be flagged for review or not.



## Creating the Data Checking Service

To keep things simple, we’ll create the Data Checking service as just another Lambda function defined in our same Serverless project folder. 

Also, for the sake of keeping our code simple, we’ll implement our name and address checking logic with some overly-simple rules: 

* Any name will be flagged if it contains the lowercase string ‘evil’ anywhere in it. So ‘Spock’ is OK but ‘evil Spock’ is not.
* Any address will be flagged if it doesn’t match the pattern of one or more number digits, followed by a space, followed by one or more letters. So, ‘123 Enterprise Street’ is OK but ‘123EnterpriseStreet’ and ‘Some Street’ and ‘123’ are not.

### Make these changes

1. Implement our data checking needs in a new `data-checking.js` file. From `workshop-dir` run:
2. # data-checking.js
    #------------------------------------------------------------------------
    cat <<EOT >> data-checking.js
    'use strict';
    
    const checkName = async (data) => {
        const { name } = data
    
        const flagged = (name.indexOf('evil') !== -1)
        return { flagged }
    }
    
    const checkAddress = async (data) => {
        const { address } = data
    
        const flagged = (address.match(/[0-9]+ \w+/g) === null)
        return { flagged }
    }
    
    
    const commandHandlers = {
        'CHECK_NAME': checkName,
        'CHECK_ADDRESS': checkAddress,
    }
    
    module.exports.handler = async(event) => {
        try {
            const { command, data } = event
    
            const result = await commandHandlers[command](data)
            return result
        } catch (ex) {
            console.error(ex)
            console.info('event', JSON.stringify(event))
            throw ex
        }
    };
    EOT

1. Replace `serverless.yml` with the following:
2. service: StepFunctionsWorkshop
    
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

1. Run `sls deploy` 

### What we changed



* Created `data-checking.js` to implement our Data Checking service needs
* Added new configuration to `serverless.yml` to create a new AWS Lambda function from `data-checking.js` along with a new IAM role with permissions for the function to log to Amazon CloudWatch

### Try it out

After the deploy finishes, we can interact with our new data-checking lambda to check any name or address string we like. Try each check with valid and invalid inputs.


1. Check a valid name

`sls invoke -f DataChecking --log --data='{"command": "CHECK_NAME", "data": { "name": "Spock" } }'`


1. Check an invalid name

`sls invoke -f DataChecking --log --data='{"command": "CHECK_NAME", "data": { "name": "evil Spock" } }'`


1. Check a valid address

`sls invoke -f DataChecking --log --data='{"command": "CHECK_ADDRESS", "data": { "address": "123 Street" } }'`


1. Check an invalid address
    

`sls invoke -f DataChecking --log --data='{"command": "CHECK_ADDRESS", "data": { "address": "DoesntMatchAddressPattern" } }'`

As you can see, the Data Checking service just returns a simple JSON style response with one variable, `flagged` returning true if the value being checked requires further scrutiny by a human.

We now have all the basic capabilities we need in our services in order to begin connecting them together to implement the beginnings of our desired application processing workflow. The big question is ‘how should we connect these services together’?  


## How should we connect our services together?

Given our earlier exploration of the orchestration versus choreography patterns, this case feels like a very strong candidate for orchestration. We have the beginnings of a workflow here, with logic dictating what state an application should end up in after checking an applicant’s name and address. So, the next question is *how should we implement this orchestration?*

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

### MAke these changes

To start out, let’s just try to model the steps involved to check a name, check an address, and then approve an application.

[Image: image.png]

1. Open the AWS Step Functions web console
2. If the left sidebar is collapsed, expand it
3. Make sure you’re in the State machines section and click the ‘Create state machine’  button on the right
4. Enter ‘Process_New_Account_Applications’ for the Name
5. Paste the following JSON into the State machine definition area

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


In AWS Step Functions, we define our state machines using a JSON-based structured language called Amazon States Language.  You can read more about the full language specification and all of the supported state types at https://states-language.net/spec.html

At this point, although we’ve created a valid step function, it doesn’t really *do* anything because the Pass state we’re using in our definition just passes input straight through to its output without performing any work. Our state machine just transitions through three Pass states and ends. Nevertheless, let’s quickly try out a simple execution so we can see this for ourselves.

### Try it out

1. Click ‘Start execution’
2. Every time we ask Step Functions to execute a state machine, we can provide some initial input if we want. Let’s just leave the initial example input as-is and click ‘Start execution’
3. You’ll now see the details page for the execution we just triggered. Click on any of the step names in the visualization and notice how we can see the input and output values for each state in the execution.
    
    
4. [Image: image.png]



Now that you understand how to define and execute a state machine, let’s update our state machine definition to actually perform some work by calling out to the Data Checking service to check the name and the address. For our new definition, we’ll use the Task state to perform some work. 


## Introducing the Task state

The Task State causes the interpreter to execute work identified by the state’s Resource field. Below, we’ll use Task states to invoke our Data Checking service lambda function, passing appropriate name and address attributes from our application in to the Lambda function invocations.

In the Task states below, in addition to specifying the ARN of the Lambda function we want the Task state to use, we also include a Parameters section. This is how we pass data from the state’s input into the target Lambda function’s input. You’ll notice that we’re using a syntax that includes dollar signs at the end of each property name and the beginning of each property value. This is so that Step Functions knows we want to inject state data into these parameters instead of actually sending a raw string of “$.application.name” for example.  The state machine description we use below assumes that the state machine will receive an initial input object with a single property called ‘application’ that has ‘name’ and ‘address’ properties on it. We’ll specify this input for execution in a moment after we update our state machine definition.

### make these changes

1. Click ‘Edit state machine’
2. Paste in the following updated state machine definition, 

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



1. Back on your terminal, run `sls info --verbose | grep DataCheckingLambdaFunctionQualifiedArn | cut -d ' ' -f 2` and copy the output, which shows the ARN for the Data Checking Lambda to your clipboard.
2. In the state machine definition you pasted in step 3, go back and find the two occurrences of REPLACE_WITH_DATA_CHECKING_LAMBDA_ARN and replace them with the ARN you copied in step 3.
3. Click ‘Save’
4. Notice how we receive a warning that our IAM role may need to change in order to allow our updated state machine to execute. This is a helpful reminder. In fact, we *have* changed our state machine in way that will require permissions changes. Now, we require the ability to invoke our Data Checking Lambda function in order to execute this state machine. We’ll address this next. Click ‘Save anyway’ to continue.

### try it out

The warning we saw just now when we updated our state machine definition was correct. We *will* need to update our IAM role permissions in order for this to work. But let’s try another execution anyway just to see what an insufficient permission failure looks like.


1. Click ‘New execution’
2. Paste the following JSON into the input field

```
{
    "application": { 
        "name": "Spock", 
        "address": "123 Enterprise Street" 
    }
}
```

1. Click ‘Start execution’. After a moment, you should see the results of this failed execution. The ‘Execution Status’ label shows ‘Failed’ underneath it, and you’ll see a big red background in the visualization section, highlighting the state that experienced a failure. 

1. Click the failed state, then expand the Exception area on the right-hand side to see more details about the failure. You should see something like the screenshot below.


[Image: image.png]
This failure isn’t surprising. When this state machine executes, it assumes an IAM role in order to determine which sorts of actions it’s allowed to take inside the AWS cloud. And, of course, we haven’t yet added any explicit permissions to allow this role to invoke our Data Checking Lambda so, to keep things secure, we get a failure when this state machine tries to run.

Let’s fix this by adding the appropriate permissions to the role that our Step Function assumes during execution. 

However, rather than continue to work in the web console and make these fixes by hand, we’ll return to our `serverless.yml` file to define our state machine alongside the other resources used in this workshop, and we’ll take care to also set up the appropriate permissions for this state machine to execute successfully.


### make these changes

Before we migrate our step function definition over to our `serverless.yml` file, we should delete the function we’ve been interacting with in the Step Functions web console so that we don’t get confused when a similar state machine is deployed as part of our Serverless stack deployment.

1. In the left sidebar of the Step Functions web console, click ‘State machines
2. Select the step function we defined manually earlier, click ‘Delete’, and click ‘Delete state machine’ to confirm the deletion.

Now let’s re-define our state machine inside our `serverless.yaml` file.

Git msg: ‘Add StepFunction simplified workflow to serverless.yml’

1. Replace `serverless.yml` with the following:
2. service: StepFunctionsWorkshop
    
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

1. Run `sls deploy`

### What we changed

* Defined our new AWS Step Functions state machine inside `serverless.yml`
* Added a new IAM role for our state machine to assume when it executes. The role grants permission for the state machine to invoke our Data Checking Lambda function.

### Try it out

Now, head back to the Step Functions web console and look for a state machine named StepFunctionsWorkshop`__process_account_applications__dev` and click it. This is the re-deployed version of our state machine. The new version of our state machine hasn’t changed, except that we granted its IAM role permissions to invoke our Data Checking lambda. Let’s try executing it again with some sample input to see what happens.


1. Click ‘Start execution’
2. Paste the following JSON into the input field
3. {
        "application": { 
            "name": "Spock", 
            "address": "123 Enterprise Street" 
        }
    }
4. Click ‘Start execution’


After a moment, you should see that the execution failed. But, this time, we don’t have any red states, because our failure mode is different. 

Now, we know that our state machine was able to execute our Data Checking lambda function because the ‘Check Name’ state is green. But, notice how the ‘Check Address’ state has a dark gray background. If you look at the color code at the bottom of the visualization section, you’ll see that this means the state was cancelled. Let’s see why.

[Image: image.png]

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


```
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


The error message is telling us that it couldn’t find `application.address` in the state’s input. To understand why, we need to learn a bit more about how an active states generates its output and passes it to the next state’s input.


## Managing state inputs and outputs

Each Step Function state machine execution receives a JSON file as input and passes that input to the first state in the workflow. Individual states receive JSON as input and usually pass JSON as output to the next state. Understanding how this information flows from state to state, and learning how to filter and manipulate this data, is key to effectively designing and implementing workflows in AWS Step Functions. The [Input and Output Processing](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-input-output-filtering.html) section of the AWS Step Functions developer guide provides a comprehensive explanation, but for now we’ll just cover the bit of knowledge we need to get our state machine working.

The output of a state can be a copy of its input, or the result it produces (for example, output from a `Task` state’s Lambda function), or a combination of its input and result. We can use the `ResultPath` property inside our state machine task definitions to control which combination of these result configurations is passed to the state output (which then, in turn, becomes the input for the next state). 

The reason why our execution failed above is because the default behavior of a Task, if we don’t specify a `ResultPath` property, is to take the task’s output and use it as the input for the next state. In our case, since the previous state (Check Name) generated output of `{ "flagged": false }` this because the input to the next state (Check Address). Instead, what we want to do is preserve the original input, which contains our applicant’s info, merge Check Name’s result into that state, and pass the whole thing down to the Check Address.  Then, Check Address could do the same. What we want to do is get both data checking steps to execute correctly and merge their outputs together for some later step to inspect for further downstream routing logic.

So, to fix our current issue, we need to add a `ResultPath` statement, instructing the state machine to generate its output by taking the Lambda function’s output and merging it with the state’s input. It’s a simple change, really. We just need to add a tiny bit of additional configuration to our Task state definitions: `"ResultPath": "$.SomePropertyName"`. In Amazon States Language, the dollar sign syntax you see here means *the state’s input.* So what we’re saying here is, put the result of this task execution (in this case it’s the Lambda function’s output) into a new property of the object containing the input state, and use that as the state’s output.

### make these changes

Below is a new version of our serverless.yml file that contains updated Check Name and Check Address states, using the ResultPath property to merge their outputs into helpfully-named keys that we can be used later on.


1. Replace `serverless.yml` with the following:
2. service: StepFunctionsWorkshop
    
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

1. Run `sls deploy`



### What we changed

* Added `ResultPath` properties to our Check Name and Check Address states

### Try it out

With our new version deployed, each data checking step will now pass its whole input to its output as well as adding the data checking result to a new property in its output, too. Let’s retry another execution to see how things go.

1. Back in the Step Functions web console, click ‘New Execution’
2. Leave the input the same as before and click ‘Start execution’. This time, you should see the execution succeed.
3. Click on the Check Address state in the visualization section and expand the Input and Output nodes on the right. 


Notice how the Check Name state kept our original input and appended its results inside of `$.checks.name` and how our Check Address took that output as its input and appended its own address check result inside of `$.checks.address`.  That’s the power of `ResultPath` at work!

[Image: image.png]At this point, we have a workflow that executes successfully, but it’s still missing some important logic. Our workflow goes directly from Check Address to Approve Application.  What we actually want is to automatically approve an application only if both the name and address come back without flags, and otherwise we want to queue the application up for review by a human.  

Eventually we will incorporate a step that will wait for a human response on flagged applications. Bur before that, we need to learn how to inspect the workflow’s state and execute some branching logic based on the checks we define.  To do this, we’ll need to add a new type of state to our state machine called the Choice state.


## Introducing the choice State Type

A Choice state adds branching logic to a state machine. You can think of this like a *switch *statement common in many programming languages. A Choice state has an array of rules.  Each rule contains two things: an expression that evaluates some boolean expression, and a reference to the next state to transition to if this rule matches successfully. All of the rules are evaluated in order and the first rule to match successfully causes the state machine to transition to the next state defined by the rule.

In our example workflow, we want to wait for a human to review an application if either the name or address check comes back as flagged. Otherwise, we want to automatically approve the application.  Let’s add in a Choice state that implements this flow.


1. Replace `serverless.yml` with the following:
2. service: StepFunctionsWorkshop
    
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

1. Run `sls deploy`

### what we changed

* Added a placeholder Pending Review state
* Added a ‘Review Required?’ state that uses the Choice state type to transition to the Pending Review state if either the name or the address checks return with a flag
* Updated the Check Address step to transition to the ‘Review Required?’ state


We just added two new states to our workflow: ‘Review Required?’ and Pending Review.  The ‘Review Required?’ state examines its input (which is the output from the Check Address state) and runs through a series of checks. You can see that there’s an array of two choice rules in the state’s definition, each of which specifies what state name to go to next if its rule matches successfully. There is also a default state name specified to transition to in the event of no rule matches.  

One of our Choices rules says that if the value inside the input located at `checks.name.flagged` is true, then the next state should be Pending Review. The other choice rule expresses something similar, except it looks at `checks.address.flagged` to see if its true, in which case it also transitions to the Pending Review state. Finally, our choice state’s default value indicates that if none of our choice rules match, the state machine should transition to the Approve Application state.

For a deeper discussion on the behavior and types of comparisons supported by the Choice state, see our developer guide https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-choice-state.html
[Image: image.png]

### Try it out

Let’s try some executions to see our Choice state in action:

1. Click ‘New execution’
2. Try a ‘valid’ application by pasting this as input
3. { "application": { "name": "Spock", "address": "123 Enterprise Street" } }
4. Click ‘Start execution’
5. Notice how the Review Required? state transitions to the Approve Application state. That’s because our name and our address both contained valid values.  
6. Try another execution with this ‘invalid’ application
7. { "application": { "name": "evil Spock", "address": "123 Enterprise Street" } }
8. Notice how this time, because we passed in a troublesome name (remember, our name checking logic will flag anything with the string ‘evil’ in the name), our workflow routes to the Pending Review State.
9. Finally, for the sake of completeness, let’s do one more execution with this ‘invalid’ address
10. { "application": { "name": "Spock", "address": "Somewhere" } }
11. Once again, notice how we route to the Pending Review state gain, this time because we passed in a troublesome address (our address checking logic will flag anything that does not match the number(s)-space-letter(s) pattern)


Thanks to the Choice state, we are now routing our workflow the way we want. But, we still have placeholder Pass states for our Approve Application and Pending Review steps. We’ll hold off on implementing the Approve Application step until later in the workshop (since we already know how to integrate with a Lambda function call from a step function). Instead, we’ll keep our learning momentum going and learn how to implement our Pending Review state. 



## Starting our workflow when a new application is submitted


What we want to do in this Pending Review state is have the state machine call out to the Account Applications service to flag the application for review, and then to pause and wait for a callback from the Account Applications service, which will occur after a human reviews the application and makes a decision. Of course, in order for our step function to notify the Account Applications service that a record should be flagged, it’s going to need to pass it an application ID. And the only way the step function will be able to pass an ID back to our applications service is if we include an ID as part of the application information when the step function execution starts. Let’s take care of this now.

What we’ll do is integrate our account applications service with our application processing step function, starting a new execution each time a new application is submitted to the service. When we start the execution, in addition to passing the applicant’s name and address as input (so the name and address checks can execute), we’ll also pass in the application ID so that the step function can execute the Account Applications service’s FlagApplication function to flag applications for review.

### Make these changes

1. Replace `account-applications.submit.js` with the following:
2. 'use strict';
    const REGION = process.env.REGION
    const ACCOUNTS_TABLE_NAME = process.env.ACCOUNTS_TABLE_NAME
    const APPLICATION_PROCESSING_STEP_FUNCTION_ARN = process.env.APPLICATION_PROCESSING_STEP_FUNCTION_ARN
    
    const AWS = require('aws-sdk')
    const uuid = require('uuid/v4')
    AWS.config.update({region: REGION});
    
    const dynamo = new AWS.DynamoDB.DocumentClient();
    const stepfunctions = new AWS.StepFunctions();
    
    const applicationKey = id => `application|${id}`
    
    const submitNewAccountApplication = async (data) => {
        const id = uuid()
        const { name, address } = data
        const application = { id: applicationKey(id), name, address, state: 'SUBMITTED' }
        let params = {
            TransactItems: [
                {
                    Put: {
                        TableName: ACCOUNTS_TABLE_NAME,
                        Item: application
                    }
                }
            ]
        };
        await dynamo.transactWrite(params).promise()
    
        params = {
            "input": JSON.stringify({ application }),
            "name": `ProcessAccountApplication-${id}`,
            "stateMachineArn": APPLICATION_PROCESSING_STEP_FUNCTION_ARN
        }
        await stepfunctions.startExecution(params).promise()
    
        return application
    } 
    
    module.exports.handler = async(event) => {
        try {
            const result = await submitNewAccountApplication(event)
            return result
        } catch (ex) {
            console.error(ex)
            console.info('event', JSON.stringify(event))
            throw ex
        }
    };

1. Replace `serverless.yml` with the following:
2. service: StepFunctionsWorkshop
    
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

1. Run `sls deploy`



### what we changed

* Passed the state machine’s ARN as an environment variable to the SubmitApplication lambda function
* Updated the SubmitApplication Lambda function to execute our Step Functions state machine when a new application is submitted, passing the relevant applicant details into the state machine’s input
* Created a new IAM policy that allows executing and interacting with our state machine, and attached this policy to the role used by the SubmitApplication Lambda function


Now that we’ve integrated our Account Applications service with our processing workflow state machine, we’ll trigger all future state machine executions by submitting new applications to the service (by invoking our SubmitApplication function), rather than executing the state machine directly with arbitrary input in the web console. 

### try it out

1. Run `sls invoke -f SubmitApplication --log --data='{ "name": "Spock", "address": "AnInvalidAddress" }'`
2. Go back to the step functions web console’s detail view for our state machine and look for a new execution at the top of the list. It should have a timestamp close to right now and it will contain a name that starts with ‘ProcessAccountApplication’. If you click in to view the details of this execution, you should see it also take the Pending Review path, as we expect (because we submitted an invalid address), and you should also be able to see an `id` attribute on the application input passed in, and through, the state machine’s steps.

Now that we know we're passing an application ID to the step function successfully, we're ready to have our Pending Review state notify our Account Applications service whenever it wants to flag an application and pause its workflow processing the application until a human makes a decision about it.


## Pausing an execution and waiting for an external callback

Step Functions does its work by integrating with various AWS services directly, and you can control these AWS services using three different service integration patterns: 

* Call a service and let Step Functions progress to the next state immediately after it gets an HTTP response. 
    
    You’ve already seen this integration type in action. It’s what we’re using to call the Data Checking lambda function and get back a response.
    
* Call a service and have Step Functions wait for a job to complete. 
    
    This is most commonly used for triggering batch style workloads. pausing, then resuming execution after the job completes. We won’t use this style of service integration in this workshop.
    
* Call a service with a task token and have Step Functions wait until that token is returned along with a payload.
    
    This is the integration pattern we want to use here, since we want to make a service call, and then wait for an asynchronous callback to arrive sometime in the future, and then resume execution.


Callback tasks provide a way to pause a workflow until a task token is returned. A task might need to wait for a human approval, integrate with a third party, or call legacy systems. For tasks like these, you can pause a Step Function execution and wait for an external process or workflow to complete.

 In these situations, you can instruct a Task state to generate a unique task token (a unique ID that references a specific Task state in a specific execution), invoke your desired AWS service call, and then pause execution until the Step Functions  service receives that task token back via an API call from some other process.

We’ll need to make a few updates to our workflow in order for this to work. Here’s the outline of the changes we’ll make:

* We will make our Pending Review state invoke our Account Applications Lambda function using a slightly different Task state definition syntax which includes a `.waitForTaskToken` suffix. This will generate a task token which we can pass on to the Account Applications service along with the application ID that we want to flag for review. 
* The Account Applications Lambda function will need to update the application record to mark it as pending review, and it will store the taskToken alongside the record.
* Once a human reviews the pending application, the Account Applications service will make a callback to the Step Functions API, calling the SendTaskSuccesss endpoint, passing back the task token along with the relevant output from this step which, in our case, will be data to indicate if the human approved or rejected the application. This information will let the state machine decide what to do next based on what decision the human made.
* We’ll add another Choice state called Review Approved? that will examine the output from the Pending Review state and transition to the Approve Application state or a Reject Application state (which we’ll also add now).



### Make these changes

1. Replace `account-applications/flag.js` with the following:
2. 'use strict';
    const REGION = process.env.REGION
    const ACCOUNTS_TABLE_NAME = process.env.ACCOUNTS_TABLE_NAME
    
    const AWS = require('aws-sdk')
    AWS.config.update({region: REGION});
    
    const dynamo = new AWS.DynamoDB.DocumentClient();
    
    const getApplication = async (id) => {
        const params = {
          TableName: ACCOUNTS_TABLE_NAME,
          Key: { id: id }
        };
    
        const result = await dynamo.get(params).promise()
        return result.Item
    }
    
    const updateApplication = async (id, attributes) => {
        const application = await getApplication(id)
        const updatedApplication = Object.assign(application, attributes)
        const params = {
            TransactItems: [
                {
                    Put: {
                        TableName: ACCOUNTS_TABLE_NAME,
                        Item: updatedApplication
                    }
                }
            ]
        };
        await dynamo.transactWrite(params).promise()
        return updatedApplication
    }
    
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
    
        const updatedApplication = await updateApplication(
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

1. Create `account-applications/review.js` with the following content:
2. 'use strict';
    const REGION = process.env.REGION
    const ACCOUNTS_TABLE_NAME = process.env.ACCOUNTS_TABLE_NAME
    
    const AWS = require('aws-sdk')
    AWS.config.update({region: REGION});
    
    const dynamo = new AWS.DynamoDB.DocumentClient();
    const stepfunctions = new AWS.StepFunctions();
    
    const getApplication = async (id) => {
        const params = {
          TableName: ACCOUNTS_TABLE_NAME,
          Key: { id: id }
        };
        
        const result = await dynamo.get(params).promise()    
        return result.Item
    }
    
    const updateApplication = async (id, attributes) => {
        const application = await getApplication(id)
        const updatedApplication = Object.assign(application, attributes)
        const params = {
            TransactItems: [
                {
                    Put: {
                        TableName: ACCOUNTS_TABLE_NAME,
                        Item: updatedApplication
                    }
                }
            ]
        };
        await dynamo.transactWrite(params).promise()
        return updatedApplication
    }
    
    const updateApplicationWithDecision = (id, decision) => {
        if (decision !== 'APPROVE' && decision !== 'REJECT') {
            throw new Error("Required `decision` parameter must be 'APPROVE' or 'REJECT'")
        }
    
        switch(decision) {
            case 'APPROVE': return updateApplication(id, { state: 'REVIEW_APPROVED' })
            case 'REJECT': return updateApplication(id, { state: 'REVIEW_REJECTED' })
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

1. Replace `serverless.yml` with the following:
2. service: StepFunctionsWorkshop
    
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

1. Run `sls deploy`



### What we changed

* Updated our state machine to have the Pending Review state invoke our FlagApplication Lambda function, causing it to pass it a task token and pause until Step Functions receives a callback to continue
* Updated `account-applications/flag.js` to store the `taskToken` passed to it from our state machine
* Implemented a ReviewApplication Lambda function in `account-applications/review.js` to handle updating our application state and notifying our state machine of the review decision via a callback using the AWS Step Functions `SendTaskSuccess` API
* Added a placeholder Reject Application state to our state machine
* Added a ‘Review Approved?’ state to our state machine that examines the result passed to it from our ReviewApplication Lambda function and transitions to Approve Application or Reject Application appropriately
* Updated `serverless.yml` to create our new ReviewApplication Lambda function using an appropriately permissioned IAM role

### Try it ouT

Now we should be able to submit an invalid application, see that our application gets flagged for review, manually approve or reject the review, and then see our review decision feed back into the state machine for continued execution.

Let’s test this:


1. Submit an invalid application so it gets flagged. Run:
2. 1.  sls invoke -f SubmitApplication \
    2. --log \
    3. --data='{ "name": "Spock", "address": "123EnterpriseStreet" }'
    

1. Check to see that our application is flagged for review. Run:

```
sls invoke -f FindApplications 
\--log 
\--data='{ "state": "FLAGGED_FOR_REVIEW" }'
```

1. Copy the application’s ID from the results, which we’ll use in a step below to provide a review decision for the application.

1. In Step Functions web console, refresh the details page for our state machine, and look for the most recent execution. You should see that it is labeled as ‘Running’. 
2. Click in to the running execution and you’ll see in the visualization section that the Pending Review state is in-progress. This is the state machine indicating that it’s now paused and waiting for a callback before it will resume execution.
3. To trigger this callback that it’s waiting for, act as a human reviewer and approve the review (we haven't built a web interface for this, so we'll just invoke another function in the Account Applications service. Take care to paste the ID you copied in Step 3 above into this command when you run it, replacing REPLACE_WITH_APPLICATION_ID. Run with replacement:
4. sls invoke -f ReviewApplication \
    --log \
    --data='{ "id": "REPLACE_WITH_APPLICATION_ID", "decision": "APPROVE" }'
5. Go back to the execution details page in the Step Functions web console (you shouldn’t need to refresh it), and notice that the execution resumed and, because we approved the review, the state machine transitioned into the Approve Application state after examining the input provided to it by our callback.  You can click on the the ‘Review Approved?‘ step to see our review decision passed into the step’s input (via the SendTaskSuccess callback that `account-applications/review.js` called).


Pretty cool, right?

Finally, all we need to do to finish implementing our example workflow is to replace our Approve Application and Reject Application steps.  Currently they’re just placeholder Pass states, so let’s update them with Task states that will invoke the ApproveApplication and RejectApplication Lambda functions we’ve created..


## Finishing the workflow - approving and rejecting account applications

Until now, we’ve left the Approve Application state empty, using the Pass state a kind of placeholder reminding us to implement the step later. And we just added another placeholder state for Reject Application, too.  Let’s finish our workflow by replacing these Pass states with Task states that invoke appropriate Lambda functions.


### Make these changes

1. Replace `serverless.yml` with the following:
2. service: StepFunctionsWorkshop
    
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

1. Run `sls deploy`



### what we changed

* Updated our state machine, changing the Approve Application and Reject Application states from placeholder Pass state types to Task types that invoke the appropriate Lambda functions in the Data Checking service


With that deploy done, the first fully-working version of our example workflow is complete!  

But there is still room for a bit of improvement in our solution. How should we handle errors when things go wrong?


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

### Make these changes

1. Replace `serverless.yml` with the following:
2. service: StepFunctionsWorkshop
    
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

1. Run `sls deploy`

### What we changed

* Added `Retry` configuration to all of the Task states in our state machine that invoke Lambda functions, providing automated retry resiliency for transient errors


Note: we could specify additional configuration for our `Retry` parameters, including `IntervalSeconds` (defaults to  1), `MaxAttempts` (defaults to  3), and `BackoffRate` (defaults to 2), but the defaults are fine for our case, so we’ll just go with the default values.

Now, we can’t actually test any of these errors easily, because all of the exceptions we’ve added retries for are transient in nature. But now you know how to add these types of retries yourself as a best practice. Moving on, let’s learn how to handle specific application-level errors, too.

In addition to handling transient problems with Retries, Step Functions also allows us to catch specific errors and respond by transitioning to appropriate states to handle these errors. For example, let’s pretend that there are some types of names that our Data Checking service can’t handle. In these cases, we don’t want to flag the application for review, but we want to flag the application in a way that signifies to the business that it is unprocessable to due to incompatible data. 

To show this in action, we’ll update our Data Checking Lambda, telling it to throw an error if it sees a specific test string come through in an applicant’s name. We’ll update our state machine to catch this specific type of custom error and redirect to a new state, Flag Application As Unprocessable, that will flag the application appropriately.

### Make these changes

1. Replace `data-checking.js` with the following:
2. 'use strict';
    
    const checkName = async (data) => {
        const { name } = data
    
        if (name.indexOf("UNPROCESSABLE_DATA") !== -1) {
            const simulatedError = new Error(`Simulated error: Name '${name}' is not possible to check.`)
            simulatedError.name = 'UnprocessableDataException'
            throw simulatedError
        }
    
        const flagged = (name.indexOf('evil') !== -1)
        return { flagged }
    }
    
    const checkAddress = async (data) => {
        const { address } = data
    
        const flagged = (address.match(/[0-9]+ \w+/g) === null)
        return { flagged }
    }
    
    
    const commandHandlers = {
        'CHECK_NAME': checkName,
        'CHECK_ADDRESS': checkAddress,
    }
    
    module.exports.handler = async(event) => {
        try {
            const { command, data } = event
    
            const result = await commandHandlers[command](data)
            return result
        } catch (ex) {
            console.error(ex)
            console.info('event', JSON.stringify(event))
            throw ex
        }
    };

1. Replace `serverless.yml` with the following:
2. service: StepFunctionsWorkshop
    
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

1. Run `sls deploy`

### what we changed

* Updated `data-checking.js` to throw an `UnprocessableDataException` whenever someone passes in a special string of `UNPROCESSABLE_DATA` as a name to be checked
* Added a new Flag Application As Unprocessable state to our state machine which will update our account application appropriately
* Added a `Catch` configuration to our Check Name state in our state machine, causing a transition to the Flag Application As Unprocessable state

### Try it out

Let’s test out our new error handling capabilities:

1. Try submitting a new application that contains our simulated unprocessable data for the applicant’s name field. 

```
sls invoke -f SubmitApplication \
--log \
--data='{ "name": "UNPROCESSABLE_DATA", "address": "123 Street" }'
```

1. Refresh the state machine in the AWS web console, find the most recent execution, and click into it to view its execution details
2. Notice that our state machine now shows that it encountered, and handled, an error by transitioning to our new Flag Application As Unprocessable state.
3. If you like, you can see that our application record was flagged correctly by running this command:
4. sls invoke -f FindApplications \
    --log \
    --data='{ "state": "FLAGGED_WITH_UNPROCESSABLE_DATA" }'

[Image: image.png]
Finally, before we wrap up, there’s one more improvement we can make to our workflow.


## Processing independant states in parallel

Up until now we have performed both of our data checking steps in a serial fashion, one after the other. But checking an applicant’s address doesn’t depend on the result from checking the applicant’s name. So, this is a great opportunity to speed things up and perform our two data check steps in parallel instead. 

Step Functions has a `Parallel` state type which, unsurprisingly, lets a state machine perform parallel executions of multiple states. A `Parallel` state causes the interpreter to execute each branch starting with the state named in its `StartAt` field, as concurrently as possible, and wait until each branch terminates (reaches a terminal state) before processing the Parallel state's `Next` field. 

### Make these changes

Let's refactor our state machine to  perform the name and address checks in parallel:

1. Replace `serverless.yml` with the following:
2. service: StepFunctionsWorkshop
    
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

1. Run `sls deploy`

### what we changed

* Updated our state machine to run the Check Name and Check Address states in parallel using the `Parallel` state type
* Updated our state machine's Check Applicant Data `Choice` state to handle the results from the parallel data checks, which returns each check as an element in an array in the same order the steps are specified in the `Parallel` state definition

### Try it out

Now you can try a few types of application submissions to see how they each execute:


1. Submit a valid application and see it auto approve after checking the data fields in parallel. Run:

```
sls invoke -f SubmitApplication \
--log \
--data='{ "name": "Spock", "address": "123 Enterprise Street" }'
```

[Image: image.png]



1. Submit an application with an invalid name or address (or both) and see the parallel checks result in the workflow routing to wait for a review. Run:

```
sls invoke -f SubmitApplication \
--log \
--data='{ "name": "Gabe", "address": "ABadAddress" }'
```

[Image: image.png]


1. Submit an application with our test unprocessable name to see the parallel data checking state throw the error and route to the state to flag an application as unprocessable. Run:

```
sls invoke -f SubmitApplication \
--log \
--data='{ "name": "UNPROCESSABLE_DATA", "address": "123 Street" }'
```

[Image: image.png]
At this point, we have a well structured state machine to manage the workflow of processing new account applications for our simple banking system. If we wanted to, we could add on another step in our workflow to handle further downstream logic involved with opening up a bank account for applications that get approved. But, this is a good place to wrap up because you already have all the experience needed to continue implementing these further steps on your own, if you wish.


## Wrapping Up

Congratulations! If you’ve taken the time to work through all of the steps in this workshop, you’re now well equipped with the knowledge and experience to begin orchestrating your own service collaborations with AWS Step Functions.


TODO - write more conclusion steps here. Include cleanup instructions with `sls remove`








