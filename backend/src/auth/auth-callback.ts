import axios from "axios";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION! });

export const handler = async (event: { code: string }) => {
  const code = event.code;
  if (!code) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Code is required" }),
    };
  }

  const tokenUrl = "https://oauth2.googleapis.com/token";
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;

  try {
    // Exchange authorization code for tokens
    const response = await axios.post(tokenUrl, {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const { access_token, refresh_token, expires_in } = response.data;

    // Save tokens in DynamoDB
    const userId = "example-user-id"; // TODO: Replace with actual user identification logic
    const params = new PutItemCommand({
      TableName: process.env.DYNAMO_TABLE_NAME!,
      Item: {
        userId: { S: userId },
        accessToken: { S: access_token },
        refreshToken: { S: refresh_token },
        expiresIn: { N: (Date.now() + expires_in * 1000).toString() },
      },
    });

    await dynamo.send(params);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Authorization successful" }),
    };
  } catch (error) {
    console.error("Error exchanging code or storing tokens:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to process authorization callback",
      }),
    };
  }
};
