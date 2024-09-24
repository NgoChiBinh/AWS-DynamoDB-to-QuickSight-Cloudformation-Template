import sys
import logging
from datetime import datetime
import re
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job
from awsglue.dynamicframe import DynamicFrame
from pyspark.sql.types import StructType, StringType, DoubleType, LongType
from pyspark.sql import functions as F

# Initialize Glue context and job
args = getResolvedOptions(sys.argv, ['JOB_NAME', 'output_path', 'activity_table', 'entity_table'])
sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args['JOB_NAME'], args)

logger = logging.getLogger()
logger.setLevel(logging.DEBUG)

# Current date in YYYY-MM-DD format
current_date = datetime.now().strftime("%Y-%m-%d")

# Read data from Glue Data Catalog
activity_table = glueContext.create_dynamic_frame.from_catalog(
    database="dynamodb_db", 
    table_name=args['activity_table'], 
    transformation_ctx="activity_table"
)

entity_table = glueContext.create_dynamic_frame.from_catalog(
    database="dynamodb_db", 
    table_name=args['entity_table'],  
    transformation_ctx="entity_table"
)

# Function to flatten nested fields and handle dynamic field names
def flatten_data_field(dynamic_frame, root_field_name="data"):
    df = dynamic_frame.toDF()
    
    # Extract and flatten all fields inside the 'data' object
    data_fields = df.select(F.col(f"{root_field_name}.*")).schema.fields
    for field in data_fields:
        col_name = field.name
        # Add flattened fields to the root level, rename camelCase to snake_case
        df = df.withColumn(col_name.lower(), F.col(f"{root_field_name}.{col_name}"))
    
    # Drop the original 'data' column
    df = df.drop(root_field_name)
    
    return df
    
def extract_double_from_struct(df, column_name):
    return df.withColumn(column_name, F.col(f"{column_name}.double"))

# Apply the flattening function to the activity table
activity_table_flattened = flatten_data_field(activity_table)

# Handle the struct fields for emissionInKgCO2 and similar columns
activity_table_flattened = extract_double_from_struct(activity_table_flattened, 'emissionInKgCO2')
activity_table_flattened = extract_double_from_struct(activity_table_flattened, 'emissionInKgCO2_ForLocationBased')
activity_table_flattened = extract_double_from_struct(activity_table_flattened, 'emissionInKgCO2_ForMarketBased')

#DEBUG
activity_table_flattened.printSchema()

# Convert back to DynamicFrame for further transformations in Glue
activity_table_flattened_dynamic = DynamicFrame.fromDF(activity_table_flattened, glueContext, "activity_table_flattened")

# Static mappings for activity
static_mappings = [
    ('tenantactivitykey', 'string', 'tenantactivitykey', 'string'),
    ('activityid', 'string', 'activityid', 'string'),
    ('emissioninkgco2', 'double', 'emissioninkgco2', 'decimal(20,10)'),
    ('emissioninkgco2_forlocationbased', 'double', 'emissioninkgco2_forlocationbased', 'decimal(20,10)'),
    ('emissioninkgco2_formarketbased', 'double', 'emissioninkgco2_formarketbased', 'decimal(20,10)'),
    ('entityid', 'string', 'entityid', 'string'),
    ('formid', 'string', 'formid', 'string'),
    ('tenantid', 'string', 'tenantid', 'string'),
    ('versionid', 'int', 'versionid', 'int')
]

# Dynamic mappings (excluding the static fields)
dynamic_mappings = [(col.lower(), 'string', col.lower(), 'string') for col in activity_table_flattened.columns if col.lower() not in ["tenantactivitykey", "activityid", "emissioninkgco2", "emissioninkgco2_forlocationbased", "emissioninkgco2_formarketbased", "entityid", "formid", "tenantid", "versionid"]]

# Combine static and dynamic mappings
activity_table_mappings = static_mappings + dynamic_mappings

# Flatten and apply mappings to the activity table
activity_table_flattened_mapped = activity_table_flattened_dynamic.apply_mapping(
    activity_table_mappings,
    transformation_ctx="activity_table_flattened_mapped"
)

# Static mappings for entity table 
entity_table_flattened = entity_table.apply_mapping([
    ('tenantentitykey', 'string', 'tenantentitykey', 'string'),
    ('entityid', 'string', 'entity_id', 'string'),
    ('tenantid', 'string', 'tenant_id', 'string'),
    ('data.baseline', 'string', 'baseline', 'string'),
    ('data.code', 'string', 'code', 'string'),
    ('data.consolidateApproach', 'string', 'consolidateapproach', 'string'),
    ('data.country', 'string', 'country', 'string'),
    ('data.industry', 'string', 'industry', 'string'),
    ('data.manager', 'string', 'manager', 'string'),
    ('data.operatingType', 'string', 'operatingtype', 'string'),
    ('data.ownershipConsolidatePercentage', 'string', 'ownershipconsolidatepercentage', 'string'),
    ('data.ownershipPercentage', 'string', 'ownershippercentage', 'string'),
    ('data.province', 'string', 'province', 'string'),
    ('name', 'string', 'name', 'string'),
    ('parentcontributionpercentage', 'double', 'parentcontributionpercentage', 'decimal'),
    ('parententityid', 'string', 'parententityid', 'string')
], transformation_ctx="entity_table_flattened")

# Perform the join on 'entityid' and 'tenantid' field
joined_data = activity_table_flattened_mapped.join(
    paths1=["entityid", "tenantid"], 
    paths2=["entity_id", "tenant_id"], 
    frame2=entity_table_flattened, 
    transformation_ctx="joined_data"
).drop_fields(["entity_id", "tenant_id"])

# Output path with date
output_path = args['output_path'] + f"{current_date}/"

# Write the result as a parquet file to the output path
parquetData = glueContext.write_dynamic_frame.from_options(
    frame=joined_data,
    connection_type="s3",
    connection_options={"path": output_path},
    format="parquet",
    transformation_ctx="parquetData"
)

job.commit()