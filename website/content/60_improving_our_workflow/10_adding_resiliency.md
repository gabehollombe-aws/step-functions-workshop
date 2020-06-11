+++
title = "Improving resiliency by adding retries and error handling to our workflow"
chapter = false
weight = 10
+++

Until now, we haven’t taken the time to add any resiliency into our state machine. What happens if some of our Lambda function calls result in a timeout, or if they experience some other sort of transient error? What if they throw an exception? Or, imagine that one of our Lambda functions was calling a third-party service. That external call could fail or timeout as well. Let’s address these what-ifs now and leverage the built in retry and error handling capabilities of AWS Step Functions.

So, what kind of errors can occur? Here’s what the Step Functions developer guide has to say:


> Any state can encounter runtime errors. Errors can happen for various reasons:

> - State machine definition issues (for example, no matching rule in a `Choice` state) 

> - Task failures (for example, an exception in a Lambda function)

> - Transient issues (for example, network partition events)

> By default, when a state reports an error, AWS Step Functions causes the execution to fail entirely. 


For our example workflow, we’re probably OK with just allowing our workflow to fail when any unexpected errors occur. But some Lambda invocation errors are transient, so we should at least add some retry behavior to our Task states that invoke Lambda functions.

## Adding Retries

Task states (and others like Parallel states too, which we’ll get to later), have the capability to retry their work after they encounter an error. We just need to add a `Retry` parameter to our Task state definitions, telling them which types of errors they should retry for, and optionally specify additional configuration to control the rate of retries and the maximum number of retry attempts.

The developer guide identifies the [types of transient Lambda service errors](https://docs.aws.amazon.com/step-functions/latest/dg/bp-lambda-serviceexception.html) that should proactively handle with a retry as a best practice.   So let’s add `Retry` configurations to each of our Lambda invoking Task states to handle these transient errors.

### In this step, we will

* Add `Retry` configuration to all of the Task states in our state machine that invoke Lambda functions, providing automated retry resiliency for transient errors


### Make these changes

➡️ Step 1. Replace `statemachine/account-application-workflow.asl.json` with <span class="clipBtn clipboard" data-clipboard-target="#idcodevariantsstatemachine5addapprovereject__accountapplicationworkflowasljsoncodevariantsstatemachine6addretries__accountapplicationworkflowasljson">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-idcodevariantsstatemachine5addapprovereject__accountapplicationworkflowasljsoncodevariantsstatemachine6addretries__accountapplicationworkflowasljson"></div> <script type="text/template" data-diff-for="diff-idcodevariantsstatemachine5addapprovereject__accountapplicationworkflowasljsoncodevariantsstatemachine6addretries__accountapplicationworkflowasljson">diff --git a/code/variants/statemachine/5-add-approve-reject__account-application-workflow.asl.json b/code/variants/statemachine/6-add-retries__account-application-workflow.asl.json
index fe142b0..26bac8a 100644
--- a/code/variants/statemachine/5-add-approve-reject__account-application-workflow.asl.json
+++ b/code/variants/statemachine/6-add-retries__account-application-workflow.asl.json
@@ -11,6 +11,16 @@
             },
             "Resource": "${DataCheckingFunctionArn}",
             "ResultPath": "$.checks.name",
+            "Retry": [
+                {
+                    "ErrorEquals": [
+                        "Lambda.ServiceException",
+                        "Lambda.AWSLambdaException",
+                        "Lambda.SdkClientException",
+                        "Lambda.TooManyRequestsException"
+                    ]
+                }
+            ],
             "Next": "Check Address"
         },
         "Check Address": {
@@ -23,6 +33,16 @@
             },
             "Resource": "${DataCheckingFunctionArn}",
             "ResultPath": "$.checks.address",
+            "Retry": [
+                {
+                    "ErrorEquals": [
+                        "Lambda.ServiceException",
+                        "Lambda.AWSLambdaException",
+                        "Lambda.SdkClientException",
+                        "Lambda.TooManyRequestsException"
+                    ]
+                }
+            ],
             "Next": "Review Required?"
         },
         "Review Required?": {
@@ -53,6 +73,16 @@
                 }
             },
             "ResultPath": "$.review",
+            "Retry": [
+                {
+                    "ErrorEquals": [
+                        "Lambda.ServiceException",
+                        "Lambda.AWSLambdaException",
+                        "Lambda.SdkClientException",
+                        "Lambda.TooManyRequestsException"
+                    ]
+                }
+            ],
             "Next": "Review Approved?"
         },
         "Review Approved?": {
@@ -76,6 +106,16 @@
                 "id.$": "$.application.id"
             },
             "Resource": "${RejectApplicationFunctionArn}",
