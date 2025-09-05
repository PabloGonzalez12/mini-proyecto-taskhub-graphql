import 'dotenv/config';
import { createServer } from 'http';
import { createYoga, createSchema, createPubSub } from 'graphql-yoga';
import mongoose from 'mongoose';

// ----- DB -----
const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/taskhub';
await mongoose.connect(mongoUrl);

// Models
const User = mongoose.model('User', new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
}));

const Task = mongoose.model('Task', new mongoose.Schema({
  title: { type: String, required: true },
  done: { type: Boolean, default: false },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
}));

// Helpers
const toUser = (u) => ({ id: u._id.toString(), name: u.name, email: u.email, createdAt: u.createdAt.toISOString() });
const toTask = (t) => ({ id: t._id.toString(), title: t.title, done: t.done, userId: t.userId.toString(), createdAt: t.createdAt.toISOString() });

// ----- GraphQL -----
const typeDefs = /* GraphQL */ `
  type User { id: ID!, name: String!, email: String!, createdAt: String! }
  input CreateUserInput { name: String!, email: String! }

  type Task { id: ID!, title: String!, done: Boolean!, user: User!, createdAt: String! }
  input CreateTaskInput { title: String!, userId: ID! }

  type Query {
    users: [User!]!
    user(id: ID!): User
    tasks(userId: ID): [Task!]!
    task(id: ID!): Task
  }

  type Mutation {
    createUser(input: CreateUserInput!): User!
    createTask(input: CreateTaskInput!): Task!
    toggleTask(id: ID!): Task!
    deleteTask(id: ID!): Boolean!
  }

  type Subscription {
    taskCreated: Task!
  }
`;

const pubSub = createPubSub();

const resolvers = {
  Query: {
    users: async () => (await User.find().sort({ createdAt: -1 })).map(toUser),
    user: async (_, { id }) => { const u = await User.findById(id); return u && toUser(u); },
    tasks: async (_, { userId }) => {
      const where = userId ? { userId } : {};
      const list = await Task.find(where).sort({ createdAt: -1 });
      return list.map(toTask);
    },
    task: async (_, { id }) => { const t = await Task.findById(id); return t && toTask(t); }
  },
  Task: {
    user: async (parent) => {
      const u = await User.findById(parent.userId);
      return u && toUser(u);
    }
  },
  Mutation: {
    createUser: async (_, { input }) => {
      const created = await User.create(input);
      return toUser(created);
    },
    createTask: async (_, { input }) => {
      const user = await User.findById(input.userId);
      if (!user) throw new Error('user not found');
      const created = await Task.create({ title: input.title, userId: input.userId });
      const data = toTask(created);
      await pubSub.publish('TASK_CREATED', data);
      return data;
    },
    toggleTask: async (_, { id }) => {
      const t = await Task.findById(id);
      if (!t) throw new Error('task not found');
      t.done = !t.done;
      await t.save();
      return toTask(t);
    },
    deleteTask: async (_, { id }) => {
      const ret = await Task.deleteOne({ _id: id });
      return ret.deletedCount === 1;
    }
  },
  Subscription: {
    taskCreated: {
      subscribe: () => pubSub.subscribe('TASK_CREATED'),
      resolve: (payload) => payload
    }
  }
};

const yoga = createYoga({
  cors: { origin: '*', credentials: false },
  graphqlEndpoint: '/graphql',
  schema: createSchema({ typeDefs, resolvers })
});

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } else {
    yoga(req, res);
  }
});

const port = Number(process.env.PORT || 4001);
server.listen(port, () => {
  console.log(`TaskHub GraphQL listo: http://localhost:${port}/graphql`);
});
