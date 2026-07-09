const run = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

// Non-card subscribers always show Payment → Subscribed (is_paying on)
// and are never billed through Stripe monthly payments.
const runNonCardSubscribedMigration = async (db) => {
  await run(
    db,
    `UPDATE users SET monthly_payments = 0
     WHERE payment_category = 'non_card'`
  );
  const result = await run(
    db,
    `UPDATE users SET is_paying = 1
     WHERE payment_category = 'non_card' AND (is_paying IS NULL OR is_paying = 0)`
  );
  if (result.changes > 0) {
    console.log(`Set Payment → Subscribed for ${result.changes} non-card user(s)`);
  }
};

module.exports = { runNonCardSubscribedMigration };
