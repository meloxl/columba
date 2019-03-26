#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/cdk');
import { ColumbaStack } from '../lib/columba-stack';

const app = new cdk.App();
new ColumbaStack(app, 'ColumbaStack');
app.run();
