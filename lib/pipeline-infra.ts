#!/usr/bin/env node
import codebuild = require('@aws-cdk/aws-codebuild');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import actions = require('@aws-cdk/aws-codepipeline-api');
import cfn = require('@aws-cdk/aws-cloudformation');
import iam = require('@aws-cdk/aws-iam');
import cdk = require('@aws-cdk/cdk');

// import { arnFromComponents } from '@aws-cdk/cdk';
// import { CfnDHCPOptions } from '@aws-cdk/aws-ec2';
// import { TestAction } from '@aws-cdk/aws-codepipeline-api';
// import { CodePipelineSource } from '@aws-cdk/aws-codebuild';

export interface ColumbaCfnPipelineInfraProps {
    stackName: string;
    pipelineName: string;
    directory: string;
    stage: string;
}

export class ColumbaCfnPipelineInfra extends cdk.Construct {
    public readonly pipeline: codepipeline.Pipeline;

    public readonly sourceAction: actions.SourceAction

    constructor(scope: cdk.Construct, name: string, props: ColumbaCfnPipelineInfraProps) {
        super(scope, name);

        const pipeline = new codepipeline.Pipeline(this, props.pipelineName, {
            pipelineName: 'columba-' + props.pipelineName,
        });
        this.pipeline = pipeline;

        pipeline.addToRolePolicy(new iam.PolicyStatement()
            .addAllResources()
            .addActions("ecr:DescribeImages"));

        // Source
        const githubAccessToken = new cdk.SecretParameter(this, 'GitHubToken1', { ssmParameter: 'GitHubToken1' });
        const sourceStage = pipeline.addStage({
            name: 'Source',
          });
        const sourceAction = new codepipeline.GitHubSourceAction({
            actionName: 'GitHub_Source',
            owner: 'meloxl',
            repo: 'columba',
            branch: 'master', // default: 'master'
            oauthToken: githubAccessToken.value,
            outputArtifactName: 'SourceOutput', // this will be the name of the output artifact in the Pipeline
          });
          sourceStage.addAction(sourceAction);

        // Build
        const buildStage = pipeline.addStage({
            name: 'Build',
          });
        const buildProject = new codebuild.Project(this, 'BuildProject', {
            source: new codebuild.GitHubSource({
                owner: 'meloxl',
                repo: 'Columba',
                oauthToken: githubAccessToken.value
            }),
            buildSpec: props.directory + '/buildspec.yml',
            environment: {
              buildImage: codebuild.LinuxBuildImage.UBUNTU_14_04_NODEJS_10_1_0,
              environmentVariables: {
                'ARTIFACTS_BUCKET': {
                    value: pipeline.artifactBucket.bucketName
                }
              },
              privileged: true
            },
            artifacts: new codebuild.S3BucketBuildArtifacts({
                bucket: pipeline.artifactBucket,
                name: 'output.zip'
            })
        });

        buildProject.addToRolePolicy(new iam.PolicyStatement()
            .addAllResources()
            .addAction('ec2:DescribeAvailabilityZones')
            .addAction('route53:ListHostedZonesByName'));
        // buildProject.addToRolePolicy(new iam.PolicyStatement()
        //     .addAction('ssm:GetParameter')
        //     .addResource(cdk.ArnUtils.fromComponents({
        //         service: 'ssm',
        //         resource: 'parameter',
        //         resourceName: 'CertificateArn-*'
        //     })));
        buildProject.addToRolePolicy(new iam.PolicyStatement()
            .addAllResources()
            .addActions("ecr:GetAuthorizationToken",
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:GetRepositoryPolicy",
                "ecr:DescribeRepositories",
                "ecr:ListImages",
                "ecr:DescribeImages",
                "ecr:BatchGetImage",
                "ecr:InitiateLayerUpload",
                "ecr:UploadLayerPart",
                "ecr:CompleteLayerUpload",
                "ecr:PutImage"));
        // buildProject.addToRolePolicy(new iam.PolicyStatement()
        //     .addAction('cloudformation:DescribeStackResources')
        //     .addResource(cdk.ArnComponents(
        //         service: 'cloudformation',
        //         resource: 'stack',
        //         resourceName: 'Columba*'
        //     )));
  
        buildProject.addToRolePolicy(new iam.PolicyStatement()
            .addActions("cloudformation:DescribeStackResources",
            "cloudformation:DescribeStacks",
            "cloudformation:DescribeChangeSet",
            "cloudformation:ExecuteChangeSet")
            .addAllResources()
        );

    //     buildProject.addToRolePolicy(new iam.PolicyStatement()
    //     .addAction('cloudformation:DescribeStackResources')
    //     .addResource(cdk.arnFromComponents({
    //             service: 'cloudformation',
    //             resource: 'stack',
    //             resourceName: 'Columba*'
    //     }, GpayStack))
    // );

        const buildAction = new codebuild.PipelineBuildAction({
            actionName: 'CodeBuild',
            project: buildProject,
            inputArtifact: sourceAction.outputArtifact,   
              
          });
        buildStage.addAction(buildAction);

        // Stage
        const testdStage = pipeline.addStage({
            name: props.stage,
          });
        const templatePrefix =  'Columba' + props.stackName;
        const infraStackName = 'Columba' + props.stackName + props.stage;  
        // const templatePrefix =  props.templateName;
        // const testStackName = props.stackName;
        const changeSetName = 'StagedChangeSet';

        testdStage.addAction(new cfn.PipelineCreateReplaceChangeSetAction({
            stackName: infraStackName,
            changeSetName,
            templatePath: buildAction.outputArtifact.atPath(templatePrefix + 'Prod.template.yaml'),
            adminPermissions: true,
            actionName: 'CreateReplaceChangeSetAction',
            runOrder: 1
        }));  

        // new cfn.PipelineCreateReplaceChangeSetAction({
        //     stackName: testStackName,
        //     changeSetName,
        //     runOrder: 1,
        //     adminPermissions: true,
        //     templatePath: buildAction.outputArtifact.atPath(templatePrefix + 'Test.template.yaml'),
        // });

        testdStage.addAction(new cfn.PipelineExecuteChangeSetAction({
            actionName: 'ExecuteChangeSetAction',
            stackName: infraStackName,
            changeSetName,
            runOrder: 2, 
        }));
        // testdStage.addAction(CreateAction);
        // testdStage.addAction(ExecuteAction);

        // Prod
        // const prodStage = pipeline.addStage('Prod');
        // const prodStackName = 'TriviaGame' + props.stackName + 'Prod';

        // new cfn.PipelineCreateReplaceChangeSetAction(this, 'PrepareChanges', {
        //     stage: prodStage,
        //     stackName: prodStackName,
        //     changeSetName,
        //     runOrder: 1,
        //     adminPermissions: true,
        //     templatePath: buildAction.outputArtifact.atPath(templatePrefix + 'Prod.template.yaml'),
        // });

        // new cfn.PipelineExecuteChangeSetAction(this, 'ExecuteChangesProd', {
        //     stage: prodStage,
        //     stackName: prodStackName,
        //     changeSetName,
        //     runOrder: 2
        // });
    }
}