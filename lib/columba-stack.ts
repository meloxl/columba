import cdk = require('@aws-cdk/cdk');
import { ColumbaCfnPipeline } from './pipeline';
import { ColumbaImagePipeline } from './web-image-pipeline';


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

    new ColumbaImagePipeline(this, 'ColumbaImagePipeline', {
      pipelineName: 'columba-image',
      githubOwner: 'meloxl',
      githubRepo: 'docker-python-simplehttpserver',
      githubBrance: 'dev' 
    })
  }
}
