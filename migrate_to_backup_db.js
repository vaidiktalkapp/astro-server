/**
 * Fix script - retry babynames collection (force drop first)
 */
const { MongoClient } = require('mongodb');

const SOURCE_URI = 'mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk';
const TARGET_URI = 'mongodb+srv://lokesh_db_user:CUEjn2BPvCeF6PXo@cluster0.75mbenf.mongodb.net/';
const BATCH_SIZE = 500;


// ─── CONFIG ─────────────────────────────────────────────────
const SOURCE_URI = 'mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk';
const TARGET_URI = 'mongodb+srv://lokesh_db_user:CUEjn2BPvCeF6PXo@cluster0.75mbenf.mongodb.net/';
const TARGET_DB_NAME = 'vaidiktalk'; // Target DB naam (same as source)
const BATCH_SIZE = 500;              // Ek baar mein kitne documents copy kare
// ────────────────────────────────────────────────────────────

let sourceClient, targetClient;

async function migrate() {
  console.log('\n============================================================');
  console.log('  🚀 DATABASE BACKUP MIGRATION STARTED');
  console.log('============================================================');
  console.log(`📤 Source : cluster0.zjkqtzw (vaidiktalk)`);
  console.log(`📥 Target : cluster0.75mbenf (${TARGET_DB_NAME})`);
  console.log(`📦 Batch  : ${BATCH_SIZE} documents per batch`);
  console.log('============================================================\n');

  try {
    // Connect to BOTH databases
    console.log('🔌 Connecting to Source DB (READ-ONLY mode)...');
    sourceClient = new MongoClient(SOURCE_URI, {
      readPreference: 'secondaryPreferred', // Read from secondary if available - safer
    });
    await sourceClient.connect();
    console.log('✅ Source DB connected!\n');

    console.log('🔌 Connecting to Target DB...');
    targetClient = new MongoClient(TARGET_URI);
    await targetClient.connect();
    console.log('✅ Target DB connected!\n');

    const sourceDb = sourceClient.db('vaidiktalk');
    const targetDb = targetClient.db(TARGET_DB_NAME);

    // Get all collection names from source
    const collections = await sourceDb.listCollections().toArray();
    console.log(`📋 Found ${collections.length} collections in source:\n`);
    collections.forEach((c, i) => console.log(`   ${i + 1}. ${c.name}`));
    console.log('');

    const summary = [];

    // Migrate each collection one by one
    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;

      try {
        const sourceCol = sourceDb.collection(collectionName);
        const targetCol = targetDb.collection(collectionName);

        // Count total documents in source
        const totalDocs = await sourceCol.countDocuments();
        console.log(`\n📂 [${collectionName}] — ${totalDocs} documents`);

        if (totalDocs === 0) {
          console.log(`   ⏭️  Skipping (empty collection)`);
          summary.push({ collection: collectionName, total: 0, copied: 0, status: 'SKIPPED (empty)' });
          continue;
        }

        // Drop target collection before inserting (fresh copy)
        await targetCol.drop().catch(() => {}); // Ignore error if doesn't exist
        console.log(`   🗑️  Target collection cleared (fresh start)`);

        let copied = 0;
        let skip = 0;

        // Batch loop - READ source, WRITE to target
        while (skip < totalDocs) {
          const batch = await sourceCol
            .find({})
            .skip(skip)
            .limit(BATCH_SIZE)
            .toArray();

          if (batch.length === 0) break;

          await targetCol.insertMany(batch, { ordered: false });
          copied += batch.length;
          skip += batch.length;

          process.stdout.write(`   ✍️  Copied: ${copied}/${totalDocs}\r`);
        }

        console.log(`   ✅ Done! ${copied}/${totalDocs} documents copied        `);
        summary.push({ collection: collectionName, total: totalDocs, copied, status: '✅ SUCCESS' });

      } catch (err) {
        console.error(`   ❌ ERROR in [${collectionName}]: ${err.message}`);
        summary.push({ collection: collectionName, total: '?', copied: '?', status: `❌ ERROR: ${err.message}` });
      }
    }

    // Final Summary
    console.log('\n============================================================');
    console.log('  📊 MIGRATION SUMMARY');
    console.log('============================================================');
    console.log(`${'Collection'.padEnd(40)} ${'Total'.padEnd(10)} ${'Copied'.padEnd(10)} Status`);
    console.log('─'.repeat(80));
    summary.forEach(s => {
      console.log(`${s.collection.padEnd(40)} ${String(s.total).padEnd(10)} ${String(s.copied).padEnd(10)} ${s.status}`);
    });
    console.log('============================================================');

    const success = summary.filter(s => s.status.includes('SUCCESS')).length;
    const failed = summary.filter(s => s.status.includes('ERROR')).length;
    const skipped = summary.filter(s => s.status.includes('SKIPPED')).length;

    console.log(`\n🎉 Migration Complete!`);
    console.log(`   ✅ Success : ${success} collections`);
    console.log(`   ❌ Failed  : ${failed} collections`);
    console.log(`   ⏭️  Skipped : ${skipped} collections`);
    console.log(`\n⚠️  SOURCE DB WAS NEVER MODIFIED — Production safe hai!\n`);

  } catch (err) {
    console.error('\n❌ FATAL ERROR:', err.message);
    process.exit(1);
  } finally {
    if (sourceClient) {
      await sourceClient.close();
      console.log('🔌 Source DB connection closed.');
    }
    if (targetClient) {
      await targetClient.close();
      console.log('🔌 Target DB connection closed.');
    }
  }
}

migrate();
