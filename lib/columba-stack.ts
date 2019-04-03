import cdk = require('@aws-cdk/cdk');
// import { ColumbaCfnPipeline } from './pipeline';
import { ColumbaCfnPipelineInfra } from './pipeline-infra';
// import { ColumbaImagePipeline } from './web-image-pipeline';
import { ColumbacodeImagePipeline } from './web-image-pipeline-commit';

export class ColumbaStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    // new ColumbaCfnPipeline(this, 'Pipeline', {
    //   pipelineName: 'infra',
    //   stackName: 'Infra',
    //   templateName: 'Infra',
    //   directory: 'infra/cdk'
    // });

    new ColumbaCfnPipelineInfra(this, 'PipelineProd', {
      pipelineName: 'infra-prod',
      stackName: 'Infra',
      directory: 'infra/cdk',
      stage: 'Prod'
    });   
    
    new ColumbaCfnPipelineInfra(this, 'PipelineStg', {
      pipelineName: 'infra-stg',
      stackName: 'Infra',
      directory: 'infra/cdk',
      stage: 'Stg'
    });  

    // new ColumbaImagePipeline(this, 'ColumbaImagePipeline', {
    //   pipelineName: 'columba-image',
    //   githubOwner: 'meloxl',
    //   githubRepo: 'docker-python-simplehttpserver',
    //   githubBrance: 'dev' 
    // });

    new ColumbacodeImagePipeline(this, 'ColumbacodeImagePipeline', {
      pipelineName: 'columba-code-image',
      codecommitRepo: 'columba',
    })    
  }
}
