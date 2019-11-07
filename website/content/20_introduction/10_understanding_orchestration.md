+++
title = "Understanding service orchestration"
chapter = false
weight = 10
+++

We use the term *orchestration* to describe the act of coordinating distributed services via a centralized workflow manager process, similar to how a conductor understands each part of an orchestra and directs each instrument section to act together to create a specific performance result. 

Orchestration’s main benefit for service coordination is that it places all of the logic required to usher data between services to achieve a specific workflow in one central place, rather than encoding that logic across many services that need to know how to work with each other. This means that if anything about processing a workflow needs to change, there’s only one place to update: the process that’s managing the orchestration. It also means it’s easier to understand how various services are used together in concert, since you only need to look in one place to understand the entire flow from start to finish.

This approach works best when there is a higher level of coordination needed between services, often involving the need for robust retries, specific error handling, and optimized processing logic like conducting some steps in parallel or waiting for some steps to complete before continuing to execute a particular process. 
