import { mockClient } from 'aws-sdk-client-mock';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand
} from '@aws-sdk/client-cognito-identity-provider';

const { authenticateUserAndFetchToken } = require('../../src/lambda-code/auth/authenticateUserAndFetchToken');

describe('authenticateUserAndFetchToken', () => {
  const cognitoMock = mockClient(CognitoIdentityProviderClient);
  const mockEvent = {
    body: JSON.stringify({ 
      username: 'testuser',
      password: 'testpassword',
      newPassword: 'newpassword'
    })
  };

  beforeEach(() => {
    cognitoMock.reset();
  });

  it('should authenticate the user successfully', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves({
      AuthenticationResult: {
        AccessToken: 'mockAccessToken',
        IdToken: 'mockIdToken',
        RefreshToken: 'mockRefreshToken'
      }
    });

    const response = await authenticateUserAndFetchToken(mockEvent);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe('Authentication successful!');
    expect(JSON.parse(response.body).tokens).toEqual({
      AccessToken: 'mockAccessToken',
      IdToken: 'mockIdToken',
      RefreshToken: 'mockRefreshToken'
    });
  });

  it('should return new password required challenge', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves({
      ChallengeName: 'NEW_PASSWORD_REQUIRED',
      Session: 'mockSession'
    });

    const response = await authenticateUserAndFetchToken({
      body: JSON.stringify({ username: 'testuser', password: 'testpassword' })
    });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toBe('New password required.');
    expect(JSON.parse(response.body).challengeName).toBe('NEW_PASSWORD_REQUIRED');
  });

  it('should handle errors during authentication', async () => {
    const mockError = new Error('Authentication error');

    cognitoMock.on(InitiateAuthCommand).rejects(mockError);

    const response = await authenticateUserAndFetchToken(mockEvent);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toBe('Authentication failed');
    expect(JSON.parse(response.body).error).toBe(mockError.message);
  });

  it('should handle password change successfully', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves({
      ChallengeName: 'NEW_PASSWORD_REQUIRED',
      Session: 'mockSession'
    });

    cognitoMock.on(RespondToAuthChallengeCommand).resolves({
      AuthenticationResult: {
        AccessToken: 'mockAccessToken',
        IdToken: 'mockIdToken',
        RefreshToken: 'mockRefreshToken'
      }
    });

    const response = await authenticateUserAndFetchToken(mockEvent);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe('Password changed successfully!');
    expect(JSON.parse(response.body).tokens).toEqual({
      AccessToken: 'mockAccessToken',
      IdToken: 'mockIdToken',
      RefreshToken: 'mockRefreshToken'
    });
  });
});
