import {
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerEvent,
} from "aws-lambda";
import * as cookie from "cookie";
import { OAuth2Client } from "google-auth-library";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { getGoogleSecrets } from "../common/getGoogleSecrets";

let cachedOAuth2Client: OAuth2Client;
let cachedClientId: string;

const getOAuth2Client = async () => {
  if (!cachedOAuth2Client) {
    const { clientId } = await getGoogleSecrets({
      clientIdSecretArn: process.env.GOOGLE_CLIENT_ID_SECRET_ARN,
      clientSecretSecretArn: process.env.GOOGLE_CLIENT_SECRET_SECRET_ARN,
      redirectUriSecretArn: process.env.GOOGLE_REDIRECT_URI_SECRET_ARN,
    });

    cachedClientId = clientId;
    cachedOAuth2Client = new OAuth2Client(clientId);
  }

  return cachedOAuth2Client;
};
const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });

// Verify the ID token using Google OAuth2Client
async function verifyIdToken(idToken: string) {
  const oauth2Client = await getOAuth2Client();

  const ticket = await oauth2Client.verifyIdToken({
    idToken,
    audience: cachedClientId,
  });
  return ticket.getPayload();
}

// Check user existence in DynamoDB
async function checkUserInDatabase(userId: string) {
  const command = new GetItemCommand({
    TableName: process.env.DYNAMO_TABLE_NAME!,
    Key: { userId: { S: userId } },
  });
  const response = await dynamo.send(command);
  return response.Item;
}

export const handler = async (
  event: APIGatewayRequestAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> => {
  try {
    // Extract and parse cookies
    const cookieHeader = event.headers?.Cookie || event.headers?.cookie;
    if (!cookieHeader) {
      throw new Error("Unauthorized: Missing Cookie header");
    }

    const cookies = cookie.parse(cookieHeader);
    const idToken = cookies.id_token; // Extract `id_token` cookie

    if (!idToken) {
      throw new Error("Unauthorized: Missing id_token cookie");
    }

    // Verify the token
    const payload = await verifyIdToken(idToken);
    const userId = payload?.sub;

    if (!userId) {
      throw new Error("Unauthorized: Invalid token payload");
    }

    // Check if user exists in the database
    const userExists = await checkUserInDatabase(userId);
    if (!userExists) {
      throw new Error("Unauthorized: User not found");
    }

    // Return IAM policy granting access
    return {
      principalId: userId,
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Action: "execute-api:Invoke",
            Effect: "Allow",
            Resource: event.methodArn,
          },
        ],
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      console.error("Authorization error:", error.message || error);
    }

    // Return IAM policy denying access
    return {
      principalId: "unauthorized",
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Action: "execute-api:Invoke",
            Effect: "Deny",
            Resource: event.methodArn,
          },
        ],
      },
    };
  }
};
