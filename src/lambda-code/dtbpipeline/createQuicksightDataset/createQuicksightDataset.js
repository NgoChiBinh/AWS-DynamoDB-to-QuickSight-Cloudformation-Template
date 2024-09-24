const {
    CreateDataSourceCommand,
    CreateDataSetCommand,
    PutDataSetRefreshPropertiesCommand,
    QuickSightClient,
} = require('@aws-sdk/client-quicksight');
const {
    GetTableMetadataCommand,
    AthenaClient,
} = require('@aws-sdk/client-athena');

const { createQuickSightResource } = require('./helper/createResource')

const createDataSource = createQuickSightResource('DataSource', CreateDataSourceCommand);
const createDataSet = createQuickSightResource('Dataset', CreateDataSetCommand);

exports.createQuicksightDataset = async (event) => {

    // Environmental Variables
    const awsAccountId = process.env.AWS_ACC_ID;
    const region = process.env.REGION;
    const adminId = process.env.ADMIN_ID;
    // Datasource env variables
    const dataSourceId = process.env.DATASOURCE_ID;
    const dataSourceName = process.env.DATASOURCE_NAME;
    // Dataset env variables
    const datasetId = process.env.DATASET_ID;
    const datasetName = process.env.DATASET_NAME;
    const catalogName = process.env.CATALOG_NAME;
    const databaseName = process.env.DATABASE_NAME;
    const latest_partition_table_name = process.env.LATEST_PARTITION_TABLE_NAME;
    // RLS Dataset env variables
    const rls_datasetId = process.env.RLS_DATASET_ID;

    const quicksightClient = new QuickSightClient({ region: region});
    const athenaClient = new AthenaClient({ region: region });

    // Get schema of source Athena Table
    const command = new GetTableMetadataCommand({
        CatalogName: catalogName,
        DatabaseName: databaseName,
        TableName: latest_partition_table_name,
    });
    const res = await athenaClient.send(command);
    const datasetColumns = res.TableMetadata.Columns;

    // Create Dataset Columns based on source Athena Table's schema
    for (const item of datasetColumns) {
        if (item.Type.startsWith("decimal")) {
            item.Type = "DECIMAL"; 
            console.log(item);
        } else if (item.Type.startsWith("bigint")) {
            item.Type = "INTEGER";
        } else {  
            item.Type = item.Type.toUpperCase();  // Capitalize only if string type
        }
    };

    // Add aggregation columns not currently present in source Table schema
    datasetColumns.push(
        {
            Name: "total_emissions_marketbased",
            Type: "DECIMAL",
        },
        {
            Name: "total_emissions_locationbased",
            Type: "DECIMAL",
        }
    );

    // Create Datasource Params
    const createDataSourceParams = {
        AwsAccountId: awsAccountId,
        DataSourceId: dataSourceId,
        Name: dataSourceName,
        Type: 'ATHENA',
        DataSourceParameters: {
            AthenaParameters: {
                WorkGroup: 'primary'
            }
        },
        Permissions: [
            {
                Principal: `arn:aws:quicksight:${region}:${awsAccountId}:user/default/${adminId}`,
                Actions: [
                    'quicksight:CreateDataSource',
                    'quicksight:CreateDataset',
                    'quicksight:DescribeDataSource',
                    'quicksight:DescribeDataSet',
                    'quicksight:PassDataSource',
                    'quicksight:PassDataSet',
                    'quicksight:PutDataSetRefreshProperties',
                    'athena:GetTableMetadata',
                    'glue:GetTable'
                ]
            }
        ]
    };

    // Create RLS Dataset Params
    const createRLSDatasetParams = {
        AwsAccountId: awsAccountId,
        DataSetId: rls_datasetId,
        Name: 'Row Level Security Dataset',
        PhysicalTableMap: {
            'rowlevelsecurity-nuoa-physical-table': {
                RelationalTable: {
                    DataSourceArn: `arn:aws:quicksight:ap-southeast-1:203903977784:datasource/${dataSourceId}`,
                    Catalog: 'ddbconnector',
                    Schema: 'default',
                    Name: 'rowlevelsecurity_nuoa',
                    InputColumns: [
                        {
                            Name: "UserArn",
                            Type: "STRING"
                        },
                        {
                            Name: "tenantid",
                            Type: "STRING" 
                        },
                    ]
                }
            }
        },
        LogicalTableMap: {
            'rowlevelsecurity-nuoa-logical-table': {
                Alias: 'rowlevelsecurity_nuoa',
                DataTransforms: [
                    {
                        ProjectOperation: {
                            ProjectedColumns: [
                                'UserArn',
                                'tenantid'
                            ]
                        }
                    }
                ],
                Source: {
                    PhysicalTableId: 'rowlevelsecurity-nuoa-physical-table'
                }
            }
        }, 
        ImportMode: 'SPICE',
        Permissions: [
            {
                Principal: `arn:aws:quicksight:${region}:${awsAccountId}:user/default/${adminId}`,
                Actions: [
                "quicksight:DeleteDataSet",
                "quicksight:UpdateDataSetPermissions",
                "quicksight:PutDataSetRefreshProperties",
                "quicksight:CreateRefreshSchedule",
                "quicksight:CancelIngestion",
                "quicksight:UpdateRefreshSchedule",
                "quicksight:DeleteRefreshSchedule",
                "quicksight:PassDataSet",
                "quicksight:ListRefreshSchedules",
                "quicksight:DescribeDataSetRefreshProperties",
                "quicksight:DescribeDataSet",
                "quicksight:CreateIngestion",
                "quicksight:DescribeRefreshSchedule",
                "quicksight:ListIngestions",
                "quicksight:DescribeDataSetPermissions",
                "quicksight:UpdateDataSet",
                "quicksight:DeleteDataSetRefreshProperties",
                "quicksight:DescribeIngestion"
                ]
            }
        ]
    };

    // Create Dataset Params
    const createDatasetParams = {
        AwsAccountId: awsAccountId,
        DataSetId: datasetId,
        Name: datasetName,
        PhysicalTableMap: {
            'nuoa-data-physical-table': {
                CustomSql: {
                    SqlQuery: `
                    WITH RECURSIVE C(id, Amount_LocationBased, Amount_MarketBased, RootID, tenantid, percentage, level) AS (
                        SELECT
                            entityid AS id,
                            COALESCE(emissioninkgco2, emissioninkgco2_forlocationbased, 0) AS Amount_LocationBased,
                            COALESCE(emissioninkgco2, emissioninkgco2_formarketbased, 0) AS Amount_MarketBased,
                            entityid AS RootID,
                            tenantid,
                            parentcontributionpercentage AS percentage,
                            0 AS level
                        FROM ${catalogName}.${databaseName}.${latest_partition_table_name}

                        UNION ALL

                        SELECT 
                            T.parententityid AS id,
                            CAST((C.Amount_LocationBased * C.percentage) AS DECIMAL(20,10))  AS Amount_LocationBased,
                            CAST((C.Amount_MarketBased * C.percentage) AS DECIMAL(20,10)) AS Amount_MarketBased,
                            C.RootID,
                            C.tenantid,
                            C.percentage,
                            C.level + 1 AS level
                        FROM ${catalogName}.${databaseName}.${latest_partition_table_name} AS T
                        INNER JOIN C ON T.entityid = C.id AND T.tenantid = C.tenantid
                    )
                    SELECT 
                        T.*,
                        S.Cumulative_MarketBased AS total_emissions_marketbased,
                        S.Cumulative_LocationBased AS total_emissions_locationbased
                    FROM ${catalogName}.${databaseName}.${latest_partition_table_name} AS T
                    INNER JOIN (
                                SELECT 
                                    id, 
                                    SUM(Amount_LocationBased) AS Cumulative_LocationBased,
                                    SUM(Amount_MarketBased) AS Cumulative_MarketBased
                                FROM C
                                GROUP BY id
                                ) AS S ON T.entityId = S.id
                    ORDER BY T.entityId, T.parententityid
                    `,
                    DataSourceArn: `arn:aws:quicksight:ap-southeast-1:203903977784:datasource/${dataSourceId}`,
                    Name: datasetName,
                    Columns: datasetColumns 
                }
            }
        },
        LogicalTableMap: {
            'nuoa-data-logical-table': {
                Alias: 'Nuoa Logical Table',
                DataTransforms: [
                    {
                        CastColumnTypeOperation: {
                            ColumnName: "date",
                            NewColumnType: "DATETIME",
                            Format: "yyy/MM/dd"
                        }
                    },
                    {
                        TagColumnOperation: {
                            ColumnName: "country",
                            Tags: [
                                {
                                    ColumnGeographicRole: "COUNTRY"
                                }
                            ]
                        }
                    },
                    {
                        TagColumnOperation: {
                            ColumnName: "province",
                            Tags: [
                                {
                                    ColumnGeographicRole: "STATE"
                                }
                            ]
                        }
                    },
                ],
                Source: {
                    PhysicalTableId: 'nuoa-data-physical-table'
                }
            }
        },
        ImportMode: 'SPICE',
        RowLevelPermissionDataSet: {
            Arn: `arn:aws:quicksight:${region}:${awsAccountId}:dataset/${rls_datasetId}`,
            PermissionPolicy: "GRANT_ACCESS",
            FormatVersion: "VERSION_2",
            Status: "ENABLED",
        },
        Permissions: [
            {
                Principal: `arn:aws:quicksight:${region}:${awsAccountId}:user/default/${adminId}`,
                Actions: [
                "quicksight:DeleteDataSet",
                "quicksight:UpdateDataSetPermissions",
                "quicksight:PutDataSetRefreshProperties",
                "quicksight:CreateRefreshSchedule",
                "quicksight:CancelIngestion",
                "quicksight:UpdateRefreshSchedule",
                "quicksight:DeleteRefreshSchedule",
                "quicksight:PassDataSet",
                "quicksight:ListRefreshSchedules",
                "quicksight:DescribeDataSetRefreshProperties",
                "quicksight:DescribeDataSet",
                "quicksight:CreateIngestion",
                "quicksight:DescribeRefreshSchedule",
                "quicksight:ListIngestions",
                "quicksight:DescribeDataSetPermissions",
                "quicksight:UpdateDataSet",
                "quicksight:DeleteDataSetRefreshProperties",
                "quicksight:DescribeIngestion"
                ]
            }
        ]
    };

    const refreshConfigCommand = new PutDataSetRefreshPropertiesCommand({
        AwsAccountId: awsAccountId,
        DataSetId: datasetId,
        DataSetRefreshProperties: {
            RefreshConfiguration: {
                IncrementalRefresh: {
                    LookbackWindow: {
                        ColumnName: 'date',
                        Size: 1,
                        SizeUnit: "DAY",
                    },
                },
            },
        },
    });

    try {
        await createDataSource(createDataSourceParams);
        await createDataSet(createDatasetParams);
        await createDataSet(createRLSDatasetParams);
        await quicksightClient.send(refreshConfigCommand);
    } catch (error) {
        console.error('Error creating Quicksight Data Source/Dataset: ', error);
    }
}