import { withFilter } from 'graphql-subscriptions';
import { pubsub, EVENTS } from './pubsub.js';

export const resolvers = {
  Query: {
    users: async (_, __, { models }) => models.User.find().lean(),
    user: async (_, { id }, { models }) => models.User.findById(id).lean(),
    tasks: async (_, { userId }, { models }) => {
      const filter = userId ? { userId } : {};
      return models.Task.find(filter).lean();
    },
    task: async (_, { id }, { models }) => models.Task.findById(id).lean()
  },
  Task: {
    id: (doc) => doc._id?.toString?.() ?? doc.id,
    user: async (doc, _, { models }) => models.User.findById(doc.userId).lean()
  },
  User: {
    id: (doc) => doc._id?.toString?.() ?? doc.id
  },
  Mutation: {
    createUser: async (_, { name, email }, { models }) => {
      const u = await models.User.create({ name, email });
      return u.toObject();
    },
    createTask: async (_, { input }, { models }) => {
      const { userId, title } = input;
      const user = await models.User.findById(userId);
      if (!user) throw new Error('User not found');
      const t = await models.Task.create({ userId, title, done: false });
      const taskObj = t.toObject();
      await pubsub.publish(EVENTS.TASK_CREATED, { taskCreated: { ...taskObj, id: t._id.toString() } });
      return taskObj;
    },
    toggleTask: async (_, { id }, { models }) => {
      const t = await models.Task.findById(id);
      if (!t) throw new Error('Task not found');
      t.done = !t.done;
      await t.save();
      return t.toObject();
    },
    deleteTask: async (_, { id }, { models }) => {
      const res = await models.Task.deleteOne({ _id: id });
      return res.deletedCount > 0;
    }
  },
  Subscription: {
    taskCreated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([EVENTS.TASK_CREATED]),
        (payload, variables) => {
          if (!variables.userId) return true;
          return payload.taskCreated.userId.toString() == variables.userId.toString();
        }
      )
    }
  }
};
