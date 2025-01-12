import { APIGatewayEvent } from "aws-lambda";

export const handler = async (_event: APIGatewayEvent) => {
  const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;
  const scope = "https://www.googleapis.com/auth/fitness.activity.read";
  const state = "random-state"; // TODO: Replace with a securely generated state if needed.

  // Generate OAuth URL
  const authUrl = `${GOOGLE_AUTH_URL}?response_type=code&client_id=${encodeURIComponent(
    clientId,
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(
    scope,
  )}&state=${state}`;

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authUrl }),
  };
};
