import{
    aws_iam as iam,
    aws_glue as glue,
    aws_events as events,
    aws_events_targets as targets,
    aws_dynamodb as dynamodb,
    aws_s3 as s3
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Stack, StackProps, CfnOutput, Fn} from 'aws-cdk-lib';

export class JoinedTableWorkFlowStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const dynamoDBCrawlerName = Fn.importValue('DynamoDBCrawlerName');
        const glueJoinJobName = Fn.importValue('GlueJoinJobName');
        const parquetCrawlerName = Fn.importValue('ParquetCrawlerName');

    // ======================================= Creating Glue workflow =========================================
        const glue_workflow = new glue.CfnWorkflow(this, "glue-workflow", {
            name: "glue-workflow",
            description:
            "ETL workflow to convert DynamoDB tables to parquet and then load into Quicksight",
        });

        // Create triggers

        // Create trigger for DynamoDBCawrler
        const glue_trigger_dynamodb_crawlJob = new glue.CfnTrigger(
            this, "glue-trigger-dynamodb-crawler",
            {
                name: "Run-Crawler" + dynamoDBCrawlerName,
                workflowName: glue_workflow.name,
                actions: [
                    {
                        crawlerName: dynamoDBCrawlerName,
                        timeout: 200,
                    },
                ],
                type: "ON_DEMAND"
            }
        )
        // Add Trigger dependency on workflow and crawler
        glue_trigger_dynamodb_crawlJob.addDependency(glue_workflow);

        // Create trigger for join job
        const glue_trigger_joinJob = new glue.CfnTrigger(
            this, "glue-trigger-joinJob",
            {
                name: "Run-Job" + glueJoinJobName,
                workflowName: glue_workflow.name,
                actions: [
                    {
                        jobName: glueJoinJobName,
                        timeout: 200,
                    },
                ],
                predicate: {
                    conditions: [
                        {
                            logicalOperator: "EQUALS",
                            crawlerName: dynamoDBCrawlerName, 
                            crawlState: "SUCCEEDED"
                        },
                    ],
                    logical: "ANY",
                },
                type: "CONDITIONAL",
                startOnCreation: true,
            }
        );

        const glue_trigger_parquet_crawler = new glue.CfnTrigger(
            this, "glue-trigger-crawlJob-parquet",
            {
                name: "Run-Crawler-" + parquetCrawlerName,
                workflowName: glue_workflow.name,
                actions: [
                    {
                        crawlerName: parquetCrawlerName,
                    },
                ],
                predicate: {
                    conditions: [
                        {
                            logicalOperator: "EQUALS",
                            jobName: glueJoinJobName,
                            state: "SUCCEEDED"
                        },
                    ],
                    logical: "ANY",
                },
                type: "CONDITIONAL",
                startOnCreation: true,
            }
        );
        glue_trigger_joinJob.addDependency(glue_trigger_dynamodb_crawlJob);
        glue_trigger_parquet_crawler.addDependency(glue_trigger_joinJob);

        // Output name of join table glue workflow
        new CfnOutput(this, 'WorkflowName', {
            value: glue_workflow.name? glue_workflow.name : '',
            description: 'Name of glue join table workflow',
            exportName: 'WorkflowName',
        })
        // Output name of S3 parquet crawler
        new CfnOutput(this, 'ParquetTableCrawlerName', {
            value: parquetCrawlerName? parquetCrawlerName : '',
            description: 'Name of crawler that crawl the parquet joined table',
            exportName: 'ParquetTableCrawlerName',
        });
    }
};