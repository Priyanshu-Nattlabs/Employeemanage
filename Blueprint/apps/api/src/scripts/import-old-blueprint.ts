import { MongoClient } from "mongodb";

async function copyCollection(
  srcDb: any,
  dstDb: any,
  name: string
) {
  const docs = await srcDb.collection(name).find({}).toArray();
  await dstDb.collection(name).deleteMany({});
  if (docs.length) {
    await dstDb.collection(name).insertMany(docs, { ordered: false });
  }
  console.log(`[import] ${name}: ${docs.length} document(s) copied`);
}

async function run() {
  const oldUri = process.env.OLD_MONGODB_URI || "mongodb://localhost:27017/saarthix";
  const newUri = process.env.NEW_MONGODB_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/job_blueprint_v2";

  const oldClient = new MongoClient(oldUri);
  const newClient = new MongoClient(newUri);

  console.log(`[import] source: ${oldUri}`);
  console.log(`[import] target: ${newUri}`);

  try {
    await oldClient.connect();
    await newClient.connect();
    const srcDb = oldClient.db();
    const dstDb = newClient.db();

    await copyCollection(srcDb, dstDb, "blueprints");
    await copyCollection(srcDb, dstDb, "role_preparations");
    await copyCollection(srcDb, dstDb, "skill_tests");

    console.log("[import] completed successfully");
  } finally {
    await oldClient.close();
    await newClient.close();
  }
}

run().catch((err) => {
  console.error("[import] failed:", err);
  process.exit(1);
});

