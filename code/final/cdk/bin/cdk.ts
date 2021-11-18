#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { SfWorkshopStack } from '../lib/cdk-stack';

const app = new cdk.App();
new SfWorkshopStack(app, 'SfnWorkshopStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT || "", region: process.env.CDK_DEFAULT_REGION || "" },
});
