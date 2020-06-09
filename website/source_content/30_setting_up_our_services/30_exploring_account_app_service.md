+++
title = "Exploring the example services"
chapter = false
weight = 30
+++

Let’s take a moment to manually interact with each of these functions to understand the surface area of our Account Application service and Data Checking service APIs.

These services are implemented as a collection of AWS Lambda functions. The Account Application service gives us the ability to:

- Submit new applications

- View a list of applications for each state

- Flag an application for review

- Approve or reject applications

And, the Data Checking service lets us:

- Check a name to make sure it's OK

- Validate an address against a simple pattern match


{{% notice note %}}
Please note that while our Account Application service includes the ability to allow us to flag an application, we have not yet encoded any logic to determine *when* a submitted application might get flagged. We’re just setting up the basic capabilities that we will need in order to orchestrate alongside the separate Data Checking service, which we'll soon orchestrate together to implement our desired workflow.
{{% /notice %}}

### Try it out

Using the AWS SAM CLI, we can invoke any of our services' functions with the following parameters depending on what we’d like to do. Try running each of these commands in turn to understand what we can do with applications or user data right now.

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

Next, we’ll try out the Data Checking service capabilities.

➡️ Step 5. Check a valid name. Run:

```
aws lambda invoke --function-name sfn-workshop-DataChecking --payload '{"command": "CHECK_NAME", "data": { "name": "Spock" } }' /dev/stdout
```

Notice that the result returns `{"flagged":false}`.

➡️ Step 6. Check an invalid name. Run:

```
aws lambda invoke --function-name sfn-workshop-DataChecking --payload '{"command": "CHECK_NAME", "data": { "name": "evil Spock" } }' /dev/stdout
```

Notice that the result returns `{"flagged":true}`.

➡️ Step 7. Check a valid address. Run:

```
aws lambda invoke --function-name sfn-workshop-DataChecking --payload '{"command": "CHECK_ADDRESS", "data": { "address": "123 Street" } }' /dev/stdout
```

Notice that the result returns `{"flagged":false}`.

➡️ Step 8. Check an invalid address. Run:

```
aws lambda invoke --function-name sfn-workshop-DataChecking --payload '{"command": "CHECK_ADDRESS", "data": { "address": "DoesntMatchAddressPattern" } }' /dev/stdout
```

Notice that the result returns `{"flagged":true}`.

As you can see, the Data Checking service just returns a simple JSON style response with one variable, `flagged` returning true if the value being checked requires further scrutiny by a human.

We now have all the basic capabilities we need in our services in order to begin connecting them together to implement the beginnings of our desired application processing workflow. The big question is "how should we connect these services together to implement our workflow?"