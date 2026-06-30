const run = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err && !err.message.includes('duplicate column name')) {
        return reject(err);
      }
      resolve(this);
    });
  });

const runUserDownloadAccessMigration = async (db) => {
  await run(db, 'ALTER TABLE users ADD COLUMN download_access INTEGER DEFAULT 0');

  await run(
    db,
    `UPDATE users
     SET download_access = 1,
         access_type = CASE WHEN access_type = 'download' THEN 'streaming' ELSE access_type END
     WHERE access_type = 'download'`
  );
};

module.exports = { runUserDownloadAccessMigration };
