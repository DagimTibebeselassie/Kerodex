const fs = require("fs");
const path = require("path");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  fs.readFileSync(filePath, "utf8").split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

const root = path.resolve(__dirname, "..");
loadEnv(path.join(root, ".env.local"));
loadEnv(path.join(root, ".env"));

const store = require("../apps/api/store");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  assert(store.kind === "postgres", "Database state test requires the configured PostgreSQL store.");
  await store.connect();
  const listings = await store.getListings();
  assert(listings.length > 0, "Database must contain at least one listing.");

  const listing = listings[0];
  const userId = `db_state_test_${Date.now()}`;
  const eventId = `db_state_event_${Date.now()}`;
  const costId = `db_state_cost_${Date.now()}`;
  const feedbackId = `db_state_feedback_${Date.now()}`;
  const followupId = `db_state_followup_${Date.now()}`;
  const initialViews = Number(listing.views || 0);

  try {
    await store.trackEvent({
      id: eventId,
      eventType: "listing_view",
      userId,
      listingId: listing.id,
      metadata: { source: "database_state_test" },
      createdAt: new Date().toISOString()
    });
    assert(Number((await store.getListingById(listing.id)).views || 0) === initialViews + 1, "Persisted listing view did not update the listing metric.");

    await store.setListingSaved(userId, listing.id, true);
    const saved = await store.getSavedListings(userId);
    assert(saved.length === 1 && saved[0].id === listing.id, "Database favorite did not appear in the saved collection.");

    const afterOrphanSync = await store.syncSavedListings(userId, ["listing-that-does-not-exist"]);
    assert(afterOrphanSync.length === 1, "Orphaned listing ID created a phantom saved vehicle.");

    await store.setListingSaved(userId, listing.id, false);
    assert((await store.getSavedListings(userId)).length === 0, "Database favorite was not removed.");

    await store.saveCostRecord({
      id: costId, serviceName: "test_service", actionType: "test_call", userId, listingId: listing.id,
      requestId: "", status: "success", unitsUsed: 1, estimatedCost: 0.001, metadata: {}, createdAt: new Date().toISOString()
    });
    assert((await store.getCostRecords()).some((record) => record.id === costId), "Database cost record was not persisted.");

    await store.saveFeedback({
      id: feedbackId, userId, listingId: listing.id, context: "database_test", rating: 5,
      responseText: "Helpful", metadata: {}, createdAt: new Date().toISOString()
    });
    assert((await store.getFeedbackRecords()).some((record) => record.id === feedbackId), "Database feedback record was not persisted.");

    await store.saveFollowup({
      id: followupId, userId, listingId: listing.id, conversationId: "db-test-conversation",
      followupType: "buyer_purchase", answer: "still_looking", feedbackText: "", dismissed: false, createdAt: new Date().toISOString()
    });
    assert((await store.getFollowupsByUser(userId)).some((record) => record.id === followupId), "Database follow-up record was not persisted.");

    process.stdout.write(`Database-backed state passed for listing ${listing.id}: views, saves, costs, feedback, and follow-ups are live.\n`);
  } finally {
    await store.pool.query("DELETE FROM favorite_records WHERE user_id = $1", [userId]).catch(() => {});
    await store.pool.query("DELETE FROM analytics_events WHERE id = $1", [eventId]).catch(() => {});
    await store.pool.query("DELETE FROM cost_records WHERE id = $1", [costId]).catch(() => {});
    await store.pool.query("DELETE FROM feedback_records WHERE id = $1", [feedbackId]).catch(() => {});
    await store.pool.query("DELETE FROM followup_records WHERE id = $1", [followupId]).catch(() => {});
    await store.pool.end();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
