+++
title = "Exploring the Account Applications service"
chapter = false
weight = 30
+++

The Account Application service is implemented as a collection of AWS Lambda functions. This first version of our service gives us a basic set of capabilities: we can:

- Submit new applications

- View a list of applications for each state

- Flag an application for review

- Approve or reject applications


{{% notice note %}}
Please note that while this service includes the ability to allow us to flag an application, we have not yet encoded any logic to determine *when* a submitted application might get flagged. We’re just setting up the basic capabilities that we will need in order to orchestrate alongside a separate Data Checking service which we'll soon implement to complete our full example account application processing workflow.
{{% /notice %}}

### Try it out

Using the AWS SAM CLI, we can invoke any of the service’s functions with the following parameters depending on what we’d like to do. Try running each of these commands in turn to understand what we can do with applications right now.

{{% notice info %}}
Below, we're using the AWS CLI, via `aws lambda invoke ...`, to directly invoke a deployed AWS Lambda function with our desired payloads. We haven't started using AWS Step Functions yet. Here, we are just exploring the surface area of the Lambda functions that we will begin to orchestrate using Step Functions a bit later on in this workshop.
{{% /notice %}}

➡️ Step 1. Submit a new application. In the terminal, run:

```bash
aws lambda invoke --function-name sfn-workshop-SubmitApplication --payload '{ "name": "Spock", "address": "123 Enterprise Street" }' /dev/stdout 
```

Copy the ID of the new application, shown in the output from the above command. We’ll use it in the next step.

![Workflow collaboration](/images/copy-application-id.png)


➡️ Step 2. Flag an application for review (replace REPLACE_WITH_ID below with the ID of the application you just created in step 1). Run with replacement:

```bash
aws lambda invoke --function-name sfn-workshop-FlagApplication --payload '{ "id": "REPLACE_WITH_ID", "flagType": "REVIEW" }' /dev/stdout
```

➡️ Step 3. List all of the applications that are currently flagged for review. Run:

```bash
aws lambda invoke --function-name sfn-workshop-FindApplications --payload '{ "state": "FLAGGED_FOR_REVIEW" }' /dev/stdout
```

We could also run the above function with other states like ‘SUBMITTED’ or ‘APPROVED’ or ‘REJECTED’.

➡️ Step 4. Approve the application (replace REPLACE_WITH_ID below with the ID of the application ID you copied in step 1). Run with replacement:

```bash
aws lambda invoke --function-name sfn-workshop-ApproveApplication --payload '{ "id": "REPLACE_WITH_ID" }' /dev/stdout
```



We just manually took an application through the steps of being submitted, then flagged for review, then approved. But, the workflow we  want to implement requires the Account Applications service to collaborate with a Data Checking service, checking an applicant’s name and address against some business rules to decide if an application needs to be reviewed by a human. 

Next, we’ll create the Data Checking service, and then we’ll connect the Account Applications service to the Data Checking service with some orchestration glue so we can automatically decide if an application should be flagged for review or not.
