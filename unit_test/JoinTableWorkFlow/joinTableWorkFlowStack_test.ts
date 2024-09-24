import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { JoinedTableWorkFlowStack } from '../../src/lib/joinedTableWorkflow_stack'; // Adjust path

test('JoinedTableWorkFlowStack creates resources with correct properties', () => {
  const app = new App();

  // Set context values (replace with appropriate mock values)
  app.node.setContext('activityTableName', 'ActivityTable');
  app.node.setContext('entityTableName', 'EntityTable');
  app.node.setContext('rlsTableName', 'RLSTable');
  app.node.setContext('dataSourceBucket', 'my-data-source-bucket');
  app.node.setContext('tableName', 'my-data-source-table');
  app.node.setContext('databaseName', 'my-glue-database');

  const stack = new JoinedTableWorkFlowStack(app, 'TestJoinedTableWorkFlowStack');
  const template = Template.fromStack(stack);

  // Assert Glue Crawler for DynamoDB tables
  template.hasResourceProperties('AWS::Glue::Crawler', {
    Name: 'dynamodb_db_crawler',
    Role: {
      'Fn::GetAtt': [
        Match.stringLikeRegexp('GlueRole*'),
        'Arn'
      ]
    },
    DatabaseName: 'dynamodb_db',
    Targets: {
      DynamoDBTargets: [
        {
          Path: 'ActivityTable'
        },
        {
          Path: 'EntityTable'
        }
      ]
    },
    RecrawlPolicy: {
      RecrawlBehavior: 'CRAWL_EVERYTHING'
    }
  });

  // Assert Glue Job
  template.hasResourceProperties('AWS::Glue::Job', {
    Name: 'glue_join_job',
    Role: {
      'Fn::GetAtt': [
        Match.stringLikeRegexp('GlueRole*'),
        'Arn'
      ]
    },
    Command: {
      Name: 'glueetl',
      PythonVersion: '3',
      ScriptLocation: 's3://nuoadatabasetest/glue__job.py'
    },
    DefaultArguments: {
      '--TempDir': 's3://my-data-source-bucket/temp/',
      '--output_path': 's3://my-data-source-bucket/my-data-source-table/',
      '--activity_table': 'ActivityTable',
      '--entity_table': 'EntityTable'
    },
    MaxRetries: 1,
    GlueVersion: '4.0'
  });

  // Assert Glue Crawler for Parquet table
  template.hasResourceProperties('AWS::Glue::Crawler', {
    Name: 'joinedTable-s3-parquet-crawler',
    Role: {
      'Fn::GetAtt': [
        Match.stringLikeRegexp('GlueRole*'),
        'Arn'
      ]
    },
    DatabaseName: 'my-glue-database',
    Targets: {
      S3Targets: [
        {
          Path: 's3://my-data-source-bucket/my-data-source-table/'
        }
      ]
    }
  });

  // Assert Glue Workflow
  template.hasResourceProperties('AWS::Glue::Workflow', {
    Name: 'glue-workflow',
    Description: 'ETL workflow to convert DynamoDB tables to parquet and then load into Quicksight'
  });

  // Assert Glue Triggers (You might need to adjust these based on the generated names)
  template.hasResourceProperties('AWS::Glue::Trigger', {
    Name: 'Run-Crawlerdynamodb_db_crawler',
    WorkflowName: 'glue-workflow',
    Actions: [
      {
        CrawlerName: 'dynamodb_db_crawler',
        Timeout: 200
      }
    ],
    Type: 'ON_DEMAND'
  });

  template.hasResourceProperties('AWS::Glue::Trigger', {
    Name: 'Run-Jobglue_join_job',
    WorkflowName: 'glue-workflow',
    Actions: [
      {
        JobName: 'glue_join_job',
        Timeout: 200
      }
    ],
    Predicate: {
      Conditions: [
        {
          LogicalOperator: 'EQUALS',
          CrawlerName: 'dynamodb_db_crawler',
          CrawlState: 'SUCCEEDED'
        }
      ],
      Logical: 'ANY'
    },
    Type: 'CONDITIONAL',
    StartOnCreation: true
  });

  template.hasResourceProperties('AWS::Glue::Trigger', {
    Name: 'Run-Crawler-joinedTable-s3-parquet-crawler',
    WorkflowName: 'glue-workflow',
    Actions: [
      {
        CrawlerName: 'joinedTable-s3-parquet-crawler'
      }
    ],
    Predicate: {
      Conditions: [
        {
          LogicalOperator: 'EQUALS',
          JobName: 'glue_join_job',
          State: 'SUCCEEDED'
        }
      ],
      Logical: 'ANY'
    },
    Type: 'CONDITIONAL',
    StartOnCreation: true
  });

  // Assert IAM Role and Policies
  template.hasResourceProperties('AWS::IAM::Role', {
    AssumeRolePolicyDocument: {
      Statement: [
        {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: { Service: 'glue.amazonaws.com' }
        }
      ],
      Version: '2012-10-17'
    },
    ManagedPolicyArns: [
      {
        'Fn::Join': [
          '',
          [
            'arn:',
            { Ref: 'AWS::Partition' },
            ':iam::aws:policy/service-role/AWSGlueServiceRole'
          ]
        ]
      }
    ]
  });

    // Assert inline policy for DynamoDB access (glue_joinJobPolicy)
  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyName: 'GlueRolePolicy', // Make sure this matches the policyName you set
    PolicyDocument: {
        Statement: [
            {
                Action: [
                    'dynamodb:DescribeTable',
                    'dynamodb:Scan',
                    'dynamodb:Query'
                ],
                Effect: 'Allow',
                Resource: [
                  'arn:aws:dynamodb:ap-southeast-1:203903977784:table/ActivityTable',
                  'arn:aws:dynamodb:ap-southeast-1:203903977784:table/EntityTable'
                ]
            }
        ],
        Version: '2012-10-17'
    },
    Roles: [
        { Ref: Match.stringLikeRegexp('GlueRole') }
    ]
  });

  // Assert inline policy for S3 access
  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: [
        {
          Action: [
            's3:GetObject',
            's3:PutObject',
            's3:ListBucket'
          ],
          Effect: 'Allow',
          Resource: [
            {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':s3:::my-data-source-bucket/*'
                ]
              ]
            },
            {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':s3:::my-data-source-bucket'
                ]
              ]
            }
          ]
        }
      ],
      Version: '2012-10-17'
    },
    Roles: [
      { Ref: Match.stringLikeRegexp('GlueRole*') }
    ]
  });


  // Assert CfnOutputs
  template.hasOutput('WorkflowName', {
    Value: 'glue-workflow',
    Description: 'Name of glue join table workflow',
    Export: {
      Name: 'WorkflowName'
    }
  });

  template.hasOutput('ParquetTableCrawlerName', {
    Value: 'joinedTable-s3-parquet-crawler',
    Description: 'Name of crawler that crawl the parquet joined table',
    Export: {
      Name: 'ParquetTableCrawlerName'
    }
  });
});