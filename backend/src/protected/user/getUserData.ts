import { APIGatewayEvent } from "aws-lambda";

export const handler = async (event: APIGatewayEvent) => {
  console.log("Welcome, user. You are authorized.");

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "https://localhost:3000", // TODO: Update in prod
      "Access-Control-Allow-Credentials": true,
    },
    body: JSON.stringify({ message: "You are authorized" }),
  };
};