+            "Retry": [
+                {
+                    "ErrorEquals": [
+                        "Lambda.ServiceException",
+                        "Lambda.AWSLambdaException",
+                        "Lambda.SdkClientException",
+                        "Lambda.TooManyRequestsException"
+                    ]
+                }
+            ],
             "End": true
         },
         "Approve Application": {
@@ -84,6 +124,16 @@
                 "id.$": "$.application.id"
             },
             "Resource": "${ApproveApplicationFunctionArn}",
+            "Retry": [
+                {
+                    "ErrorEquals": [
+                        "Lambda.ServiceException",
+                        "Lambda.AWSLambdaException",
+                        "Lambda.SdkClientException",
+                        "Lambda.TooManyRequestsException"
+                    ]
+                }
+            ],
             "End": true
         }
     }
</script>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="idcodevariantsstatemachine5addapprovereject__accountapplicationworkflowasljsoncodevariantsstatemachine6addretries__accountapplicationworkflowasljson" style="position: relative; left: -1000px; width: 1px; height: 1px;">{
    "StartAt": "Check Name",
    "States": {
        "Check Name": {
            "Type": "Task",
            "Parameters": {
                "command": "CHECK_NAME",
                "data": {
                    "name.$": "$.application.name"
                }
            },
            "Resource": "${DataCheckingFunctionArn}",
            "ResultPath": "$.checks.name",
            "Retry": [
                {
                    "ErrorEquals": [
                        "Lambda.ServiceException",
                        "Lambda.AWSLambdaException",
                        "Lambda.SdkClientException",
                        "Lambda.TooManyRequestsException"
                    ]
                }
            ],
            "Next": "Check Address"
        },
        "Check Address": {
            "Type": "Task",
            "Parameters": {
                "command": "CHECK_ADDRESS",
                "data": {
                    "address.$": "$.application.address"
                }
            },
            "Resource": "${DataCheckingFunctionArn}",
            "ResultPath": "$.checks.address",
            "Retry": [
                {
                    "ErrorEquals": [
                        "Lambda.ServiceException",
                        "Lambda.AWSLambdaException",
                        "Lambda.SdkClientException",
                        "Lambda.TooManyRequestsException"
                    ]
                }
            ],
            "Next": "Review Required?"
        },
        "Review Required?": {
            "Type": "Choice",
            "Choices": [
                {
                    "Variable": "$.checks.name.flagged",
                    "BooleanEquals": true,
                    "Next": "Pending Review"
                },
                {
                    "Variable": "$.checks.address.flagged",
                    "BooleanEquals": true,
                    "Next": "Pending Review"
                }
            ],
            "Default": "Approve Application"
        },
        "Pending Review": {
            "Type": "Task",
            "Resource": "arn:aws:states:::lambda:invoke.waitForTaskToken",
            "Parameters": {
                "FunctionName": "${FlagApplicationFunctionName}",
                "Payload": {
                    "id.$": "$.application.id",
                    "flagType": "REVIEW",
                    "taskToken.$": "$$.Task.Token"
                }
            },
            "ResultPath": "$.review",
            "Retry": [
                {
                    "ErrorEquals": [
                        "Lambda.ServiceException",
                        "Lambda.AWSLambdaException",
                        "Lambda.SdkClientException",
                        "Lambda.TooManyRequestsException"
                    ]
                }
            ],
            "Next": "Review Approved?"
        },
        "Review Approved?": {
            "Type": "Choice",
            "Choices": [
                {
                    "Variable": "$.review.decision",
                    "StringEquals": "APPROVE",
                    "Next": "Approve Application"
                },
                {
                    "Variable": "$.review.decision",
                    "StringEquals": "REJECT",
                    "Next": "Reject Application"
                }
            ]
        },
        "Reject Application": {
            "Type": "Task",
            "Parameters": {
                "id.$": "$.application.id"
            },
            "Resource": "${RejectApplicationFunctionArn}",
            "Retry": [
                {
                    "ErrorEquals": [
                        "Lambda.ServiceException",
                        "Lambda.AWSLambdaException",
                        "Lambda.SdkClientException",
                        "Lambda.TooManyRequestsException"
                    ]
                }
            ],
            "End": true
        },
        "Approve Application": {
            "Type": "Task",
            "Parameters": {
                "id.$": "$.application.id"
            },
            "Resource": "${ApproveApplicationFunctionArn}",
            "Retry": [
                {
                    "ErrorEquals": [
                        "Lambda.ServiceException",
                        "Lambda.AWSLambdaException",
                        "Lambda.SdkClientException",
                        "Lambda.TooManyRequestsException"
                    ]
                }
            ],
            "End": true
        }
    }
}
</textarea>
{{< /safehtml >}}


➡️ Step 2. Run:

```bash
sam deploy
```


