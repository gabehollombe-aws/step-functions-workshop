+++
title = "Preparing to create our example services"
chapter = false
weight = 10
+++

Now that we have an idea of the workflow we’d like, we need to stand up some services that will handle the various steps in our workflow.  Once we have some services deployed, we can orchestrate them together to implement this workflow. Let’s get to it!

For the purposes of this workshop, rather than deploying full web services, we’ll just deploy each of our services into their own AWS Lambda functions and invoke these functions directly. This way we keep our deployments simple with less moving parts so we can focus our attention on how to orchestrate these services, rather than on providing an external interface (like a set of HTTP REST endpoints) to authenticate and front these services.

In this workshop, we'll use the <a href="https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html">AWS Serverless Application Model (SAM) framework</a> to help us write, deploy, and test the functionality in our services. You don't need to have had any prior experience with AWS SAM; we'll explain as we go, so you can also learn how the framework helps you build serverless systems.