+++
title = "Creating the example services"
chapter = false
weight = 20
+++


To start, we’ll create several functions that, when taken collectively, could be considered to be our Account Applications service. Namely, we’ll make functions allowing us to submit new applications (consisting of just a record with a name and an address), flag applications for review, and mark applications as approved or rejected. We’ll also add a capability to list all applications in a certain state (like SUBMITTED or FLAGGED) to save ourselves the trouble of inspecting the service’s data store directly.

### In this step, we will:

- Install the AWS SAM CLI

- Download a starting point containing first-versions of our Account Applications and Data Checking services. These services are implemented as a collection of Node.js Lambda functions and one DynamoDB table, and all these resources are managed by the AWS SAM framework. If you're not comfortable with Node.JS or JavaScript, don't worry; the code is really simple and you should be able to follow along without any issues.


### Make these changes

➡️ Step 1. In your Cloud9 workspace's terminal command line, run this command to install Homebrew, a package manager that we'll use to install the AWS SAM CLI. Note: you'll need to press enter when prompted to continue the install.

```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
```

➡️ Step 2. Now, run these commands to install the SAM CLI and all of the housekeeping of getting the first versions of our services deployed:
```
# Then get brew into our $PATH
test -d ~/.linuxbrew && eval $(~/.linuxbrew/bin/brew shellenv)
test -d /home/linuxbrew/.linuxbrew && eval $(/home/linuxbrew/.linuxbrew/bin/brew shellenv)
test -r ~/.bash_profile && echo "eval \$($(brew --prefix)/bin/brew shellenv)" >>~/.bash_profile
echo "eval \$($(brew --prefix)/bin/brew shellenv)" >>~/.profile

# Install the AWS SAM CLI
brew tap aws/tap
brew install aws-sam-cli

# Bootstrap our initial services into ./workshop-dir
git clone https://github.com/gabehollombe-aws/step-functions-workshop.git          
cp -R step-functions-workshop/sam_template/ workshop-dir

# Change to our new directory
cd workshop-dir
```

➡️ Step 2. Use the SAM CLI to build our Lambda functions in preparation for a deploy. 

From the terminal, run:

```bash
sam build
```

➡️ Step 3. Use the SAM CLI to deploy our Lambda functions and DynamoDB table

From the terminal, run the following command and respond to the interactive prompts in a similar fashion. Then wait a few minutes for the deploy to finish.

```
# Run our first deploy in guided mode. Answer the interactive questions the same way that the comments show below:
sam deploy --guided

# Please respond to the interactive questions like this:
# Stack Name [sam-app]: step-functions-workshop
# AWS Region [us-east-1]: ENTER_THE_SAME_REGION_AS_WHERE_YOUR_CLOUD9_INSTANCE_IS_RUNNING_FROM
# Confirm changes before deploy [y/N]: N
# Allow SAM CLI IAM role creation [Y/n]: Y
# Save arguments to samconfig.toml [Y/n]: Y
```

{{% notice note %}}
While you're waitin for the deploy to finish, take a few moments to look at some of the files we just created in `workshop-dir` to understand what we deployed.
<br/><br/>
Here are some important files worth looking at:
<br/><br/>
`functions/account-applications/submit.js`
<br/>
This implements our SubmitApplication Lambda function. There are similar files for `find`, `flag`, `reject`, and `approve` as well.
<br/><br/>
`functions/account-applications/AccountApplications.js`
<br/>
This is a common file that provides CRUD style operations for our Account Application data type. It's used by the various `functions/account-applications/*.js` Lambda functions.
<br/><br/>
`functions/data-checking/data-checking.js`
<br/>
This implements our DataChecking Lambda function. It contains code to handle requests to check a name and an address against some simple validation rules.
<br/><br/>
`template.yaml`<br/>This is the file that AWS SAM looks at to determine what we want resources we want to cloud create and deploy as part of our solution. If you're familiar with AWS CloudFormation, the structure of this file will look pretty familiar to you, because AWS SAM is just a set of conveniences built on top of CloudFormation.
{{% /notice %}}


Now we have fully-deployed Lambda functions that can handle all of the steps involved to move an application from SUBMITTED, to FLAGGED, to APPROVED or REJECTED. And, we also have a stand-alone data checking Lambda function which we'll use later in our orchestration.

