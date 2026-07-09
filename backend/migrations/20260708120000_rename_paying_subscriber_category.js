const run = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

// Rename legacy payment_category value discounted → paying_subscriber.
const runPayingSubscriberCategoryMigration = async (db) => {
  const result = await run(
    db,
    `UPDATE users SET payment_category = 'paying_subscriber'
     WHERE payment_category = 'discounted'`
  );
  if (result.changes > 0) {
    console.log(`Renamed payment_category discounted → paying_subscriber for ${result.changes} user(s)`);
  }
};

module.exports = { runPayingSubscriberCategoryMigration };