{{% notice tip %}}
We could have specified additional configuration for our `Retry` parameters, including `IntervalSeconds` (defaults to  1), `MaxAttempts` (defaults to  3), and `BackoffRate` (defaults to 2), but the defaults are fine for our case, so we’ll just go with the default values.
{{% /notice %}}

Now, we can’t actually test any of these errors easily, because all of the exceptions we’ve added retries for are transient in nature. But now you know how to add these types of retries yourself as a best practice. Moving on, let’s learn how to handle specific application-level errors, too.

## Catching Errors

In addition to handling transient problems with Retries, Step Functions also allows us to catch specific errors and respond by transitioning to appropriate states to handle these errors. For example, let’s pretend that there are some types of names that our Data Checking service can’t handle. In these cases, we don’t want to flag the application for review, but we want to flag the application in a way that signifies to the business that it is unprocessable to due to incompatible data. 

To show this in action, we’ll leverage some test code in our Data Checking Lambda that tells it to throw an error if it sees a specific test string come through in an applicant’s name. We’ll update our state machine to catch this specific type of custom error and redirect to a new state, Flag Application As Unprocessable, that will flag the application appropriately.

### In this step, we will

* Add a new Flag Application As Unprocessable state to our state machine which will update our account application appropriately

* Add a `Catch` configuration to our Check Name state in our state machine, causing a transition to the Flag Application As Unprocessable state

### Make these changes

➡️ Step 1. Replace `statemachine/account-application-workflow.asl.json` with <span class="clipBtn clipboard" data-clipboard-target="#idcodevariantsstatemachine6addretries__accountapplicationworkflowasljsoncodevariantsstatemachine7addcatch__accountapplicationworkflowasljson">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-idcodevariantsstatemachine6addretries__accountapplicationworkflowasljsoncodevariantsstatemachine7addcatch__accountapplicationworkflowasljson"></div> <script type="text/template" data-diff-for="diff-idcodevariantsstatemachine6addretries__accountapplicationworkflowasljsoncodevariantsstatemachine7addcatch__accountapplicationworkflowasljson">diff --git a/code/variants/statemachine/6-add-retries__account-application-workflow.asl.json b/code/variants/statemachine/7-add-catch__account-application-workflow.asl.json
index 26bac8a..5009d78 100644
--- a/code/variants/statemachine/6-add-retries__account-application-workflow.asl.json
+++ b/code/variants/statemachine/7-add-catch__account-application-workflow.asl.json
@@ -21,6 +21,15 @@
                     ]
                 }
             ],
+            "Catch": [
+                {
+                    "ErrorEquals": [
+                        "UnprocessableDataException"
+                    ],
+                    "ResultPath": "$.error-info",
+                    "Next": "Flag Application As Unprocessable"
+                }
+            ],
             "Next": "Check Address"
         },
         "Check Address": {
@@ -135,6 +144,30 @@
                 }
             ],
             "End": true
+        },
+        "Flag Application As Unprocessable": {
+            "Type": "Task",
+            "Resource": "arn:aws:states:::lambda:invoke",
+            "Parameters": {
+                "FunctionName": "${FlagApplicationFunctionName}",
+                "Payload": {
+                    "id.$": "$.application.id",
+                    "flagType": "UNPROCESSABLE_DATA",
+                    "errorInfo.$": "$.error-info"
+                }
+            },
+            "ResultPath": "$.review",
+            "Retry": [
+                {
+                    "ErrorEquals": [
+                        "Lambda.ServiceException",
+                        "Lambda.AWSLambdaException",
+                        "Lambda.SdkClientException",
+                        "Lambda.TooManyRequestsException"
+                    ]
+                }
+            ],
+            "End": true
         }
     }
 }
