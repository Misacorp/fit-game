import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { CustomAuthorizerConstruct } from "./constructs/CustomAuthorizerConstruct";
import { UserConstruct } from "./constructs/UserConstruct";

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const authTable = new dynamodb.Table(this, "AuthTable", {
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // TODO: Change to RETAIN for production
      timeToLiveAttribute: "expiresAt", // Specify TTL attribute
    });

    const googleClientIdSecret = new secretsmanager.Secret(
      this,
      "GoogleClientIdSecret",
      {
        secretName: "google-client-id",
        description: "Google Client ID for OAuth",
      },
    );

    const googleClientSecretSecret = new secretsmanager.Secret(
      this,
      "GoogleClientSecretSecret",
      {
        secretName: "google-client-secret",
        description: "Google Client Secret for OAuth",
      },
    );

    const googleRedirectUriSecret = new secretsmanager.Secret(
      this,
      "GoogleRedirectUriSecret",
      {
        secretName: "google-redirect-uri",
        description: "Google Redirect URI for OAuth",
      },
    );

    // Lambda for initiating OAuth flow
    const initiateAuthLambda = new NodejsFunction(this, "InitiateAuthLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(__dirname, "../src/auth/initiate-auth.ts"),
      handler: "handler",
      environment: {
        GOOGLE_CLIENT_ID_SECRET_ARN: googleClientIdSecret.secretArn,
        GOOGLE_CLIENT_SECRET_SECRET_ARN: googleClientSecretSecret.secretArn,
        GOOGLE_REDIRECT_URI_SECRET_ARN: googleRedirectUriSecret.secretArn,
      },
    });
    googleClientIdSecret.grantRead(initiateAuthLambda);
    googleClientSecretSecret.grantRead(initiateAuthLambda);
    googleRedirectUriSecret.grantRead(initiateAuthLambda);

    // Lambda for handling OAuth callback
    const handleCallbackLambda = new NodejsFunction(
      this,
      "HandleCallbackLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        architecture: lambda.Architecture.ARM_64,
        entry: path.join(__dirname, "../src/auth/auth-callback.ts"),
        handler: "handler",
        environment: {
          GOOGLE_CLIENT_ID_SECRET_ARN: googleClientIdSecret.secretArn,
          GOOGLE_CLIENT_SECRET_SECRET_ARN: googleClientSecretSecret.secretArn,
          GOOGLE_REDIRECT_URI_SECRET_ARN: googleRedirectUriSecret.secretArn,
          DYNAMO_TABLE_NAME: authTable.tableName,
        },
      },
    );
    googleClientIdSecret.grantRead(handleCallbackLambda);
    googleClientSecretSecret.grantRead(handleCallbackLambda);
    googleRedirectUriSecret.grantRead(handleCallbackLambda);
    authTable.grantWriteData(handleCallbackLambda);

    // Create API Gateway
    const api = new apigateway.RestApi(this, "AuthApi");

    const initiateAuthIntegration = new apigateway.LambdaIntegration(
      initiateAuthLambda,
    );
    const handleCallbackIntegration = new apigateway.LambdaIntegration(
      handleCallbackLambda,
    );

    api.root
      .addResource("initiate-auth")
      .addMethod("GET", initiateAuthIntegration);

    const callbackResource = api.root.addResource("handle-callback");
    callbackResource.addMethod("GET", handleCallbackIntegration);
    callbackResource.addCorsPreflight({
      allowOrigins: ["https://accounts.google.com", "https://localhost:3000"],
      allowMethods: ["GET"],
      allowHeaders: ["*"],
    });

    // Create a custom authorizer for protected routes
    const authorizerConstruct = new CustomAuthorizerConstruct(
      this,
      "ApiAuthorizer",
      {
        authTable,
        googleClientIdSecret,
        googleClientSecretSecret,
        googleRedirectUriSecret,
      },
    );

    // Create user routes
    new UserConstruct(this, "UserConstruct", {
      api,
      googleClientIdSecret,
      googleClientSecretSecret,
      authTable,
      authorizer: authorizerConstruct.authorizer,
    });
  }
}
