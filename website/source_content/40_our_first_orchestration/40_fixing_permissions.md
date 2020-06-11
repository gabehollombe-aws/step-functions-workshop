+++
title = "Fixing Permissions"
chapter = false
weight = 40
+++

Rather than continue to work in the web console and make these fixes by hand, we’ll use the AWS SAM tooling to define our state machine alongside the other resources used in this workshop, and we’ll take care to also set up the appropriate permissions for this state machine to execute successfully.

### In this step, we will

* Define our new AWS Step Functions state machine inside a new file located at `statemachine/account-application-workflow.asl.json`

* Update our SAM template file `template.yaml` to include a resource to deploy our new state machine

* Add a new IAM role for our state machine to assume when it executes. The role grants permission for the state machine to invoke our Data Checking Lambda function.

### Make these changes

Before we migrate our step function definition over to our `template.yaml` file, we should delete the state machine we’ve been interacting with in the Step Functions web console so that we don’t get confused when a similar state machine is deployed as part of our Serverless stack deployment.

➡️ Step 1. In the left sidebar of the Step Functions web console, click ‘State machines’

➡️ Step 2. Select the state machne that we manually defined earlier, click ‘Delete’, and click ‘Delete state machine’ to confirm the deletion.

➡️ Step 3. Now, we'll need to create a new file to hold our state machine definition in our filesystem. From inside `workshop-dir` run:
```bash
mkdir -p statemachine && pushd statemachine && touch account-application-workflow.asl.json && popd
```
This will create a blank `statemachine/account-application-workflow.asl.json` inside `workshop-dir`.

➡️ Step 4. Replace `statemachine/account-application-workflow.asl.json` with ___CLIPBOARD_BUTTON a0d7df16df74104c36cb221ee8f4f61bab25ef76:code/variants/statemachine/1-first-version__account-application-workflow.asl.json|

➡️ Step 5. Now, we'll update SAM's `template.yaml` file to reference our new state machine. Replace `template.yaml` with ___CLIPBOARD_BUTTON code/variants/template.yml/0-initial__template.yaml&code/variants/template.yml/1-fixing-permissions__template.yaml|

➡️ Step 6. Redeploy our application:

```bash
sam build && sam deploy
```


### Try it out

➡️ Step 1. Head back to the Step Functions web console and look for a state machine named `ApplicationProcessingStateMachine-xxxxxxxxxxxx` and click it (note: the x's shown here are placehodlers for a suffix unique to your deployment). This is the re-deployed version of our state machine. The new version of our state machine hasn’t changed, except that we granted its IAM role permissions to invoke our Data Checking lambda. Let’s try executing it again with some sample input to see what happens.

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

![Workflow simplified address cancelled](/images/simplified-workflow-vis-address-error.png)

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

![Check Address expected data](/images/check_address_expectation.png)

The error message is telling us that it couldn’t find `application.address` in the state’s input. To understand why, we need to learn a bit more about how an active state generates its output and passes it to the next state’s input.