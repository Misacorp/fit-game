A game that integrats with Google Fit as a source of currency. The idea is to encourage users to move and acquire _Heart Points_ in a non-competitive and encouraging manner.

# Google Fit Integration

```mermaid
sequenceDiagram
    participant User as User
    participant Frontend as Web App (Frontend)
    participant Backend as Backend (API Gateway & Lambda)
    participant Google as Google Fit API

    User->>Frontend: Open app and click "Authorize"
    Frontend->>Google: Redirect to Google OAuth URL (Scopes for Fitness API)
    Google-->>User: Prompt for Login and Consent
    User-->>Google: Grant Authorization
    Google-->>Frontend: Redirect to Callback URL with Auth Code
    Frontend->>Backend: Send Auth Code to Backend
    Backend->>Google: Exchange Auth Code for Access and Refresh Tokens
    Google-->>Backend: Return Access and Refresh Tokens
    Backend->>DynamoDB: Store Tokens and User Info
    Backend-->>Frontend: Authorization Successful Response
    Frontend-->>User: Display Success Message or Proceed to App
```