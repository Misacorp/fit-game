import { decode } from "jsonwebtoken";
import axios from "axios";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { getGoogleSecrets } from "../common/getGoogleSecrets";

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION! });

export const handler = async (event: {
  queryStringParameters: { code?: string };
}) => {
  console.debug("event", event);
  const code = event.queryStringParameters?.code;
  if (!code) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Code is required" }),
    };
  }

  const tokenUrl = "https://oauth2.googleapis.com/token";

  const { clientId, clientSecret, redirectUri } = await getGoogleSecrets({
    clientIdSecretArn: process.env.GOOGLE_CLIENT_ID_SECRET_ARN,
    clientSecretSecretArn: process.env.GOOGLE_CLIENT_SECRET_SECRET_ARN,
    redirectUriSecretArn: process.env.GOOGLE_REDIRECT_URI_SECRET_ARN,
  });

  try {
    // Exchange authorization code for tokens
    const response = await axios.post(tokenUrl, {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const responseData = response.data;

    console.log(
      "Response data (contains sensitive data so please delete these logs",
      responseData,
    );

    const { access_token, refresh_token, expires_in, id_token } = responseData;

    // Decode the ID token to extract user information

    const decodedToken = decode(id_token);
    const userId = decodedToken?.sub; // The unique identifier for the user
    console.log("User ID:", userId, typeof userId);

    if (!userId || typeof userId !== "string") {
      // TODO: Write logic to return more detailed erroneous responses
      throw new Error("User ID not found in ID token");
    }

    // Save tokens in DynamoDB
    const params = new PutItemCommand({
      TableName: process.env.DYNAMO_TABLE_NAME!,
      Item: {
        userId: { S: userId },
        accessToken: { S: access_token },
        refreshToken: { S: refresh_token },
        expiresIn: { N: (Date.now() + expires_in * 1000).toString() },
        expiresAt: {
          N: (Math.floor(Date.now() / 1000) + expires_in).toString(), // TTL attribute (Unix timestamp in seconds)
        },
      },
    });

    console.log("Sending PutItemCommand to DynamoDB", params);

    const ddbWriteResponse = await dynamo.send(params);

    console.log("DynamoDB response", ddbWriteResponse);

    return {
      statusCode: 302,
      headers: {
        "Set-Cookie": `id_token=${id_token}; HttpOnly; Secure; SameSite=None`,
        Location: "https://localhost:3000/auth-success",
      },
    };
  } catch (error) {
    console.error("Error processing callback:", error);
    let errorUrl = "https://localhost:3000/auth-error"; // Redirect to error page

    if (error instanceof Error) {
      errorUrl = `${errorUrl}?error=${encodeURIComponent(error.message)}`;
    }

    return {
      statusCode: 302,
      headers: {
        Location: errorUrl,
      },
    };
  }
};
