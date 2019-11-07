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

* Create a new IAM policy that allows executing and interacting with our state machine, and attached this policy to the role used by the SubmitApplication Lambda function

### Make these changes

➡️ Step 1. Replace `account-applications/submit.js` with ___CLIPBOARD_BUTTON 509c5f4da832d190d3285f30d91fd29c3253b6fb:code/account-applications/submit.js|

➡️ Step 2. Replace `serverless.yml` with ___CLIPBOARD_BUTTON 55e4f1b3cf75014bbad84ac40e00a17e32969798:serverless.yml|

➡️ Step 3. Run:

```bash
sls deploy
```


Now that we’ve integrated our Account Applications service with our processing workflow state machine, we’ll trigger all future state machine executions by submitting new applications to the service (by invoking our SubmitApplication function), rather than executing the state machine directly with arbitrary input in the web console. 

### Try it out

➡️ Step 1. Run:

```bash
sls invoke -f SubmitApplication --data='{ "name": "Spock", "address": "AnInvalidAddress" }'
```

➡️ Step 2. Go back to the step functions web console’s detail view for our state machine and look for a new execution at the top of the list. It should have a timestamp close to right now and it will contain a name that starts with ‘ApplicationID-’. If you click in to view the details of this execution, you should see it also take the Pending Review path, as we expect (because we submitted an invalid address), and you should also be able to see an `id` attribute on the application input passed in, and through, the state machine’s steps.

Now that we know we're passing an application ID to the step function successfully, we're ready to have our Pending Review state notify our Account Applications service whenever it wants to flag an application and pause its workflow processing the application until a human makes a decision about it.