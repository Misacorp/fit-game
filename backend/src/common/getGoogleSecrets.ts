import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

type SecretArns = {
  clientIdSecretArn: string | undefined;
  redirectUriSecretArn: string | undefined;
  clientSecretSecretArn: string | undefined;
};

type Secrets = {
  clientId: string;
  redirectUri: string;
  clientSecret: string;
};

const secretsManagerClient = new SecretsManagerClient({});

let cachedClientId: string | undefined;
let cachedRedirectUri: string | undefined;
let cachedClientSecret: string | undefined;

/**
 * Asynchronously retrieves secrets from AWS Secrets Manager based on the given ARNs.
 *
 * @param {Object} params - An object containing the ARNs of the secrets to retrieve.
 * @param {string} params.clientIdSecretArn - The ARN of the secret containing the client ID.
 * @param {string} params.redirectUriSecretArn - The ARN of the secret containing the redirect URI.
 * @param {string} params.clientSecretSecretArn - The ARN of the secret containing the client secret.
 * @returns {Promise<Secrets>} A promise that resolves to an object containing the `clientId`, `redirectUri`, and `clientSecret` secrets as strings.
 * @throws {Error} If any of the required secret ARNs are not provided, or if the secret values cannot be retrieved.
 */
export const getGoogleSecrets = async ({
  clientIdSecretArn,
  redirectUriSecretArn,
  clientSecretSecretArn,
}: SecretArns): Promise<Secrets> => {
  // Fetch values if they don't exist
  if (!(cachedRedirectUri && cachedClientId && cachedClientSecret)) {
    // Ensure environment variables are set
    if (!clientIdSecretArn || !redirectUriSecretArn || !clientSecretSecretArn) {
      throw new Error("Secret ARNs must be provided.");
    }

    const fetchSecret = async (secretArn: string): Promise<string> => {
      const command = new GetSecretValueCommand({ SecretId: secretArn });
      const response = await secretsManagerClient.send(command);

      if (!response.SecretString) {
        throw new Error(`Secret at ARN ${secretArn} does not contain a value.`);
      }

      return response.SecretString;
    };

    const [fetchedClientId, fetchedRedirectUri, fetchedClientSecret] =
      await Promise.all([
        fetchSecret(clientIdSecretArn),
        fetchSecret(redirectUriSecretArn),
        fetchSecret(clientSecretSecretArn),
      ]);

    // Save the values for later
    cachedClientId = fetchedClientId;
    cachedRedirectUri = fetchedRedirectUri;
    cachedClientSecret = fetchedClientSecret;
  }

  return {
    clientId: cachedClientId,
    redirectUri: cachedRedirectUri,
    clientSecret: cachedClientSecret,
  };
};
