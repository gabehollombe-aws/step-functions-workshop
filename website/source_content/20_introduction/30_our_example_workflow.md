+++
title = "Our example workflow"
chapter = false
weight = 30
+++

## Processing new bank account applications

Whenever a new bank account application comes in to our example system, we want to check some of the applicant's information and then either automatically approve the application if there were no issues with the data, or flag it for human review if any of our data checks come back with a flag. A human reviewer will periodically check for flagged applications and decide to approve or reject each flagged application. In principle, once we have an approval decision made for an account application, we could include a step to collaborate with an Accounts service to automatically open an account, but for simplicity’s sake, we’re just going to focus on making a decision for an application, since there is enough material to focus on here to illustrate many important orchestration concepts.

To sum up, here is the workflow that we want to manage:

- Check an applicant’s name and address against a service to detect if they’re suspicious or otherwise warrant review by a human before processing the account application.

- If the name and address checks come back without any issues, then automatically approve the application. If we encounter an error trying to check the name or the address, flag the application as unprocessable and stop. Otherwise, if the name or address checks reveal a concern about the data, continue to the next step.

- Flag the application for review by a human and pause further processing.

- Wait for a human to review the flagged application and make an approve or reject decision for the application.

- Approve or reject the application, as per the reviewer’s decision.

Here is a diagram to illustrate our this same workflow with boxes and arrows instead of words:
![Workflow collaboration](/images/full-desired-workflow.png)