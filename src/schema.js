import { createSchema } from 'graphql-yoga';
import { PubSub } from 'graphql-subscriptions';
import Task from './models/Task.js';
import User from './models/User.js';

export const pubsub = new PubSub();
const TASK_CREATED = 'TASK_CREATED';

const typeDefs = /* GraphQL */ `
  scalar Date

  type User {
    id: ID!
    name: String!
    email: String!
    createdAt: Date
    updatedAt: Date
  }

  type Task {
    id: ID!
    title: String!
    done: Boolean!
    user: User!
    createdAt: Date
    updatedAt: Date
  }

  input CreateUserInput {
    name: String!
    email: String!
  }

  input CreateTaskInput {
    title: String!
    userId: ID!
  }

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

const resolvers = {
  Query: {
    users: () => User.find().lean(),
    user: (_, { id }) => User.findById(id).lean(),
    tasks: async (_, { userId }) => {
      const query = userId ? { user: userId } : {};
      return Task.find(query).populate('user').lean();
    },
    task: (_, { id }) => Task.findById(id).populate('user').lean(),
  },
  Mutation: {
    createUser: async (_, { input }) => {
      const doc = await User.create({ name: input.name, email: input.email });
      return doc.toObject();
    },
    createTask: async (_, { input }) => {
      const user = await User.findById(input.userId);
      if (!user) throw new Error('User not found');
      const created = await Task.create({ title: input.title, user: user._id });
      const taskPopulated = await created.populate('user');
      const obj = taskPopulated.toObject();
      await pubsub.publish(TASK_CREATED, { taskCreated: obj });
      return obj;
    },
    toggleTask: async (_, { id }) => {
      const task = await Task.findById(id).populate('user');
      if (!task) throw new Error('Task not found');
      task.done = !task.done;
      await task.save();
      return task.toObject();
    },
    deleteTask: async (_, { id }) => {
      const res = await Task.deleteOne({ _id: id });
      return res.deletedCount === 1;
    },
  },
  Subscription: {
    taskCreated: {
      subscribe: () => pubsub.asyncIterator(TASK_CREATED),
      resolve: (payload) => payload.taskCreated,
    },
  },
};

export const schema = createSchema({
  typeDefs,
  resolvers,
});
