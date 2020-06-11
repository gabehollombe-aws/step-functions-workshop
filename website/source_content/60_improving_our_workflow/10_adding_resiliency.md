+++
title = "Improving resiliency by adding retries and error handling to our workflow"
chapter = false
weight = 10
+++

Until now, we haven’t taken the time to add any resiliency into our state machine. What happens if some of our Lambda function calls result in a timeout, or if they experience some other sort of transient error? What if they throw an exception? Or, imagine that one of our Lambda functions was calling a third-party service. That external call could fail or timeout as well. Let’s address these what-ifs now and leverage the built in retry and error handling capabilities of AWS Step Functions.

So, what kind of errors can occur? Here’s what the Step Functions developer guide has to say:


> Any state can encounter runtime errors. Errors can happen for various reasons:

> - State machine definition issues (for example, no matching rule in a `Choice` state) 

> - Task failures (for example, an exception in a Lambda function)

> - Transient issues (for example, network partition events)

> By default, when a state reports an error, AWS Step Functions causes the execution to fail entirely. 


For our example workflow, we’re probably OK with just allowing our workflow to fail when any unexpected errors occur. But some Lambda invocation errors are transient, so we should at least add some retry behavior to our Task states that invoke Lambda functions.

## Adding Retries

Task states (and others like Parallel states too, which we’ll get to later), have the capability to retry their work after they encounter an error. We just need to add a `Retry` parameter to our Task state definitions, telling them which types of errors they should retry for, and optionally specify additional configuration to control the rate of retries and the maximum number of retry attempts.

The developer guide identifies the [types of transient Lambda service errors](https://docs.aws.amazon.com/step-functions/latest/dg/bp-lambda-serviceexception.html) that should proactively handle with a retry as a best practice.   So let’s add `Retry` configurations to each of our Lambda invoking Task states to handle these transient errors.

### In this step, we will

* Add `Retry` configuration to all of the Task states in our state machine that invoke Lambda functions, providing automated retry resiliency for transient errors


### Make these changes

➡️ Step 1. Replace `statemachine/account-application-workflow.asl.json` with ___CLIPBOARD_BUTTON code/variants/statemachine/5-add-approve-reject__account-application-workflow.asl.json&code/variants/statemachine/6-add-retries__account-application-workflow.asl.json|


➡️ Step 2. Run:

```bash
sam deploy
```


{{% notice tip %}}
We could have specified additional configuration for our `Retry` parameters, including `IntervalSeconds` (defaults to  1), `MaxAttempts` (defaults to  3), and `BackoffRate` (defaults to 2), but the defaults are fine for our case, so we’ll just go with the default values.
{{% /notice %}}

Now, we can’t actually test any of these errors easily, because all of the exceptions we’ve added retries for are transient in nature. But now you know how to add these types of retries yourself as a best practice. Moving on, let’s learn how to handle specific application-level errors, too.

## Catching Errors

In addition to handling transient problems with Retries, Step Functions also allows us to catch specific errors and respond by transitioning to appropriate states to handle these errors. For example, let’s pretend that there are some types of names that our Data Checking service can’t handle. In these cases, we don’t want to flag the application for review, but we want to flag the application in a way that signifies to the business that it is unprocessable to due to incompatible data. 

To show this in action, we’ll leverage some test code in our Data Checking Lambda that tells it to throw an error if it sees a specific test string come through in an applicant’s name. We’ll update our state machine to catch this specific type of custom error and redirect to a new state, Flag Application As Unprocessable, that will flag the application appropriately.

### In this step, we will

* Add a new Flag Application As Unprocessable state to our state machine which will update our account application appropriately

* Add a `Catch` configuration to our Check Name state in our state machine, causing a transition to the Flag Application As Unprocessable state

### Make these changes

➡️ Step 1. Replace `statemachine/account-application-workflow.asl.json` with ___CLIPBOARD_BUTTON code/variants/statemachine/6-add-retries__account-application-workflow.asl.json&code/variants/statemachine/7-add-catch__account-application-workflow.asl.json|

➡️ Step 2. Run:

```bash
sam deploy
```

### Try it out

Let’s test out our new error handling capabilities:

➡️ Step 1. Try submitting a new application that contains our simulated unprocessable data for the applicant’s name field. Run:

```bash
aws lambda invoke --function-name sfn-workshop-SubmitApplication --payload '{ "name": "UNPROCESSABLE_DATA", "address": "123 Street" }' /dev/stdout 
```

➡️ Step 2. Refresh the state machine in the AWS web console, find the most recent execution, and click into it to view its execution details.

Notice that our state machine now shows that it encountered, and handled, an error by transitioning to our new Flag Application As Unprocessable state.

➡️ Step 3. If you like, you can see that our application record was flagged correctly by running this command:

```bash
aws lambda invoke --function-name sfn-workshop-FindApplications --payload '{ "state": "FLAGGED_WITH_UNPROCESSABLE_DATA" }' /dev/stdout 
```

![Catching errors](/images/workflow-vis-error-catch.png)

Finally, before we wrap up, there’s one more improvement we can make to our workflow.