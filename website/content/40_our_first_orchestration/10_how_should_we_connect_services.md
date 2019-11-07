+++
title = "How should we connect our services together?"
chapter = false
weight = 10
+++

Given our earlier exploration of the orchestration patterns, this case feels like a very strong candidate for orchestration. We have the beginnings of a workflow here, with logic dictating what state an application should end up in after checking an applicant’s name and address. So, the next question is *how should we implement this orchestration?*

At first glance, the most straightforward solution that may occur to you is to simply add more logic to our Account Applications service. When an application is submitted, we could make two cross-service calls out to the Data Checking service to check the name and address. Then, once we have the responses for both, we can flag the application for review if either data check came back with a flag, otherwise we can approve the application automatically. Certainly this approach will work, but there are some drawbacks that may not be immediately obvious.

For one, we’ll need to elegantly handle timeout and error conditions. What happens if we don’t get a timely response from our cross-service call, or if we get a transient error and we want to retry the request?  If we’re gluing these services together directly in code, we’ll need to add some backoff/retry logic. In and of itself, this isn’t a big deal, but it ties up our main processing thread while its sleeping and waiting to retry those requests. 

Another missed benefit here is that if we simply encoded this logic into application code, it’s not easy to generate a visual representation of this workflow design or its execution history. There is tremendous business value in being able to visualize the shape of business workflows, since it helps non-technical users understand and validate the business logic we’re encoding into our system. Furthermore, this workflow is starting out very simply, but as our workflows evolve, it often become increasingly difficult to audit the entirely of our workflow executions and to debug issues that arise from unexpected inputs into our system.

Fortunately, AWS has a simple but extremely powerful tool to help us orchestrate our workflows in a way that addresses all of these concerns: AWS Step Functions.
