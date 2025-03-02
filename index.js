const { ApolloServer } = require('@apollo/server');
const { ApolloGateway, IntrospectAndCompose } = require('@apollo/gateway');
const { startStandaloneServer } = require('@apollo/server/standalone');
const { parse } = require('graphql');

const supergraphSdl = `
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.0",
          import: ["@key", "@shareable"])

  type Mutation {
    register(username: String!, password: String!): RegisterResponse
  }

  type RegisterResponse {
    user: User!
    token: String!
    success: Boolean!
    message: String
  }
`;

async function startApolloGateway() {
    // Configure the gateway to use introspection to discover the schemas
    const gateway = new ApolloGateway({
        supergraphSdl,
        buildService({ url }) {
            return { url };
        },
        // Service configuration for our microservices
        serviceList: [
            { name: 'users', url: 'http://user-service:8080/graphql' },
            { name: 'auth', url: 'http://auth-service:8080/graphql' }
        ],
        introspectionHeaders: {
            // Optional headers for services that might require authentication for introspection
            // 'Authorization': 'Bearer token',
        },
        // Implement custom resolvers for the gateway
        async resolvers({ parentType, fieldName }) {
            // Register resolver that coordinates between auth and user services
            if (parentType === 'Mutation' && fieldName === 'register') {
                return async (parent, args, context, info) => {
                    try {
                        // Step 1: Create the user in the user service
                        const userResult = await context.userService.createOrUpdateUser(args.username);

                        if (!userResult || !userResult.id) {
                            return {
                                success: false,
                                message: 'Failed to create user'
                            };
                        }

                        // Step 2: Create credentials in the auth service
                        const credentialsResult = await context.authService.createCredentials({
                            username: args.username,
                            password: args.password,
                            userId: userResult.id
                        });

                        if (!credentialsResult || !credentialsResult.id) {
                            return {
                                success: false,
                                message: 'Failed to create credentials'
                            };
                        }

                        // Step 3: Login to get a token
                        const authResponse = await context.authService.login({
                            username: args.username,
                            password: args.password
                        });

                        // Step 4: Return the combined result
                        return {
                            user: userResult,
                            token: authResponse.token,
                            success: true,
                            message: 'Registration successful'
                        };
                    } catch (error) {
                        console.error('Registration error:', error);
                        return {
                            success: false,
                            message: `Registration failed: ${error.message}`
                        };
                    }
                };
            }

            return null;
        }
    });

    // Initialize the ApolloServer with the gateway
    const server = new ApolloServer({
        gateway,
        subscriptions: false,
        context: async ({ req }) => {
            // Create service proxies for direct calling in custom resolvers
            const authServiceProxy = createServiceProxy('http://auth-service:8080/graphql');
            const userServiceProxy = createServiceProxy('http://user-service:8080/graphql');

            return {
                authService: authServiceProxy,
                userService: userServiceProxy,
                headers: req.headers
            };
        }
    });

    // Start the server
    const { url } = await startStandaloneServer(server, {
        listen: { port: 4000 }
    });

    console.log(`🚀 Apollo Gateway ready at ${url}`);
}

// Helper function to create service proxies
function createServiceProxy(serviceUrl) {
    return {
        async createOrUpdateUser(username) {
            // Implementation for user service calls
            const query = `
        mutation {
          createOrUpdateUser(username: "${username}") {
            id
            username
            registrationDate
          }
        }
      `;

            const response = await fetch(serviceUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            const result = await response.json();
            return result.data?.createOrUpdateUser;
        },

        async createCredentials({ username, password, userId }) {
            // Implementation for auth service credential creation
            const query = `
        mutation {
          createCredentials(username: "${username}", password: "${password}", userId: "${userId}") {
            id
            username
            userId
          }
        }
      `;

            const response = await fetch(serviceUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            const result = await response.json();
            return result.data?.createCredentials;
        },

        async login({ username, password }) {
            // Implementation for auth service login
            const query = `
        mutation {
          login(username: "${username}", password: "${password}") {
            token
            userId
            username
            success
            message
          }
        }
      `;

            const response = await fetch(serviceUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            const result = await response.json();
            return result.data?.login;
        }
    };
}

// Start the gateway
startApolloGateway().catch(error => {
    console.error('Failed to start Apollo Gateway:', error);
    process.exit(1);
});