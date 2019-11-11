+++
title = "Finishing the workflow"
chapter = false
weight = 30
+++

## Approving and rejecting account applications

Until now, we’ve left the Approve Application state empty, using the Pass state as a kind of placeholder reminding us to implement the step later. And we just added another placeholder state for Reject Application, too.  Let’s finish our workflow by replacing these Pass states with Task states that invoke appropriate Lambda functions.


### In this step, we will

* Update our state machine, changing the Approve Application and Reject Application states from placeholder Pass state types to Task types that invoke the appropriate Lambda functions in the Data Checking service

* Grant additional permissions to the IAM role that the step function executes under, so that it can invoke the necessary Lambda functions from the Account Applications service


### Make these changes

➡️ Step 1. Replace `serverless.yml` with ___CLIPBOARD_BUTTON 77603cdb8730955713c45470065e8c1b619fff93:serverless.yml|

➡️ Step 2. Run:

```bash
sls deploy
```



With that deploy done, the first fully-working version of our example workflow is complete!  We could take the time now to try another full run through of our workflow and seeing if our application records end up with APPROVED or REJECTED states, but let's hold off on this for now since it's not *that* interesting and we still have room for a bit of improvement in our solution. Specifically, how should we handle errors when things go wrong?
