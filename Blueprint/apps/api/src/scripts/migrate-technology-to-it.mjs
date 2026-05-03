/**
 * One-time migration: rename legacy labels from "Technology" -> "IT".
 *
 * Applies to:
 * - company_users.department (legacy "Technology" bucket -> "AI" default; see below)
 * - company_users.industry
 * - company_org_structures.departments[].name (only if they literally used "Technology")
 *
 * Env:
 *   MONGODB_URI — default mongodb://localhost:27017/job_blueprint_v2
 */
import { MongoClient } from "mongodb";

const MONGO = (process.env.MONGODB_URI || "mongodb://localhost:27017/job_blueprint_v2").trim();

async function main() {
  console.log(`🔌  Connecting to ${MONGO}…`);
  const client = new MongoClient(MONGO);
  await client.connect();
  const db = client.db();

  const users = db.collection("company_users");
  const orgs = db.collection("company_org_structures");

  // Legacy data used "Technology" as a department bucket. Current system uses IT sub-departments
  // like AI/Cybersec/... so we map it to "AI" as a safe default.
  console.log("♻️   Updating company_users.department Technology -> AI …");
  const r1 = await users.updateMany({ department: "Technology" }, { $set: { department: "AI" } });
  console.log(`      matched=${r1.matchedCount} modified=${r1.modifiedCount}`);

  console.log("♻️   Updating company_users.industry Technology -> IT …");
  const r2 = await users.updateMany({ industry: "Technology" }, { $set: { industry: "IT" } });
  console.log(`      matched=${r2.matchedCount} modified=${r2.modifiedCount}`);

  console.log("♻️   Updating company_org_structures department name Technology -> IT …");
  const r3 = await orgs.updateMany(
    { "departments.name": "Technology" },
    { $set: { "departments.$[d].name": "IT" } },
    { arrayFilters: [{ "d.name": "Technology" }] },
  );
  console.log(`      matched=${r3.matchedCount} modified=${r3.modifiedCount}`);

  await client.close();
  console.log("🎉  Done!");
}

main().catch((err) => {
  console.error("❌ ", err?.message || err);
  process.exit(1);
});

