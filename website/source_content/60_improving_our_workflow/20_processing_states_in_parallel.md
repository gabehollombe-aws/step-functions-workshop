+++
title = "Processing independant states in parallel"
chapter = false
weight = 20
+++

Up until now we have performed both of our data checking steps in a serial fashion, one after the other. But checking an applicant’s address doesn’t depend on the result from checking the applicant’s name. So, this is a great opportunity to speed things up and perform our two data check steps in parallel instead. 

Step Functions has a `Parallel` state type which, unsurprisingly, lets a state machine perform parallel executions of multiple states. A `Parallel` state causes the interpreter to execute each branch starting with the state named in its `StartAt` field, as concurrently as possible, and wait until each branch terminates (reaches a terminal state) before processing the Parallel state's `Next` field. 

### In this step, we will

* Update our state machine to run the Check Name and Check Address states in parallel using the `Parallel` state type

* Update our state machine's 'Review Required?' `Choice` state to handle the results from the parallel data checks. We need to do this because the Parallel state returns each check as an element in an array in the same order the steps are specified in the `Parallel` state definition.


### Make these changes

Let's refactor our state machine to  perform the name and address checks in parallel:

➡️ Step 1. Replace `serverless.yml` with ___CLIPBOARD_BUTTON 8f6d5e019d11e6805e4124fb30cdd6a03b41a681:serverless.yml|

➡️ Step 2. Run:

```bash
sls deploy
```

### Try it out

Now you can try a few types of application submissions to see how they each execute:

➡️ Step 1. Submit a valid application and see it auto approve after checking the data fields in parallel. Run:

```bash
sls invoke -f SubmitApplication --data='{ "name": "Spock", "address": "123 Enterprise Street" }'
```

Here is what a valid application execution flow looks like:

![Parallel check auto approving](/images/workflow-vis-parallel-approved.png)

➡️ Step 2. Submit an application with an invalid name or address (or both) and see the parallel checks result in the workflow routing to wait for a review. Run:

```bash
sls invoke -f SubmitApplication --data='{ "name": "Gabe", "address": "ABadAddress" }'
```

Here is what an invalid application execution flow looks like:

![Parallel check pending](/images/workflow-vis-parallel-pending.png)

➡️ Step 3. Submit an application with our test unprocessable name to see the parallel data checking state throw the error and route to the state to flag an application as unprocessable. Run: 

```bash
sls invoke -f SubmitApplication --data='{ "name": "UNPROCESSABLE_DATA", "address": "123 Street" }'
```

Here is what an unprocessable application execution flow looks like:

![Parallel check unprocessable](/images/workflow-vis-parallel-unprocessable.png)

At this point, we have a well structured state machine to manage the workflow of processing new account applications for our simple banking system. If we wanted to, we could add on another step in our workflow to handle further downstream logic involved with opening up a bank account for applications that get approved. But, this is a good place to wrap up because you already have all the experience needed to continue implementing these further steps on your own, if you wish.