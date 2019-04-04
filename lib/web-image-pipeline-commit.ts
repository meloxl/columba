#!/usr/bin/env node
import codebuild = require('@aws-cdk/aws-codebuild');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import actions = require('@aws-cdk/aws-codepipeline-api');
import iam = require('@aws-cdk/aws-iam');
import cdk = require('@aws-cdk/cdk');
import ecr = require('@aws-cdk/aws-ecr');
import codecommit = require('@aws-cdk/aws-codecommit');


export interface CommonBaseImageProps {
    pipelineName: string,
    codecommitRepo: string,
}

export class ColumbacodeImagePipeline extends cdk.Construct {
    public readonly sourceAction: actions.SourceAction
    // public readonly repository: ecr.
    // public readonly repository: ecr.IRepository


    constructor(scope: cdk.Construct, name: string, props: CommonBaseImageProps) {
        super(scope, name);

        const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
            pipelineName:  props.pipelineName,  //'columba-image'
        });

        //CodeCommit
        const sourceStage = pipeline.addStage({
            name: 'Source',
        });
        // const repo = new codecommit.Repository(this, 'Repository' ,{
        //     repositoryName: props.codecommitRepo,
        //     description: 'columba code description.', // optional property
        // });
        const repo = codecommit.Repository.import(this, 'Repository', {
            repositoryName: props.codecommitRepo
        }); 

        const sourceAction = new codecommit.PipelineSourceAction({
            actionName: 'CodeCommit_Source',
            repository: repo,
            branch: 'env',
        });
        sourceStage.addAction(sourceAction);

        // pipeline.addStage({
        //     name: 'Source',
        //     actions: [sourceAction],
        // });

        // // Source
        // const githubAccessToken = new cdk.SecretParameter(this, 'GitHubToken1', { ssmParameter: 'GitHubToken1' });
        // const sourceStage = pipeline.addStage({
        //     name: 'Source',
        // });
        // const sourceAction = new codepipeline.GitHubSourceAction({
        //     actionName: 'GitHub_Source',
        //     owner:  props.githubOwner,  //'meloxl',
        //     repo: props.githubRepo,     //'columba',
        //     branch: props.githubBrance,       //'master', // default: 'master'
        //     oauthToken: githubAccessToken.value,
        //     outputArtifactName: 'SourceOutput', // this will be the name of the output artifact in the Pipeline
        // });
        // sourceStage.addAction(sourceAction);

        const baseImageRepo = ecr.Repository.import(this, 'BaseRepo', { 
            repositoryName: 'web-base'  ,
            repositoryArn: 'arn:aws:ecr:us-east-1:135533367653:repository/web-base'

        });
        const dockerImageSourceAction = new ecr.PipelineSourceAction({
            repository: baseImageRepo,
            imageTag: 'latest',
            actionName: 'BaseImage',
            runOrder: 1,
            outputArtifactName: 'BaseImage'
        });
        sourceStage.addAction(dockerImageSourceAction);


        // Build
        const buildStage = pipeline.addStage({
            name: 'Build',
          });
        const buildProject = new codebuild.Project(this, 'BuildProject', {
            source: new codebuild.CodeCommitSource({
                repository: repo
            }),
            buildSpec: 'buildspec.yml',
            environment: {
              buildImage: codebuild.LinuxBuildImage.UBUNTU_14_04_DOCKER_17_09_0,
              privileged: true
            },
        });

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
            additionalInputArtifacts: [dockerImageSourceAction.outputArtifact], 
          });
        buildStage.addAction(buildAction);

    }
}

// const app = new cdk.App();
// new ColumbaImagePipeline(app, 'ColumbaImagePipeline');
// app.run();
