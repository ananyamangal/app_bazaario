import mongoose from "mongoose";

mongoose
  .connect(process.env.MONGO_URI as string)
  .then(async () => {
    console.log("MongoDB connected");
    
    // Drop stale indexes that may cause issues
    const db = mongoose.connection.db;
    if (db) {
      // Reviews: allow multiple docs with orderId null (drop unique orderId_1 if present)
      try {
        const reviewsCollections = await db.listCollections({ name: 'reviews' }).toArray();
        if (reviewsCollections.length > 0) {
          const reviewsCollection = db.collection('reviews');
          const reviewIndexes = await reviewsCollection.indexes();
          const orderIdIndex = reviewIndexes.find((idx: any) => idx.name === 'orderId_1');
          if (orderIdIndex) {
            console.log("Dropping orderId index on reviews (allows multiple reviews with no order)...");
            await reviewsCollection.dropIndex('orderId_1');
            console.log("Reviews orderId index dropped successfully");
          }
        }
      } catch (err: any) {
        if (!err.message?.includes('index not found') && !err.message?.includes('ns not found')) {
          console.error("Error cleaning up reviews indexes:", err.message);
        }
      }

      // Orders: drop stale orderId index if present
      try {
        const ordersCollections = await db.listCollections({ name: 'orders' }).toArray();
        if (ordersCollections.length > 0) {
          const ordersCollection = db.collection('orders');
          const indexes = await ordersCollection.indexes();
          const staleIndex = indexes.find((idx: any) => idx.name === 'orderId_1');
          if (staleIndex) {
            console.log("Dropping stale orderId index on orders...");
            await ordersCollection.dropIndex('orderId_1');
            console.log("Stale orderId index dropped successfully");
          }
        }
      } catch (err: any) {
        if (!err.message?.includes('index not found') && !err.message?.includes('ns not found')) {
          console.error("Error cleaning up orders indexes:", err.message);
        }
      }
    }
  })
  .catch((err) => console.error(err));
