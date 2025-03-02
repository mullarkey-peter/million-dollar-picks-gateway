# Apollo Federation Gateway

## Overview

This Apollo Gateway service acts as a federation layer for the Million Dollar Picks microservices architecture. It combines the GraphQL APIs from the auth-service and user-service into a unified schema, allowing clients to interact with a single endpoint.

The gateway implements a `/register` route that creates both a user and credentials in a single operation, returning user information along with an authentication token.

## Architecture

The system follows a microservices architecture pattern with:

1. **Apollo Gateway** - Federation layer that combines GraphQL APIs
2. **Auth Service** - Handles authentication, credentials, and token generation
3. **User Service** - Manages user profiles and information
4. **PostgreSQL Databases** - Separate databases for each service

## Gateway Features

- Federation of auth-service and user-service GraphQL APIs
- Custom resolver for user registration that coordinates between services
- Authentication token generation and validation
- Error handling and logging

## Registration Flow

The registration process follows these steps:

1. Client sends registration request with username and password
2. Gateway creates user in user-service
3. Gateway creates credentials in auth-service
4. Gateway gets authentication token from auth-service
5. Gateway returns combined response with user data and token

## Setup & Installation

### Prerequisites

- Node.js 16+
- Docker and Docker Compose
- User Service and Auth Service running

### Running with Docker

```bash
# Start all services with Docker Compose
docker-compose up -d
```

The Apollo Gateway will be available at:
- GraphQL Endpoint: http://localhost:4000/graphql

### Running Locally without Docker

```bash
# Install dependencies
npm install

# Start the service
npm start
```

## API Usage

### Registration

```graphql
mutation {
  register(username: "newuser", password: "securepassword") {
    user {
      id
      username
      registrationDate
    }
    token
    success
    message
  }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| USER_SERVICE_URL | URL for the user service GraphQL endpoint | http://user-service:8080/graphql |
| AUTH_SERVICE_URL | URL for the auth service GraphQL endpoint | http://auth-service:8080/graphql |

## Project Structure

```
apollo-gateway/
├── .gitignore            # Git ignore file
├── Dockerfile            # Docker configuration
├── docker-compose.yml    # Docker Compose configuration
├── index.js              # Main gateway implementation
├── package.json          # NPM package configuration
└── README.md             # Documentation
```

## UML Diagram

```
+-------------------+      +-------------------+
|  Apollo Gateway   |----->|   Auth Service    |
+-------------------+      +-------------------+
         |                         |
         |                         |
         v                         v
+-------------------+      +-------------------+
|   User Service    |      |   Auth Database   |
+-------------------+      +-------------------+
         |
         |
         v
+-------------------+
|  User Database    |
+-------------------+
```

## Development

### Extending the Gateway

To add new federated queries or mutations:

1. Add the type definition to the supergraphSdl
2. Implement a custom resolver in the resolvers function
3. Add any necessary service proxy methods

## Troubleshooting

### Common Issues

- **Connection refused**: Ensure all services are running and accessible
- **Schema composition errors**: Check compatibility between service schemas
- **Authentication failures**: Verify token generation and validation