+++
title = "Fixing Permissions"
chapter = false
weight = 40
+++

Rather than continue to work in the web console and make these fixes by hand, we’ll return to our `serverless.yml` file to define our state machine alongside the other resources used in this workshop, and we’ll take care to also set up the appropriate permissions for this state machine to execute successfully.

### In this step, we will

* Define our new AWS Step Functions state machine inside `serverless.yml`

* Add a new IAM role for our state machine to assume when it executes. The role grants permission for the state machine to invoke our Data Checking Lambda function.

### Make these changes

Before we migrate our step function definition over to our `serverless.yml` file, we should delete the function we’ve been interacting with in the Step Functions web console so that we don’t get confused when a similar state machine is deployed as part of our Serverless stack deployment.

➡️ Step 1. In the left sidebar of the Step Functions web console, click ‘State machines’

➡️ Step 2. Select the state machne that we manually defined earlier, click ‘Delete’, and click ‘Delete state machine’ to confirm the deletion.

➡️ Step 3. Now, let’s re-define our state machine inside our `serverless.yaml` file. Replace `serverless.yml` with ___CLIPBOARD_BUTTON c9b0e65eca70946d4da2fceaca4b26bfc6641a76:serverless.yml|

➡️ Step 4. Run:

```bash
sls deploy
```


### Try it out

➡️ Step 1. Head back to the Step Functions web console and look for a state machine named `StepFunctionsWorkshop__process_account_applications__dev` and click it. This is the re-deployed version of our state machine. The new version of our state machine hasn’t changed, except that we granted its IAM role permissions to invoke our Data Checking lambda. Let’s try executing it again with some sample input to see what happens.

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

![Workflow simplified address cancelled](images/simplified-workflow-vis-address-error.png)

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

![Check Address expected data](images/check_address_expectation.png)

The error message is telling us that it couldn’t find `application.address` in the state’s input. To understand why, we need to learn a bit more about how an active state generates its output and passes it to the next state’s input.