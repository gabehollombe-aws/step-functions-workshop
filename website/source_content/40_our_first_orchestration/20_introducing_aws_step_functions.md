+++
title = "Introducing AWS Step Functions"
chapter = false
weight = 20
+++

AWS Step Functions lets you coordinate services via fully-managed serverless workflows so you can build and update apps quickly. Workflows are made up of a series of steps, with the output of one step acting as input into the next. Application development is simpler and more intuitive using Step Functions because it translates your workflow into a state machine diagram that is easy to understand, easy to explain to others, and easy to change. You can monitor each of the steps of a workflow’s execution as they occur (and after as well), which helps you quickly identify problems and fix them. Step Functions automatically triggers and tracks each step, and can retry steps when there are errors, so your application workflow executes reliably, and in the order you expect.

There’s a lot to explore in the description above, and by the end of this workshop you’ll see all of the benefits just mentioned first-hand. But the best way to understand a new service is to use it, so we’ll dive right in to Step Functions by starting with the basic concepts and steps we need to connect our services together.

Step Functions works by representing our workflow as a state machine.  If you’re not familiar with the concept of a state machine, it will likely feel familiar pretty quickly, because it’s just a formalization of things you probably already have a very strong intuitive understanding of from writing any basic programming code. 

A state machine is just a way to describe a collection of workflow steps that are split into named states. Each state machine has one starting state and always only one active state (during its execution).  The active state has some input, and often takes some action using that input, which generates some new output. State machines transition from one state to the next based on their state and the explicit connections we allow between states.

Let’s get hands-on so you can see this in action.  We’ll start by writing our first Step Functions state machine to model a simplified version of our desired workflow. With AWS Step functions, there are several different types of states (or steps) that we can use to create our workflow’s state machine, and the simplest one is the Pass State. The Pass State simply passes its input to its output, performing no work. Pass States are useful when constructing and debugging state machines, so we’ll use them here to begin to sketch out our workflow.

### Make these changes

To start out, let’s just try to model the steps involved to check a name, check an address, and then approve an application. Our simple workflow will start out like this:

![Simplified workflow](/images/simplified-workflow-sm.png)

➡️ Step 1. Open the [AWS Step Functions web console](https://console.aws.amazon.com/states/home?region=us-east-1)

➡️ Step 2. If the left sidebar is collapsed, expand it

➡️ Step 3. Make sure you’re in the State machines section and click the ‘Create state machine’  button on the right.

➡️ Step 4. Scroll down to the 'Definition' section and replace the example state machine definition with the following JSON instead:

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

➡️ Step 5. Click the refresh icon and you should see a diagram matching the one above. This is really helpful for making sure we’re connecting our states together in the right way.

➡️ Step 6. Click ‘Next’ to continue

➡️ Step 7. In the Name section, enter ‘Process_New_Account_Applications’

➡️ Step 8. In the Permissions section, we need to specify an IAM role for the Step Function to assume when it executes. For now we can just start with the default role. Ensure the ‘Create new role’ option is selected.

➡️ Step 9. Leave the rest of the defaults as they are, scroll down, and click on Click ‘Create state machine’.


{{% notice info %}}
In AWS Step Functions, we define our state machines using a JSON-based structured language called Amazon States Language.  You can read more about the full language specification and all of the supported state types at https://states-language.net/spec.html
{{% /notice %}}

At this point, although we’ve created a valid step function, it doesn’t really *do* anything because the Pass state we’re using in our definition just passes input straight through to its output without performing any work. Our state machine just transitions through three Pass states and ends. Nevertheless, let’s quickly try out a simple execution so we can see this for ourselves.

### Try it out

➡️ Step 1. Click ‘Start execution’

➡️ Step 2. Every time we ask Step Functions to execute a state machine, we can provide some initial input if we want. Let’s just leave the initial example input as-is and click ‘Start execution’

➡️ Step 3. You’ll now see the details page for the execution we just triggered. Click on any of the step names in the visualization and notice how we can see the input and output values for each state in the execution.
    
![Workflow simplified all pass states](/images/simplified-workflow-vis-all-pass.png)



Now that you understand how to define and execute a state machine, let’s update our state machine definition to actually perform some work by calling out to the Data Checking service to check the name and the address. For our new definition, we’ll use the Task state to perform some work. 
