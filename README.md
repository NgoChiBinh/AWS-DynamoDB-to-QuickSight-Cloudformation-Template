# Nuoa Carbon Inventory Dashboard

## Overview
The Nuoa Carbon Inventory Dashboard is a platform designed to monitor, manage, and report carbon emissions data. This project utilizes AWS Cloud Development Kit (CDK) v3 to deploy and manage infrastructure as code.

## Project Goals
- **Design Customizable Dashboards**: Create intuitive and flexible dashboards that cater to different user needs.
- **Automate Processes**: Streamline and automate every process including:
  - Onboarding new clients
  - Returning customizable Amazon QuickSight dashboards
  - Automating the database update pipeline

## Team Members
- Nguyen Hoang To Nhu   - Backend Developer
- Vu Bui Khanh Linh     - Backend Developer
- Binh                  - Backend Developer
- Duy                   - Frontend Developer

## Features
- **Real-time Data Tracking**: Continuously monitor carbon emissions data.
- **Customizable Dashboards**: Create and manage personalized dashboards for different user roles.
- **Automated Client Onboarding**: Seamless and automated process for onboarding new clients.
- **Scalable Infrastructure**: Leverage AWS services for a scalable and secure deployment.

## Technologies Used
- **AWS CDK v3**: Infrastructure as Code for deploying AWS resources.
- **AWS Lambda**: Serverless compute service.
- **Amazon RDS**: Relational Database Service for data storage.
- **Amazon S3**: Scalable storage for storing dashboard assets and data.
- **Amazon QuickSight**: Business intelligence service for creating customizable dashboards.
- **Amazon Kinesis**: Real-time data streaming service.
- **Amazon DynamoDB**: NoSQL database service.
- **AWS Glue**: Managed ETL (extract, transform, load) service.
- **Amazon Athena**: Interactive query service for data analysis.
- **Amazon Cognito**: User sign-up, sign-in, and access control.
- **Amazon API Gateway**: Managed service for creating, publishing, maintaining, monitoring, and securing APIs.
- **React.js**: Frontend library for building the user interface.

## Deployment
To deploy the Nuoa Carbon Inventory Dashboard, follow these steps:

1. Clone the repository:
    ```bash
    git clone https://github.com/COOKIES200-Nuoa/cookies200_backend.git
    cd cookies200_backend
    ```

2. Install the dependencies:
    ```bash
    npm install
    ```

3. Synthesize the AWS CDK stack:
    ```bash
    cdk synth
    ```

4. Deploy the stack to your AWS account:
    ```bash
    cdk deploy
    ```

## Usage
1. Access the deployed dashboard via the provided AWS CloudFront URL.
2. Log in with credentials.

