import * as path from "path";
import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as secretsManager from "aws-cdk-lib/aws-secretsmanager";
import * as dynamoDb from "aws-cdk-lib/aws-dynamodb";
import * as apiGateway from "aws-cdk-lib/aws-apigateway";
import { Duration } from "aws-cdk-lib";

interface Props {
  googleClientIdSecret: secretsManager.Secret;
  googleClientSecretSecret: secretsManager.Secret;
  googleRedirectUriSecret: secretsManager.Secret;
  authTable: dynamoDb.Table;
}

export class CustomAuthorizerConstruct extends Construct {
  public authorizer: apiGateway.Authorizer;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const {
      googleClientIdSecret,
      googleClientSecretSecret,
      googleRedirectUriSecret,
      authTable,
    } = props;

    const apiAuthorizerLambda = new NodejsFunction(
      this,
      "ApiAuthorizerLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        architecture: lambda.Architecture.ARM_64,
        entry: path.join(__dirname, "../../src/protected/authorizer.ts"),
        handler: "handler",
        environment: {
          GOOGLE_CLIENT_ID_SECRET_ARN: googleClientIdSecret.secretArn,
          GOOGLE_CLIENT_SECRET_SECRET_ARN: googleClientSecretSecret.secretArn,
          GOOGLE_REDIRECT_URI_SECRET_ARN: googleRedirectUriSecret.secretArn, // TODO: Remove the need for this by making the google secret fetching modular
          DYNAMO_TABLE_NAME: authTable.tableName,
        },
      },
    );
    googleClientIdSecret.grantRead(apiAuthorizerLambda);
    googleClientSecretSecret.grantRead(apiAuthorizerLambda);
    googleRedirectUriSecret.grantRead(apiAuthorizerLambda);
    authTable.grantReadData(apiAuthorizerLambda);

    this.authorizer = new apiGateway.RequestAuthorizer(this, "APIAuthorizer", {
      handler: apiAuthorizerLambda,
      identitySources: [apiGateway.IdentitySource.header("Cookie")], // Inspect the Cookie header
      resultsCacheTtl: Duration.seconds(0), // TODO: Change this in prod
    });
  }
}
