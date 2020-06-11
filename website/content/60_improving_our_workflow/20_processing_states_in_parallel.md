+++
title = "Processing independant states in parallel"
chapter = false
weight = 20
+++

Up until now we have performed both of our data checking steps in a serial fashion, one after the other. But checking an applicant’s address doesn’t depend on the result from checking the applicant’s name. So, this is a great opportunity to speed things up and perform our two data check steps in parallel instead. 

Step Functions has a `Parallel` state type which, unsurprisingly, lets a state machine perform parallel executions of multiple states. A `Parallel` state causes the interpreter to execute each branch starting with the state named in its `StartAt` field, as concurrently as possible, and wait until each branch terminates (reaches a terminal state) before processing the Parallel state's `Next` field. 

### In this step, we will

* Update our state machine to run the Check Name and Check Address states in parallel using the `Parallel` state type

* Update our state machine's 'Review Required?' `Choice` state to handle the results from the parallel data checks. We need to do this because the Parallel state returns each check as an element in an array in the same order the steps are specified in the `Parallel` state definition.


### Make these changes

Let's refactor our state machine to  perform the name and address checks in parallel:

➡️ Step 1. Replace `statemachine/account-application-workflow.asl.json` with <span class="clipBtn clipboard" data-clipboard-target="#idcodevariantsstatemachine7addcatch__accountapplicationworkflowasljsoncodevariantsstatemachine8parallelsteps__accountapplicationworkflowasljson">this content</span> (click the gray button to copy to clipboard). 
{{< expand "Click to view diff" >}} {{< safehtml >}}
<div id="diff-idcodevariantsstatemachine7addcatch__accountapplicationworkflowasljsoncodevariantsstatemachine8parallelsteps__accountapplicationworkflowasljson"></div> <script type="text/template" data-diff-for="diff-idcodevariantsstatemachine7addcatch__accountapplicationworkflowasljsoncodevariantsstatemachine8parallelsteps__accountapplicationworkflowasljson">diff --git a/code/variants/statemachine/7-add-catch__account-application-workflow.asl.json b/code/variants/statemachine/8-parallel-steps__account-application-workflow.asl.json
index 5009d78..e1c0957 100644
--- a/code/variants/statemachine/7-add-catch__account-application-workflow.asl.json
+++ b/code/variants/statemachine/8-parallel-steps__account-application-workflow.asl.json
@@ -1,24 +1,60 @@
 {
-    "StartAt": "Check Name",
+    "StartAt": "Check Applicant Data",
     "States": {
-        "Check Name": {
-            "Type": "Task",
-            "Parameters": {
-                "command": "CHECK_NAME",
-                "data": {
-                    "name.$": "$.application.name"
-                }
-            },
-            "Resource": "${DataCheckingFunctionArn}",
-            "ResultPath": "$.checks.name",
-            "Retry": [
+        "Check Applicant Data": {
+            "Type": "Parallel",
+            "Branches": [
                 {
-                    "ErrorEquals": [
-                        "Lambda.ServiceException",
-                        "Lambda.AWSLambdaException",
-                        "Lambda.SdkClientException",
-                        "Lambda.TooManyRequestsException"
-                    ]
+                    "StartAt": "Check Name",
+                    "States": {
+                        "Check Name": {
+                            "Type": "Task",
+                            "Parameters": {
+                                "command": "CHECK_NAME",
+                                "data": {
+                                    "name.$": "$.application.name"
+                                }
+                            },
+                            "Resource": "${DataCheckingFunctionArn}",
+                            "Retry": [
+                                {
+                                    "ErrorEquals": [
+                                        "Lambda.ServiceException",
+                                        "Lambda.AWSLambdaException",
+                                        "Lambda.SdkClientException",
+                                        "Lambda.TooManyRequestsException"
+                                    ]
+                                }
+                            ],
+                            "End": true
+                        }
+                    }
+                },
+                {
+                    "StartAt": "Check Address",
+                    "States": {
+                        "Check Address": {
+                            "Type": "Task",
+                            "Parameters": {
+                                "command": "CHECK_ADDRESS",
+                                "data": {
+                                    "address.$": "$.application.address"
+                                }
+                            },
+                            "Resource": "${DataCheckingFunctionArn}",
+                            "Retry": [
+                                {
+                                    "ErrorEquals": [
+                                        "Lambda.ServiceException",
+                                        "Lambda.AWSLambdaException",
+                                        "Lambda.SdkClientException",
+                                        "Lambda.TooManyRequestsException"
+                                    ]
+                                }
+                            ],
+                            "End": true
+                        }
+                    }
                 }
             ],
             "Catch": [
@@ -30,40 +66,19 @@
                     "Next": "Flag Application As Unprocessable"
                 }
             ],
-            "Next": "Check Address"
-        },
-        "Check Address": {
-            "Type": "Task",
-            "Parameters": {
-                "command": "CHECK_ADDRESS",
-                "data": {
-                    "address.$": "$.application.address"
-                }
-            },
-            "Resource": "${DataCheckingFunctionArn}",
-            "ResultPath": "$.checks.address",
-            "Retry": [
-                {
-                    "ErrorEquals": [
-                        "Lambda.ServiceException",
-                        "Lambda.AWSLambdaException",
-                        "Lambda.SdkClientException",
-                        "Lambda.TooManyRequestsException"
-                    ]
-                }
-            ],
+            "ResultPath": "$.checks",
             "Next": "Review Required?"
         },
         "Review Required?": {
             "Type": "Choice",
             "Choices": [
                 {
-                    "Variable": "$.checks.name.flagged",
+                    "Variable": "$.checks[0].flagged",
                     "BooleanEquals": true,
                     "Next": "Pending Review"
                 },
                 {
-                    "Variable": "$.checks.address.flagged",
+                    "Variable": "$.checks[1].flagged",
                     "BooleanEquals": true,
                     "Next": "Pending Review"
                 }
</script>
{{< /safehtml >}} {{< /expand >}}
{{< safehtml >}}
<textarea id="idcodevariantsstatemachine7addcatch__accountapplicationworkflowasljsoncodevariantsstatemachine8parallelsteps__accountapplicationworkflowasljson" style="position: relative; left: -1000px; width: 1px; height: 1px;">{
    "StartAt": "Check Applicant Data",
    "States": {
        "Check Applicant Data": {
            "Type": "Parallel",
            "Branches": [
                {
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
                },
                {
                    "StartAt": "Check Address",
                    "States": {
                        "Check Address": {
                            "Type": "Task",
                            "Parameters": {
                                "command": "CHECK_ADDRESS",
                                "data": {
                                    "address.$": "$.application.address"
                                }
                            },
                            "Resource": "${DataCheckingFunctionArn}",
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
            "ResultPath": "$.checks",
            "Next": "Review Required?"
        },
        "Review Required?": {
            "Type": "Choice",
            "Choices": [
                {
                    "Variable": "$.checks[0].flagged",
                    "BooleanEquals": true,
                    "Next": "Pending Review"
                },
                {
                    "Variable": "$.checks[1].flagged",
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

Now you can try a few types of application submissions to see how they each execute:

➡️ Step 1. Submit a valid application and see it auto approve after checking the data fields in parallel. Run:

```bash
aws lambda invoke --function-name sfn-workshop-SubmitApplication --payload '{ "name": "Spock", "address": "123 Enterprise Street" }' /dev/stdout 
```

Here is what a valid application execution flow looks like:

![Parallel check auto approving](/images/workflow-vis-parallel-approved.png)

➡️ Step 2. Submit an application with an invalid name or address (or both) and see the parallel checks result in the workflow routing to wait for a review. Run:

```bash
aws lambda invoke --function-name sfn-workshop-SubmitApplication --payload '{ "name": "Spock", "address": "ABadAddress" }' /dev/stdout 
```

Here is what an invalid application execution flow looks like:

![Parallel check pending](/images/workflow-vis-parallel-pending.png)

➡️ Step 3. Submit an application with our test unprocessable name to see the parallel data checking state throw the error and route to the state to flag an application as unprocessable. Run: 

```bash
aws lambda invoke --function-name sfn-workshop-SubmitApplication --payload '{ "name": "UNPROCESSABLE_DATA", "address": "123 Street" }' /dev/stdout 
```

Here is what an unprocessable application execution flow looks like:

![Parallel check unprocessable](/images/workflow-vis-parallel-unprocessable.png)

At this point, we have a well structured state machine to manage the workflow of processing new account applications for our simple banking system. If we wanted to, we could add on another step in our workflow to handle further downstream logic involved with opening up a bank account for applications that get approved. But, this is a good place to wrap up because you already have all the experience needed to continue implementing these further steps on your own, if you wish.