---
title: "Home"
chapter: false
weight: 1
---

# Intro to<br/>service coordination<br/>using AWS Step Functions

## Welcome

In this hands-on workshop, you’ll learn how to coordinate business workflows among distributed services using a simple, yet powerful, fully managed service called AWS Step Functions. We will deploy a pair of services as simple AWS Lambda functions and orchestrate them together into an example business workflow involving parallel executions, branching logic, and pause/resume on human interaction steps. 

## Estimated run time

This workshop takes about 2 to 3 hours to complete.

## Learning goals

This workshop is designed to teach you the following:

- The advantages of implementing service orchestrations using a fully managed service

- The basics of authoring AWS Step Function state machines, including:
  - Performing work with AWS Lambda functions using the `Task` state

  - Encoding branching logic using the `Choice` state

  - Executing work in parallel using the `Parallel` state

  - Pausing and resuming execution based on a token & callback pattern using the `waitForTaskToken` service integration pattern

- Visualizing, debugging, and auditing workflow executions using the AWS Step Functions web console