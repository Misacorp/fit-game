import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

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

    // Lambda for initiating OAuth flow
    const initiateAuthLambda = new NodejsFunction(this, "InitiateAuthLambda", {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(__dirname, "../src/auth/initiate-auth.ts"),
      handler: "handler",
      environment: {
        GOOGLE_CLIENT_ID: "your-google-client-id",
        GOOGLE_REDIRECT_URI: "your-redirect-uri",
      },
    });

    // Lambda for handling OAuth callback
    const handleCallbackLambda = new NodejsFunction(
      this,
      "HandleCallbackLambda",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        entry: path.join(__dirname, "../src/auth/auth-callback.ts"),
        handler: "handler",
        environment: {
          GOOGLE_CLIENT_ID: "your-google-client-id",
          GOOGLE_CLIENT_SECRET: "your-google-client-secret",
          DYNAMO_TABLE_NAME: authTable.tableName,
        },
      },
    );

    // Grant permissions to the callback Lambda to write to DynamoDB
    authTable.grantWriteData(handleCallbackLambda);

    // Create API Gateway
    const api = new apigateway.RestApi(this, "AuthApi");

    // Define a request model for validation
    const authCodeRequestModel = api.addModel("AuthCodeRequestModel", {
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        title: "AuthCodeRequest",
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          code: { type: apigateway.JsonSchemaType.STRING },
        },
        required: ["code"],
      },
      contentType: "application/json",
    });

    // Add request validator for the callback endpoint
    const requestValidator = api.addRequestValidator("RequestValidator", {
      validateRequestBody: true,
      validateRequestParameters: false,
    });

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
    callbackResource.addMethod(
      "POST", // Change to POST since it expects a request body
      handleCallbackIntegration,
      {
        requestValidator,
        requestModels: {
          "application/json": authCodeRequestModel,
        },
      },
    );
  }
}
