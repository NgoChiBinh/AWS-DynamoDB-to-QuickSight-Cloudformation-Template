const jwt = require('jsonwebtoken');
const { mockClient } = require('aws-sdk-client-mock');
const { QuickSightClient, DescribeUserCommand, GenerateEmbedUrlForRegisteredUserCommand } = require('@aws-sdk/client-quicksight');
const {
  getCognitoUserGroups,
  getUserRole,
  generateQuickSightURL
} = require('../../src/lambda-code/QSaccess/fetchUserRelatedInfo');

// Mock the QuickSightClient
const quicksightMock = mockClient(QuickSightClient);

describe('fetchUserRelatedInfo', () => {
  const validToken = jwt.sign({ 'cognito:groups': ['testGroup'] }, 'secret');
  const invalidToken = 'invalidToken';

  beforeEach(() => {
    quicksightMock.reset();
    jest.clearAllMocks();
  });

  describe('getCognitoUserGroups', () => {
    it('should return the user group from a valid token', () => {
      const group = getCognitoUserGroups(validToken);
      expect(group).toBe('testGroup');
    });

    it('should throw an error for an invalid token', () => {
      expect(() => getCognitoUserGroups(invalidToken)).toThrow('Invalid token');
    });

    it('should throw an error if no groups are found in the token', () => {
      const tokenWithoutGroups = jwt.sign({}, 'secret');
      expect(() => getCognitoUserGroups(tokenWithoutGroups)).toThrow('No group found in the access token');
    });
  });

  describe('getUserRole', () => {
    it('should return the user role (READER or AUTHOR) from QuickSight', async () => {
      quicksightMock.on(DescribeUserCommand).resolves({
        User: {
          Role: 'READER'
        }
      });

      const role = await getUserRole(validToken);
      expect(role).toBe('READER');
    });

    it('should throw an error if QuickSight DescribeUser fails', async () => {
      quicksightMock.on(DescribeUserCommand).rejects(new Error('DescribeUser error'));

      await expect(getUserRole(validToken)).rejects.toThrow('DescribeUser error');
    });
  });

  describe('generateQuickSightURL', () => {
    it('should generate a QuickSight URL based on user role', async () => {
      quicksightMock.on(DescribeUserCommand).resolves({
        User: {
          Role: 'READER'
        }
      });

      const mockUrl = 'https://quicksight.aws.amazon.com/mockUrl';
      quicksightMock.on(GenerateEmbedUrlForRegisteredUserCommand).resolves({
        EmbedUrl: mockUrl
      });

      const url = await generateQuickSightURL(validToken);
      expect(url).toBe(mockUrl);
    });

    it('should throw an error if QuickSight GenerateEmbedUrl fails', async () => {
      quicksightMock.on(DescribeUserCommand).resolves({
        User: {
          Role: 'READER'
        }
      });

      quicksightMock.on(GenerateEmbedUrlForRegisteredUserCommand).rejects(new Error('GenerateEmbedUrl error'));

      await expect(generateQuickSightURL(validToken)).rejects.toThrow('GenerateEmbedUrl error');
    });
  });
});
