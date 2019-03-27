#!/usr/bin/env node
import codebuild = require('@aws-cdk/aws-codebuild');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import iam = require('@aws-cdk/aws-iam');
import cdk = require('@aws-cdk/cdk');

export interface CommonBaseImageProps {
    pipelineName: string,
    githubOwner: string,
    githubRepo: string,
    githubBrance: string,
}

export class ColumbaImagePipeline extends cdk.Construct {
    constructor(scope: cdk.Construct, name: string, props: CommonBaseImageProps) {
        super(scope, name);

        const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
            pipelineName:  props.pipelineName,  //'columba-image'
        });

        // Source
        const githubAccessToken = new cdk.SecretParameter(this, 'GitHubToken1', { ssmParameter: 'GitHubToken1' });
        const sourceStage = pipeline.addStage({
            name: 'Source',
        });
        const sourceAction = new codepipeline.GitHubSourceAction({
            actionName: 'GitHub_Source',
            owner:  props.githubOwner,  //'meloxl',
            repo: props.githubRepo,     //'columba',
            branch: props.githubBrance,       //'master', // default: 'master'
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
                owner: props.githubOwner ,//'meloxl'
                repo: props.githubRepo,     //'columba'
                oauthToken: githubAccessToken.value
            }),
            buildSpec: 'buildspec.yml',
            environment: {
              buildImage: codebuild.LinuxBuildImage.UBUNTU_14_04_DOCKER_17_09_0,
            //   environmentVariables: {
            //     'ARTIFACTS_BUCKET': {
            //         value: pipeline.artifactBucket.bucketName
            //     }
            //   },
              privileged: true
            },
            // artifacts: new codebuild.S3BucketBuildArtifacts({
            //     bucket: pipeline.artifactBucket,
            //     name: 'output.zip'
            // })
        });

        // buildProject.addToRolePolicy(new iam.PolicyStatement()
        //     .addAllResources()
        //     .addAction('ec2:DescribeAvailabilityZones')
        //     .addAction('route53:ListHostedZonesByName'));
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
        //     .addActions("cloudformation:DescribeStackResources",
        //     "cloudformation:DescribeStacks",
        //     "cloudformation:DescribeChangeSet",
        //     "cloudformation:ExecuteChangeSet")
        //     .addAllResources()
        // );

        const buildAction = new codebuild.PipelineBuildAction({
            actionName: 'CodeBuild',
            project: buildProject,
            inputArtifact: sourceAction.outputArtifact,               
          });
        buildStage.addAction(buildAction);

                  
        // // Build
        // const buildStage = pipeline.addStage('Build');
        // const project = new codebuild.PipelineProject(this, 'BuildBaseImage', {
        //     buildSpec: 'trivia-backend/base/buildspec.yml',
        //     environment: {
        //         buildImage: codebuild.LinuxBuildImage.UBUNTU_14_04_DOCKER_17_09_0,
        //         privileged: true
        //     }
        // });
        // project.addToRolePolicy(new iam.PolicyStatement()
        //     .addAllResources()
        //     .addActions("ecr:GetAuthorizationToken",
        //         "ecr:BatchCheckLayerAvailability",
        //         "ecr:GetDownloadUrlForLayer",
        //         "ecr:GetRepositoryPolicy",
        //         "ecr:DescribeRepositories",
        //         "ecr:ListImages",
        //         "ecr:DescribeImages",
        //         "ecr:BatchGetImage",
        //         "ecr:InitiateLayerUpload",
        //         "ecr:UploadLayerPart",
        //         "ecr:CompleteLayerUpload",
        //         "ecr:PutImage"));
        // project.addToPipeline(buildStage, 'CodeBuild');
    }
}

// const app = new cdk.App();
// new ColumbaImagePipeline(app, 'ColumbaImagePipeline');
// app.run();
