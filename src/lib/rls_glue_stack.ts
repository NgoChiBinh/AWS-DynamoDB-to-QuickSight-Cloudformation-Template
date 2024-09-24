import {
    aws_glue as glue
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';

export class RLSGlueStack extends Stack {

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const rlsTableName = this.node.tryGetContext('rlsTableName');

        const database = new glue.CfnDatabase(this, 'rlsgluedatabase', {
            catalogId: this.account,
            databaseInput: {
                locationUri: 'dynamo-db-flag',
                name: rlsTableName.toLowerCase()
            },
        });

        const table = new glue.CfnTable(this, 'rlstable', {
            catalogId: this.account,
            databaseName: database.ref,
            tableInput: {
                name: rlsTableName.toLowerCase(),
                parameters: {
                    'location': '',
                    'classification': 'dynamodb',
                    'sourceTable' : rlsTableName,
                    'columnMapping' : 'userarn=UserArn'
                },
                storageDescriptor: {
                    columns:[
                        {
                            name: 'userarn',
                            type: 'STRING'
                        },
                        {
                            name: 'tenantid',
                            type: 'STRING'
                        },
                    ],
                },
            }
        });
        table.addDependency(database);

    }
}