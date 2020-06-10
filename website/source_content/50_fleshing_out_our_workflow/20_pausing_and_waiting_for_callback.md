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

➡️ Step 1. Replace `functions/account-applications/flag.js` with ___CLIPBOARD_BUTTON 278b0babefb143aafbbf1bb5c773a62fcd3f374f:account-applications/flag.js|

➡️ Step 2. Run:
```bash
touch functions/account-applications/review.js
```

➡️ Step 3. Replace `functions/account-applications/review.js` with ___CLIPBOARD_BUTTON 278b0babefb143aafbbf1bb5c773a62fcd3f374f:account-applications/review.js|

➡️ Step 4. Replace `template.yaml` with ___CLIPBOARD_BUTTON code/variants/template.yml/2-submit-executes-step-function__template.yaml&code/variants/template.yml/3-add-review-application__template.yaml|

➡️ Step 5. Replace `statemachine/account-application-workflow.asl.json` with ___CLIPBOARD_BUTTON code/variants/statemachine/3-add-review-required__account-application-workflow.asl.json&code/variants/statemachine/4-integrate-callback-from-review__account-application-workflow.asl.json|

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