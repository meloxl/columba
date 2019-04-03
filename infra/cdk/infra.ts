import ec2 = require('@aws-cdk/aws-ec2');
import rds = require('@aws-cdk/aws-rds');
import cdk = require('@aws-cdk/cdk');
import elasticache = require('@aws-cdk/aws-elasticache');

// import events = require('@aws-cdk/aws-events');
// import lambda = require('@aws-cdk/aws-lambda');
// import fs = require('fs');

interface ColumbaStackProps extends cdk.StackProps {
  stage: string;
  cidr: string;
  dbusername: string;
  dbpassword: string;
  dbinstance: string;
  dbinstanceidentifier: string;
  cacheNodeType: string;
  redisengine: string;
}

export class Infra extends cdk.Stack {
  public readonly vpc: ec2.VpcNetwork;
  public readonly dbclsterpar: rds.CfnDBCluster;
  // public readonly rediscluster: elasticache.CfnCacheCluster;


  constructor(scope: cdk.App, id: string, props: ColumbaStackProps) {
    super(scope, id, props);

      const vpc = new ec2.VpcNetwork(this, 'ColumbaVpc', { 
        cidr: props.cidr,     //"10.91.0.0/16", 
        maxAZs: 2 ,
        subnetConfiguration: [
            {
              cidrMask: 20,
              name: 'Public',
              subnetType: ec2.SubnetType.Public,
            },
            {
              cidrMask: 20,
              name: 'Private',
              subnetType: ec2.SubnetType.Private,
            }
        ],
        natGateways: 1,
    });

    //  network sg (ssh elb)
    const exssh_sg = new ec2.SecurityGroup(this, 'columba-external-ssh', {
      vpc,
      description: 'Allow ssh access from the world',
      allowAllOutbound: true   // Can be set to false
    });
    exssh_sg.addIngressRule(new ec2.AnyIPv4(), new ec2.TcpPort(22), 'allow ssh access from the world');

    const inssh_sg = new ec2.SecurityGroup(this, 'columba-internal-ssh', {
      vpc,
      description: 'Allow ssh access from bastion',
      allowAllOutbound: true   // Can be set to false
    });
    inssh_sg.addIngressRule(exssh_sg, new ec2.TcpPort(22), 'allow ssh access from bastion',true);

    const exelb_sg = new ec2.SecurityGroup(this, 'columba-external-elb', {
      vpc,
      description: 'Allows external ELB traffic',
      allowAllOutbound: true   // Can be set to false
    });
    exelb_sg.addIngressRule(new ec2.AnyIPv4(), new ec2.TcpPort(80), 'allows external ELB traffic');

    const inelb_sg = new ec2.SecurityGroup(this, 'columba-internal-elb', {
      vpc,
      description: 'Allows internal ELB traffic',
      allowAllOutbound: true   // Can be set to false
    });
    inelb_sg.addIngressRule(new ec2.CidrIPv4(props.cidr), new ec2.TcpPort(80), 'allows internal ELB traffic');    

    //add new RDS sg
    const rds_sg = new ec2.SecurityGroup(this, 'columbasg', {
      vpc,
      description: 'RDS security group',
      allowAllOutbound: true   // Can be set to false
    });
    rds_sg.addIngressRule(new ec2.CidrIPv4(props.cidr), new ec2.TcpPort(3306), 'RDS security group'); 

    new ec2.Connections({
      securityGroups: [rds_sg],
      defaultPortRange: new ec2.TcpPort(3306)
    }); 

    // new rds.DatabaseCluster(this,'Database', {
    //     engine: rds.DatabaseClusterEngine.Aurora,
    //     masterUser: {
    //         username: 'root',
    //         password: 'Mobifun365',
    //     },
    //     instanceProps: {
    //         instanceType: new ec2.InstanceTypePair(ec2.InstanceClass.Burstable2, ec2.InstanceSize.Small),
    //         vpcPlacement: {
    //             subnetsToUse: ec2.SubnetType.Private,
    //         },
    //         vpc
    //     },
    //     port: 3306,
    //     defaultDatabaseName: 'columba',
    //     instances: 1,
    // });

    //new rds
    const dbclsterpar = new rds.CfnDBClusterParameterGroup(this, 'rdspg', {
      description: 'columba-rds cluster',
      family: 'aurora5.6',
      parameters: {
        'binlog_checksum': 'none',
        'binlog_format': 'row' 
      },
    })

    const dbpar = new rds.CfnDBParameterGroup(this, 'dbpg', {
      description: 'columba-rds ParameterGroup',
      family: 'aurora5.6',
      parameters: {
        'log_bin_trust_function_creators' : '1',
      }
    })

    const rdssubnet = new rds.CfnDBSubnetGroup(this, 'rdssubnet', {
      dbSubnetGroupDescription: 'columba-rds SubnetGroup',
      subnetIds: vpc.privateSubnets.map(function(subnet) {
        return subnet.subnetId;
      }),
      dbSubnetGroupName: 'columba-' + props.stage + '-rds',
    })


    const dbcluster = new rds.CfnDBCluster(this, 'columbards', {
      engine: 'aurora',
      availabilityZones: vpc.availabilityZones,
      databaseName: 'columba',
      dbClusterParameterGroupName: dbclsterpar.dbClusterParameterGroupName,
      dbSubnetGroupName: rdssubnet.dbSubnetGroupName,
      // engineMode: 'provisioned',
      engineVersion: '5.6.10a',
      masterUsername: props.dbusername,  //'root',
      masterUserPassword: props.dbpassword,   //'Mbifun365',
      port: 3306,
      vpcSecurityGroupIds: [
        rds_sg.groupName
      ],
    
    })

    new rds.CfnDBInstance(this, 'rdsinstance', {
      dbInstanceClass: props.dbinstance,    //'db.t2.small',
      engine: 'aurora',
      dbClusterIdentifier: dbcluster.dbClusterName,
      dbParameterGroupName: dbpar.dbParameterGroupName,
      dbSubnetGroupName: rdssubnet.dbSubnetGroupName,
      dbInstanceIdentifier: props.dbinstanceidentifier,  //'columba-prod-1',
    })

/////////////////////////////
    // //add solo db instance

    // const dbmysqlpar = new rds.CfnDBParameterGroup(this, 'dbmysqlpg', {
    //   description: 'columba-prod-rds',
    //   family: 'mysql5.6',
    //   parameters: {
    //     'log_bin_trust_function_creators' : '1',
    //   }
    // })

    // new rds.CfnDBInstance(this, 'rdsdb', {
    //   allocatedStorage: '10',
    //   dbInstanceClass: 'db.t2.small',
    //   engine: 'mysql',
    //   dbParameterGroupName: dbmysqlpar.dbParameterGroupName,
    //   dbSubnetGroupName: rdssubnet.dbSubnetGroupName,
    //   vpcSecurityGroups: [rds_sg.groupName],
    //   dbInstanceIdentifier: 'columba-test',
    //   masterUsername: 'root',
    //   masterUserPassword: 'mobifun365',
    // })

  
    //new redis
    const redissubnet = new elasticache.CfnSubnetGroup(this, 'redissug',{
      description: 'columba-' + props.stage + '-redis',
      subnetIds: vpc.privateSubnets.map(function(subnet) {
        return subnet.subnetId;
      }),
      cacheSubnetGroupName: 'columba-' + props.stage + '-redis',
    })

    const redispar = new elasticache.CfnParameterGroup(this , 'redispg',{
      cacheParameterGroupFamily: "redis4.0",
      description: 'columba-' + props.stage + '-redis',
    })

    // The security group that defines network level access to the cluster
    const redis_sg = new ec2.SecurityGroup(this, 'redis_sg', {
      vpc,
      description: 'RDS security group',
      allowAllOutbound: true   // Can be set to false
    });
    redis_sg.addIngressRule(new ec2.CidrIPv4(props.cidr), new ec2.TcpPort(6379), 'RDS security group');   

    new ec2.Connections({
      securityGroups: [redis_sg],
      defaultPortRange: new ec2.TcpPort(6379)
    });

    new elasticache.CfnCacheCluster(this, 'ColumbaRedis',{
      cacheNodeType: props.cacheNodeType ,     //'cache.t2.micro',
      engine: props.redisengine ,      //'redis',
      numCacheNodes: 1,
      clusterName: "columba" + props.stage + "redis",
      engineVersion: "4.0.10",
      autoMinorVersionUpgrade: false,
      port: 6379,
      vpcSecurityGroupIds: [
          redis_sg.securityGroupId
      ],
      cacheSubnetGroupName: redissubnet.subnetGroupName,
      cacheParameterGroupName: redispar.parameterGroupName

  })

// // cron lambda
//   const lambdaFn = new lambda.Function(this, 'Singleton', {
//     code: new lambda.InlineCode(fs.readFileSync('lambda-handler.py', { encoding: 'utf-8' })),
//     handler: 'index.main',
//     timeout: 300,
//     runtime: lambda.Runtime.Python27,
//   });

//   // Run every day at 6PM UTC
//   // See https://docs.aws.amazon.com/lambda/latest/dg/tutorial-scheduled-events-schedule-expressions.html
//   const rule = new events.EventRule(this, 'Rule', {
//     scheduleExpression: 'cron(0 18 ? * MON-FRI *)',
//   });
//   rule.addTarget(lambdaFn);



  }
}

const app = new cdk.App();

new Infra(app, 'ColumbaInfraProd', {
  stage: "prod",
  cidr: "10.91.0.0/16",
  dbusername: "app",
  dbpassword: "x6oGqOMQJCw8",
  dbinstance: "db.t2.small",
  dbinstanceidentifier: "columba-prod-1",
  cacheNodeType: "cache.t2.micro",
  redisengine: "redis",
});

new Infra(app, 'ColumbaInfraStg', {
  stage: "stg",
  cidr: "10.92.0.0/16",
  dbusername: "root",
  dbpassword: "x6oGqOMQJCw8",
  dbinstance: "db.t2.small",
  dbinstanceidentifier: "columba-stg-1",
  cacheNodeType: "cache.t2.micro",
  redisengine: "redis",
});

app.run();