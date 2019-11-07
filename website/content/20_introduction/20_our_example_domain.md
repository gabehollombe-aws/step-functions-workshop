+++
title = "Our example business domain"
chapter = false
weight = 20
+++

It’s much easier to explore concepts around distributed service coordination when we have concrete systems to talk about. For this workshop, we’ll discuss a set of services (in our case they’ll all be implemented with simple AWS Lambda functions) that comprise a very small slice of a very simplified banking system. The workshop will focus on implementing the workflow to handle processing new bank account applications by checking particulars of an applicant’s information and handling cases that require human review. 

Our demo system is comprised of a few services with the following responsibilities:

* **Account Applications service** - handles the processing of new bank account applications from submission. Requires answers from the Data Checking service to provide validation checks against the applicant’s name and address. 
* **Data Checking service** - validates data related to names and addresses
* **Accounts service** - could be responsible for opening and operating bank accounts. We won’t actually implement this service in this workshop (because we’ll focus on the orchestration between the Account Applications and Data Checking services) but it’s useful to think about it as a placeholder that we might want to interact with in cases when our application workflow ends with an approval result.

In the picture below, we can see how an orchestration-based approach for our bank account application processing workflow could work.

![Workflow collaboration](/images/orchestration-collaboration.png)

So this is exactly the design we’ll implement now in this workshop.  We’ll use orchestration to manage our bank account processing workflow — the Account Applications service will accept incoming applications and process each application (by collaborating with the Data Checking service and waiting for humans to review flagged applications). Once an application has moved all the way through the workflow and if a decision is made to approve the application, the workflow could end by notifying an Accounts service to open an account for a user.

OK! We’ve covered enough background. It’s time to get hands-on and learn by building.
