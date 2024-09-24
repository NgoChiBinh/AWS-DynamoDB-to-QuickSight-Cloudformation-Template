const { mockClient: awsMockClient } = require('aws-sdk-client-mock');
const { QuickSightClient: MockQuickSightClient, GenerateEmbedUrlForRegisteredUserCommand: MockGenerateEmbedUrlForRegisteredUserCommand } = require('@aws-sdk/client-quicksight');
const { generateDashboardUrl } = require('../../src/lambda-code/QSaccess/generateDashboardUrl');
const fetchUserRelatedInfo = require('../../src/lambda-code/QSaccess/fetchUserRelatedInfo');

jest.mock('../../src/lambda-code/QSaccess/fetchUserRelatedInfo');

describe('generateDashboardUrl', () => {
  const quicksightMock = awsMockClient(MockQuickSightClient);

  beforeEach(() => {
    quicksightMock.reset();
    jest.resetAllMocks();
  });

  it('should generate a QuickSight URL successfully', async () => {
    const mockUrl = 'https://quicksight.aws.amazon.com/mockUrl';
    fetchUserRelatedInfo.generateQuickSightURL.mockResolvedValue(mockUrl);

    const event = {
      headers: {
        authorization: 'Bearer validToken'
      }
    };

    const response = await generateDashboardUrl(event);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).embedUrl).toBe(mockUrl);
    expect(JSON.parse(response.body).message).toBe('Lambda execution successful!');
  });

  it('should return 401 if the Authorization header is missing', async () => {
    const event = {
      headers: {}
    };

    const response = await generateDashboardUrl(event);
    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body).message).toBe('Missing Authorization header');
  });

  it('should return 401 for an invalid Authorization header format', async () => {
    const event = {
      headers: {
        authorization: 'InvalidFormatToken'
      }
    };

    const response = await generateDashboardUrl(event);
    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body).message).toBe('Invalid Authorization header format');
  });

  it('should handle errors during QuickSight URL generation', async () => {
    const mockError = new Error('QuickSight error');
    fetchUserRelatedInfo.generateQuickSightURL.mockRejectedValue(mockError);

    const event = {
      headers: {
        authorization: 'Bearer validToken'
      }
    };

    const response = await generateDashboardUrl(event);
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).message).toBe(`Something went wrong: ${mockError.message}`);
  });
});
