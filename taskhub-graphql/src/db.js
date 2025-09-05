import mongoose from 'mongoose';

export async function connectMongo(uri) {
  if (mongoose.connection.readyState === 1) return;
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    dbName: 'taskhub'
  });
  console.log('[db] connected:', uri);
}
