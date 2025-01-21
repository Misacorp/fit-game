import { google } from "googleapis";
import { APIGatewayEvent } from "aws-lambda";
import { getGoogleSecrets } from "../common/getGoogleSecrets";

export const handler = async (_event: APIGatewayEvent) => {
  const { clientId, clientSecret, redirectUri } = await getGoogleSecrets({
    clientIdSecretArn: process.env.GOOGLE_CLIENT_ID_SECRET_ARN,
    clientSecretSecretArn: process.env.GOOGLE_CLIENT_SECRET_SECRET_ARN,
    redirectUriSecretArn: process.env.GOOGLE_REDIRECT_URI_SECRET_ARN,
  });

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri,
  );

  const scopes = [
    "openid",
    "https://www.googleapis.com/auth/fitness.activity.read",
  ];

  const url = oauth2Client.generateAuthUrl({
    scope: scopes,
    access_type: "offline",
    prompt: "consent",
  });

  console.log("Generated auth url", url);

  return {
    statusCode: 302,
    headers: {
      Location: url,
    },
  };
};
