const { CognitoIdentityProviderClient, GlobalSignOutCommand } = require("@aws-sdk/client-cognito-identity-provider");
const { handler } = require("../../src/lambda-code/auth/logout");

jest.mock("@aws-sdk/client-cognito-identity-provider");

describe("Logout Handler", () => {
  const mockSend = jest.fn();
  const clientMock = {
    send: mockSend,
  };

  beforeEach(() => {
    CognitoIdentityProviderClient.mockImplementation(() => clientMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 if accessToken is missing", async () => {
    const event = {
      body: JSON.stringify({}),
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toBe("Access token is required");
  });

  it("should return 200 if logout is successful", async () => {
    mockSend.mockResolvedValueOnce({});

    const event = {
      body: JSON.stringify({ accessToken: "validAccessToken" }),
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe("Logout successful");
    expect(mockSend).toHaveBeenCalledWith(expect.any(GlobalSignOutCommand));
  });

  it("should return 500 if logout fails", async () => {
    mockSend.mockRejectedValueOnce(new Error("Logout failed"));

    const event = {
      body: JSON.stringify({ accessToken: "validAccessToken" }),
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).message).toBe("Logout failed");
  });
});
