+++
title = "Creating the Data Checking service"
chapter = false
weight = 40
+++

To keep things simple, we’ll create the Data Checking service as just another Lambda function defined in our same `workshop-dir` project folder. 

Also, for the sake of keeping our code simple, we’ll implement our name and address checking logic with some overly-simple rules: 

* Any name will be flagged if it contains the lowercase string ‘evil’ anywhere in it. So ‘Spock’ is OK but ‘evil Spock’ is not.

* Any address will be flagged if it doesn’t match the pattern of number(s)-space-letter(s) OR letter(s)-space-number(s). So, ‘123 Enterprise Street’ is OK, and so are 'Enterprise Street 123' and 'E 1', but ‘123EnterpriseStreet’ and ‘Some Street’ and ‘123’ are not OK.

### In this step, we will:

* Create `data-checking.js` to implement our Data Checking service Lambda function.

* Add some additional configuration to `serverless.yml` to create a new AWS Lambda function called `DataChecking` and implemented by `data-checking.js` along with a new IAM role with permissions for the function to log to Amazon CloudWatch. 

### Make these changes

➡️ Step 1. Create `workshop-dir/data-checking.js` with ___CLIPBOARD_BUTTON e876cc5b865e13312cc324cea45ab3ece5e1c5c1:code/data-checking.js|

➡️ Step 2. Replace `serverless.yml` with ___CLIPBOARD_BUTTON 03eee8d58ad56817b84197e45c12f2ce83ae8d52:serverless.yml|

➡️ Step 3. From the terminal, run:

```bash
sls deploy
```


### Try it out

After the deploy finishes, we can interact with our new data-checking lambda to check any name or address string we like. Try each check with valid and invalid inputs.


➡️ Step 1. Check a valid name. Run:

```
sls invoke -f DataChecking --data='{"command": "CHECK_NAME", "data": { "name": "Spock" } }'
```

➡️ Step 2. Check an invalid name. Run:

```
sls invoke -f DataChecking --data='{"command": "CHECK_NAME", "data": { "name": "evil Spock" } }'
```

➡️ Step 3. Check a valid address. Run:

```
sls invoke -f DataChecking --data='{"command": "CHECK_ADDRESS", "data": { "address": "123 Street" } }'
```

➡️ Step 4. Check an invalid address. Run:

```
sls invoke -f DataChecking --data='{"command": "CHECK_ADDRESS", "data": { "address": "DoesntMatchAddressPattern" } }'
```


As you can see, the Data Checking service just returns a simple JSON style response with one variable, `flagged` returning true if the value being checked requires further scrutiny by a human.

We now have all the basic capabilities we need in our services in order to begin connecting them together to implement the beginnings of our desired application processing workflow. The big question is ‘how should we connect these services together’?  