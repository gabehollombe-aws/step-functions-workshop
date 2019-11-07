+++
title = "Further Learning"
chapter = false
weight = 10
+++

## Further Learning

{{% notice tip %}}
Did you know that Step Functions can do more than just orchestrate Lambda functions together?<br/><br/>See the points below for some other exciting capabilities that we didn't cover in this workshop.
{{% /notice %}}

**[Activities](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-activities.html)** are an AWS Step Functions feature that **enables you to have a task in your state machine where the work is performed by a worker that can be hosted anywhere**, including Amazon Elastic Compute Cloud (Amazon EC2), Amazon Elastic Container Service (Amazon ECS), mobile devices, or anywhere that you can have a process poll the AWS Step Functions API over HTTPS.

**The [Map](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-map-state.html) state can be used to run a set of steps for each element of an input array.** While the Parallel state executes multiple branches of steps using the same input, a Map state will execute the same steps for multiple entries of an array in the state input.

**The [Wait](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-wait-state.html) state delays the state machine from continuing for a specified time.** You can choose either a relative time, specified in seconds from when the state begins, or an absolute end time, specified as a timestamp. 

**Step Functions can integrate directly with _many_ other AWS Services** including AWS Batch, Amazon DynamoDB, Amazon ECS and Fargate, Amazon SQS and SNS, AWS Glue, Amazon Sagemaker, and more! Check out the [full list of AWS service integrations](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-service-integrations.html) for more info.

### Next Steps

If you'd like to continue your Step Functions learning journey, the best next step is to read through the [Developer Guide](https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html).  After that, check out some [sample projects](https://docs.aws.amazon.com/step-functions/latest/dg/create-sample-projects.html). Finally, you can browse relevant webinars, blog posts, reference architectures, videos, and more at the [AWS Step Functions Resources](https://aws.amazon.com/step-functions/resources/) page.
