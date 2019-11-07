+++
title = "Preparing to create our example services"
chapter = false
weight = 10
+++

Now that we have an idea of the workflow we’d like, we need to stand up some services that will handle the various steps in our workflow.  Once we have some services deployed, we can orchestrate them together to implement this workflow. Let’s get to it!

For the purposes of this workshop, rather than deploying full web services, we’ll just deploy each of our services into their own AWS Lambda functions and invoke these functions directly. This way we keep our deployments simple with less moving parts so we can focus our attention on how to orchestrate these services, rather than on providing an external interface (like a set of HTTP REST endpoints) to authenticate and front these services.

In this project, we’ll use the <a href="https://serverless.com/">Serverless Framework</a> to help us write, deploy, and test the functionality in our services. 

{{% notice tip %}}
You absolutely do not need to use the Serverless Framework to work with AWS Lambda or AWS Step Functions, but it has some nice developer ergonomics that makes it useful for us. Since this workshop doesn't include any sort of GUI to work with the API we'll be deploying, we're just going to invoke deployed AWS Lambda functions directly by name, which the Serverless Framework makes really easy.  
<br/>
Also, if you're used to AWS CloudFormation for managing your infrastructure as code, you'll feel right at home with the way the Serverless Framework defines resources. In fact, you can (and we will) embed CloudFormation resources into the `serverless.yml` file that the framework uses for deployments.
{{% /notice %}}
