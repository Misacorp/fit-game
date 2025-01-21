import * as path from "path";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamoDb from "aws-cdk-lib/aws-dynamodb";
import * as secretsManager from "aws-cdk-lib/aws-secretsmanager";
import * as apiGateway from "aws-cdk-lib/aws-apigateway";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

interface Props {
  googleClientIdSecret: secretsManager.Secret;
  googleClientSecretSecret: secretsManager.Secret;
  authTable: dynamoDb.Table;
  api: apiGateway.RestApi;
  authorizer: apiGateway.Authorizer;
}

export class UserConstruct extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const {
      googleClientIdSecret,
      googleClientSecretSecret,
      authTable,
      api,
      authorizer,
    } = props;

    // Lambda for handling User Data retrieval
    const getUserDataLambda = new NodejsFunction(this, "GetUserDataLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(__dirname, "../../src/protected/user/getUserData.ts"),
      handler: "handler",
      environment: {
        GOOGLE_CLIENT_ID_SECRET_ARN: googleClientIdSecret.secretArn,
        GOOGLE_CLIENT_SECRET_SECRET_ARN: googleClientSecretSecret.secretArn,
        DYNAMO_TABLE_NAME: authTable.tableName,
      },
    });
    googleClientIdSecret.grantRead(getUserDataLambda);
    googleClientSecretSecret.grantRead(getUserDataLambda);
    authTable.grantReadWriteData(getUserDataLambda);

    // Add a resource to the API that forwards GET requests to getUserDataLambda
    const userResource = api.root.addResource("user");

    userResource.addCorsPreflight({
      allowOrigins: ["https://localhost:3000"],
      allowMethods: ["GET"],
      allowHeaders: ["*"],
      allowCredentials: true, // Enable credentials (cookies)
    });

    userResource.addMethod(
      "GET",
      new apiGateway.LambdaIntegration(getUserDataLambda),
      {
        authorizationType: apiGateway.AuthorizationType.CUSTOM,
        authorizer,
      },
    );

    // TODO: Should probably be moved to where api is initialized?
    api.addGatewayResponse("Default4xx", {
      type: apiGateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        "Access-Control-Allow-Origin": "'https://localhost:3000'",
        "Access-Control-Allow-Headers":
          "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      },
    });
  }
}
