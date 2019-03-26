import cdk = require('@aws-cdk/cdk');
import { ColumbaCfnPipeline } from './pipeline';


export class ColumbaStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    new ColumbaCfnPipeline(this, 'Pipeline', {
      pipelineName: 'infra',
      stackName: 'Infra',
      templateName: 'Infra',
      directory: 'infra/cdk'
    });
  }
}