\ No newline at end of file
</script>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="idcodevariantsstatemachine6addretries__accountapplicationworkflowasljsoncodevariantsstatemachine7addcatch__accountapplicationworkflowasljson" style="position: relative; left: -1000px; width: 1px; height: 1px;">{
    "StartAt": "Check Name",
    "States": {
        "Check Name": {
            "Type": "Task",
            "Parameters": {
                "command": "CHECK_NAME",
                "data": {
                    "name.$": "$.application.name"
                }
            },
            "Resource": "${DataCheckingFunctionArn}",
            "ResultPath": "$.checks.name",
            "Retry": [
                {
                    "ErrorEquals": [
                        "Lambda.ServiceException",
                        "Lambda.AWSLambdaException",
                        "Lambda.SdkClientException",
                        "Lambda.TooManyRequestsException"
                    ]
                }
            ],
            "Catch": [
                {
                    "ErrorEquals": [
                        "UnprocessableDataException"
                    ],
                    "ResultPath": "$.error-info",
                    "Next": "Flag Application As Unprocessable"
                }
            ],
            "Next": "Check Address"
        },
        "Check Address": {
            "Type": "Task",
            "Parameters": {
                "command": "CHECK_ADDRESS",
                "data": {
                    "address.$": "$.application.address"
                }
            },
            "Resource": "${DataCheckingFunctionArn}",
            "ResultPath": "$.checks.address",
            "Retry": [
                {
                    "ErrorEquals": [
                        "Lambda.ServiceException",
                        "Lambda.AWSLambdaException",
                        "Lambda.SdkClientException",
                        "Lambda.TooManyRequestsException"
                    ]
                }
            ],
            "Next": "Review Required?"
        },
        "Review Required?": {
            "Type": "Choice",
            "Choices": [
                {
                    "Variable": "$.checks.name.flagged",
                    "BooleanEquals": true,
                    "Next": "Pending Review"
                },
                {
                    "Variable": "$.checks.address.flagged",
                    "BooleanEquals": true,
                    "Next": "Pending Review"
                }
            ],
            "Default": "Approve Application"
        },
        "Pending Review": {
            "Type": "Task",
            "Resource": "arn:aws:states:::lambda:invoke.waitForTaskToken",
            "Parameters": {
                "FunctionName": "${FlagApplicationFunctionName}",
                "Payload": {
                    "id.$": "$.application.id",
                    "flagType": "REVIEW",
                    "taskToken.$": "$$.Task.Token"
                }
            },
            "ResultPath": "$.review",
            "Retry": [
                {
                    "ErrorEquals": [
                        "Lambda.ServiceException",
                        "Lambda.AWSLambdaException",
                        "Lambda.SdkClientException",
                        "Lambda.TooManyRequestsException"
                    ]
                }
            ],
            "Next": "Review Approved?"
        },
        "Review Approved?": {
            "Type": "Choice",
            "Choices": [
                {
                    "Variable": "$.review.decision",
                    "StringEquals": "APPROVE",
                    "Next": "Approve Application"
                },
                {
                    "Variable": "$.review.decision",
                    "StringEquals": "REJECT",
                    "Next": "Reject Application"
                }
            ]
        },
        "Reject Application": {
            "Type": "Task",
            "Parameters": {
                "id.$": "$.application.id"
            },
            "Resource": "${RejectApplicationFunctionArn}",
            "Retry": [
                {
                    "ErrorEquals": [
                        "Lambda.ServiceException",
                        "Lambda.AWSLambdaException",
                        "Lambda.SdkClientException",
                        "Lambda.TooManyRequestsException"
                    ]
                }
            ],
            "End": true
        },
        "Approve Application": {
            "Type": "Task",
            "Parameters": {
                "id.$": "$.application.id"
            },
            "Resource": "${ApproveApplicationFunctionArn}",
            "Retry": [
                {
                    "ErrorEquals": [
                        "Lambda.ServiceException",
                        "Lambda.AWSLambdaException",
                        "Lambda.SdkClientException",
                        "Lambda.TooManyRequestsException"
                    ]
                }
            ],
            "End": true
        },
        "Flag Application As Unprocessable": {
            "Type": "Task",
            "Resource": "arn:aws:states:::lambda:invoke",
            "Parameters": {
                "FunctionName": "${FlagApplicationFunctionName}",
                "Payload": {
                    "id.$": "$.application.id",
                    "flagType": "UNPROCESSABLE_DATA",
                    "errorInfo.$": "$.error-info"
                }
            },
            "ResultPath": "$.review",
            "Retry": [
                {
                    "ErrorEquals": [
                        "Lambda.ServiceException",
                        "Lambda.AWSLambdaException",
                        "Lambda.SdkClientException",
                        "Lambda.TooManyRequestsException"
                    ]
                }
            ],
            "End": true
        }
    }
}
</textarea>
{{< /safehtml >}}

➡️ Step 2. Run:

```bash
sam deploy
```

### Try it out

Let’s test out our new error handling capabilities:

➡️ Step 1. Try submitting a new application that contains our simulated unprocessable data for the applicant’s name field. Run:

```bash
aws lambda invoke --function-name sfn-workshop-SubmitApplication --payload '{ "name": "UNPROCESSABLE_DATA", "address": "123 Street" }' /dev/stdout 
```

➡️ Step 2. Refresh the state machine in the AWS web console, find the most recent execution, and click into it to view its execution details.

Notice that our state machine now shows that it encountered, and handled, an error by transitioning to our new Flag Application As Unprocessable state.

➡️ Step 3. If you like, you can see that our application record was flagged correctly by running this command:

```bash
aws lambda invoke --function-name sfn-workshop-FindApplications --payload '{ "state": "FLAGGED_WITH_UNPROCESSABLE_DATA" }' /dev/stdout 
```

![Catching errors](/images/workflow-vis-error-catch.png)

Finally, before we wrap up, there’s one more improvement we can make to our workflow.