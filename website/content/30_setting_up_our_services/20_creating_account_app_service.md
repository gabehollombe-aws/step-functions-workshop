+++
title = "Creating the Account Applications service"
chapter = false
weight = 20
+++


To start, we’ll create several functions that, when taken collectively, could be considered to be our Account Applications service. Namely, we’ll make functions allowing us to submit new applications (consisting of just a record with a name and an address), flag applications for review, and mark applications as approved or rejected. We’ll also add a capability to list all applications in a certain state (like SUBMITTED or FLAGGED) to save ourselves the trouble of inspecting the service’s data store directly.

### In this step, we will:

- Install the Serverless CLI tool, initialize a new project, and install a few dependencies from NPM

- Instead of creating a bunch of files by hand, we'll download a first version of our Account Applications service, comprised of several AWS Lambda functions. We'll use Node.js as the language for all of the Lambda functions in this workshop, but if you're not comfortable with Node.JS or JavaScript, don't worry; the code is really simple and you should be able to follow along without any issues.

- Set up a v1 of the `serverless.yml` file, which is how we tell the Serverless Framework about all of the cloud resources that our system will use, including the AWS Lambda functions that implement each action in our API, an Amazon DynamoDB table to store the state of each application, and the necessary AWS IAM roles and permissions to ensure our Lambda functions can operate successfully and securely.


### Make these changes

➡️ Step 1. In your Cloud9 workspace's terminal command line, run these commands to handle all of the housekeeping of getting our first version of the Account Applications service deployed:

```bash
# Install the Serverless Framework CLI
npm install -g serverless

# Make a directory for all our source code for this workshop
mkdir workshop-dir
cd workshop-dir

# Initialize a new Serverless Framework project in this directory
serverless create --template aws-nodejs

# Remove some boilerplate files
rm handler.js
rm serverless.yml

# Create a directory for all the Account Applications service Lambda functions
mkdir account-applications
pushd account-applications

# Bootstrap our initial service with a few files we'll extract from a zip archive
git clone https://github.com/gabehollombe-aws/step-functions-workshop.git
pushd step-functions-workshop
git checkout c186b8f24783bcaf4914c329bc456831ea0fd0f3
mv account-applications/* ..
mv serverless.yml ../..
popd
rm -rf step-functions-workshop

# Back to workshop-dir
popd

# Install dependencies
npm init --yes
npm install --save serverless-cf-vars uuid
    
```

➡️ Step 2. Use the Serverless Framework command to deploy our Lambda functions and Dynamo DB table. 

From the terminal, run:

```bash
sls deploy
```

{{% notice warning %}}
By default, the Serverless Framework will deploy resources into the `us-east-1` region. When using the AWS Web Console during this workshop, please ensure you're in the `N. Virginia` (us-east-1) region.<br/><br/>If you want to override this default region setting, you can do so by specifying a region argument to the `sls deploy` command. See [the Serverless Framework CLI deploy command documentation](https://serverless.com/framework/docs/providers/aws/cli-reference/deploy/) for more details.
{{% /notice %}}

{{% notice note %}}
Take a few moments to look at some of the files we just created in `workshop-dir` to understand what we deployed.
<br/><br/>
Here are some important files worth looking at:
<br/><br/>
`account-applications/submit.js`<br/>This implements our SubmitApplication Lambda function. There are similar files for `find`, `flag`, `reject`, and `approve` as well.<br/><br/>
`account-applications/AccountApplications.js`<br/>This is a common file that provides CRUD style operations for our Account Application data type. It's used by the various `account-applications/*.js` Lambda functions.<br/><br/>
`serverless.yml`<br/>This is the file that the Serverless Framework looks at to determine what we want resources we want to cloud create and deploy as part of our solution. If you're familiar with AWS CloudFormation, the structure of this file will look pretty familiar to you. Notice we are defining separate roles for each Lambda function, and each role is built up of custom shared policies we define in the file as well.
{{% /notice %}}


Now we have a fully-deployed Lambda function that can handle all of the steps involved to move an application from SUBMITTED, to FLAGGED, to APPROVED or REJECTED. 

Let’s take a moment to manually interact with each of these functions to understand the surface area of our first version of the Account Application Service API.