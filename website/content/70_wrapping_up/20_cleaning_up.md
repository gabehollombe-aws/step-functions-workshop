+++
title = "Cleaning Up"
chapter = false
weight = 20
+++

## Cleaning up

If you want to clean up the resources you've deployed in this workshop, just follow the steps below.

{{% notice warning %}}
Please note, if you've followed the steps in this workshop exactly as-shown, then you'll still have one state machine execution in-progress, because in our final tests after implementing parallel data checks we triggered an execution causing the state machine to pause and wait for a human review.
<br/><br/>
AWS CloudFormation will not delete a Step Functions state machine while there are still executions in progress. So, before you run the cleanup command shown below, head over to the web console and stop any state machine executions that are still running.
{{% /notice %}}

### Removing the resources we provisioned

1. We can use the AWS CLI to delete the CloudFormation stack that AWS SAM created for our application. From the Cloud9 terminal, run: 
   
```bash
REGION=$(grep region samconfig.toml | awk -F\= '{gsub(/"/, "", $2); gsub(/ /, "", $2); print $2}')
STACK_NAME=$(grep stack_name samconfig.toml | awk -F\= '{gsub(/"/, "", $2); gsub(/ /, "", $2); print $2}')
aws cloudformation delete-stack --region $REGION --stack-name $STACK_NAME
```


### Deleting the Cloud9 workspace

1. Go to your [Cloud9 Environment](https://us-east-1.console.aws.amazon.com/cloud9/home?region=us-east-1)

2. Select the environment named **workshop** and pick **Delete**

3. **Type the phrase** 'Delete' into the confirmation box and click **Delete**