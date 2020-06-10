+++
title = "Managing State Inputs and Outputs"
chapter = false
weight = 50
+++

Each Step Function state machine execution receives a JSON document as input and passes that input to the first state in the workflow. Individual states receive JSON as input and usually pass JSON as output to the next state. Understanding how this information flows from state to state, and learning how to filter and manipulate this data, is key to effectively designing and implementing workflows in AWS Step Functions. The [Input and Output Processing](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-input-output-filtering.html) section of the AWS Step Functions developer guide provides a comprehensive explanation, but for now we’ll just cover the bit of knowledge we need to get our state machine working.

The output of a state can be a copy of its input, or the result it produces (for example, output from a `Task` state’s Lambda function), or a combination of its input and result. We can use the `ResultPath` property inside our state machine task definitions to control which combination of these result configurations is passed to the state output (which then, in turn, becomes the input for the next state). 

The reason why our execution failed above is because the default behavior of a Task, if we don’t specify a `ResultPath` property, is to take the task’s output and use it as the input for the next state. In our case, since the previous state (Check Name) generated output of `{ "flagged": false }` this became the input to the next state (Check Address). Instead, what we want to do is preserve the original input, which contains our applicant’s info, merge Check Name’s result into that state, and pass the whole thing down to the Check Address.  Then, Check Address could do the same. What we want to do is get both data checking steps to execute correctly and merge their outputs together for some later step to inspect for further downstream routing logic.

So, to fix our current issue, we need to add a `ResultPath` statement, instructing the state machine to generate its output by taking the Lambda function’s output and merging it with the state’s input. It’s a simple change, really. We just need to add a tiny bit of additional configuration to our Task state definitions: `"ResultPath": "$.SomePropertyName"`. In Amazon States Language, the dollar sign syntax you see here means *the state’s input.* So what we’re saying here is, put the result of this task execution (in this case it’s the Lambda function’s output) into a new property of the object containing the input state, and use that as the state’s output.

### In this step, we will

* Add `ResultPath` properties to our Check Name and Check Address states inside our state machine defined in `state-machine/account-application-workflow.asl`

### Make these changes

Below is a new version of our serverless.yml file that contains updated Check Name and Check Address states, using the ResultPath property to merge their outputs into helpfully-named keys that we can be used later on.


➡️ Step 1. Replace `state-machine/account-application-workflow.asl` with ___CLIPBOARD_BUTTON code/variants/statemachine/1-first-version__account-application-workflow.asl.json&code/variants/statemachine/2-data-checking-result-paths__account-application-workflow.asl.json|

➡️ Step 2. Run:

```bash
sam build && sam deploy
```

### Try it out

With our new version deployed, each data checking step will now pass its whole input to its output as well as adding the data checking result to a new property in its output, too. Let’s retry another execution to see how things go.

➡️ Step 1. Back in the Step Functions web console, click ‘New Execution’

➡️ Step 2. Leave the input the same as before and click ‘Start execution’. This time, you should see the execution succeed.

➡️ Step 3. Click on the Check Address state in the visualization section and expand the Input and Output nodes on the right. 

Notice how the Check Name state kept our original input and appended its results inside of `$.checks.name` and how our Check Address took that output as its input and appended its own address check result inside of `$.checks.address`.  That’s the power of `ResultPath` at work!

![Workflow simplified all working](/images/simplified-workflow-vis-working.png)

At this point, we have a workflow that executes successfully, but it’s still missing some important logic. Our workflow goes directly from Check Address to Approve Application.  What we actually want is to automatically approve an application only if both the name and address come back without flags, and otherwise we want to queue the application up for review by a human.  

Eventually we will incorporate a step that will wait for a human response on flagged applications. But before that, we need to learn how to inspect the workflow’s state and execute some branching logic based on the checks we define.  To do this, we’ll need to add a new type of state to our state machine called the Choice state.