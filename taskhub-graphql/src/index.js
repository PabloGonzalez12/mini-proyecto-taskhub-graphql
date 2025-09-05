import 'dotenv/config.js';
import http from 'http';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers.js';
import { connectMongo } from './db.js';
import { User } from './models/User.js';
import { Task } from './models/Task.js';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';

const PORT = process.env.PORT || 4001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/taskhub';

// Create schema once to share between HTTP and WS
const schema = makeExecutableSchema({ typeDefs, resolvers });

// Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// HTTP server
const server = http.createServer(app);

// WS server for Subscriptions
const wsServer = new WebSocketServer({
  server,
  path: '/graphql',
});
const serverCleanup = useServer({ schema, context: async () => ({ models: { User, Task } }) }, wsServer);

// Apollo Server
const apollo = new ApolloServer({
  schema,
  // Ensure we dispose WS on shutdown
  plugins: [{
    async serverWillStart() {
      return {
        async drainServer() {
          await serverCleanup.dispose();
        }
      };
    }
  }]
});
await apollo.start();

app.use('/graphql', expressMiddleware(apollo, {
  context: async ({ req }) => ({
    models: { User, Task }
  })
}));

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// Start
await connectMongo(MONGODB_URI);
server.listen(PORT, () => {
  console.log(`[http] http://localhost:${PORT}/graphql`);
  console.log(`[ws]   ws://localhost:${PORT}/graphql`);
});
