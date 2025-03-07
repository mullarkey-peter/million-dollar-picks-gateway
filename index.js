const { ApolloServer } = require('@apollo/server');
const { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource} = require('@apollo/gateway');
const express = require('express');
const { expressMiddleware } = require('@apollo/server/express4');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

async function createGatewayWithRetry(maxRetries = 10, retryInterval = 5000) {
    let retries = 0;
    let gateway = null;

    while (retries < maxRetries) {
        try {
            console.log(`Attempt ${retries + 1} to connect to subgraphs...`);

            const gateway = new ApolloGateway({
                supergraphSdl: new IntrospectAndCompose({
                    subgraphs: [
                        { name: 'users', url: 'http://user-service:8080/graphql' },
                        { name: 'auth', url: 'http://auth-service:8080/graphql'}
                    ],
                }),
                buildService({ name, url }) {
                    console.log(`Configuring subgraph: ${name} at ${url}`);
                    return new RemoteGraphQLDataSource({
                        url,
                        willSendRequest({ request, context }) {
                            if (context.token) {
                                console.log(`Forwarding token to ${name}`);
                                request.http.headers.set('Authorization', `Bearer ${context.token}`);
                            } else {
                                console.log(`No token to forward to ${name}`);
                            }
                        },
                    });
                },
            });

            console.log('Successfully created gateway configuration');
            return gateway;

        } catch (error) {
            retries++;
            console.error(`Failed to connect to subgraphs (attempt ${retries}/${maxRetries}):`, error.message);

            if (retries >= maxRetries) {
                console.error('Max retries reached. Exiting...');
                throw error;
            }

            console.log(`Waiting ${retryInterval / 1000} seconds before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, retryInterval));
        }
    }
}

async function startServer() {
    try {
        const gateway = await createGatewayWithRetry();
        const server = new ApolloServer({ gateway });
        await server.start();

        app.use('/graphql', express.json(), (req, res, next) => {
            const token = req.headers.authorization?.split(' ')[1] || '';
            console.log('Gateway received request with body:', JSON.stringify(req.body));
            req.token = token;
            next();
        });

        // Pass the context to the Apollo Server
        app.use('/graphql', expressMiddleware(server, {
            context: async ({ req }) => {
                // Extract token from the request headers
                const token = req.headers.authorization?.split(' ')[1] || '';
                console.log(`Received request with auth token: ${token ? 'present' : 'not present'}`);
                // Return context with the token
                return {
                    token: token
                };
            }
        }));

        const httpServer = http.createServer(app);
        const PORT = 4000;

        httpServer.listen(PORT, () => {
            console.log(`🚀 Gateway server running at http://localhost:${PORT}/graphql`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();