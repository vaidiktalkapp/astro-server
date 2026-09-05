// SECURITY AUDIT SCRIPT - READ ONLY, NO CHANGES
const { MongoClient } = require('./node_modules/mongoose/node_modules/mongodb');
const uri = process.env.MONGO_URI || 'mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk';

async function runAudit() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('vaidiktalk');
    console.log('\n✅ Connected to MongoDB\n');

    // ============ 1. ADMIN USERS ============
    console.log('═══════════════════════════════════════');
    console.log('1️⃣  ADMIN ACCOUNTS');
    console.log('═══════════════════════════════════════');
    const admins = await db.collection('admins').find({}).toArray().catch(() => []);
    if (admins.length === 0) {
      // try alternate collection name
      const adminUsers = await db.collection('adminusers').find({}).toArray().catch(() => []);
      if (adminUsers.length === 0) {
        console.log('Collection name might differ. Listing all collections...');
        const cols = await db.listCollections().toArray();
        const adminCols = cols.filter(c => c.name.toLowerCase().includes('admin'));
        console.log('Admin-related collections:', adminCols.map(c => c.name));
        for (const col of adminCols) {
          const docs = await db.collection(col.name).find({}).toArray();
          console.log(`\n[${col.name}] - ${docs.length} records:`);
          docs.forEach(d => {
            console.log({
              _id: d._id,
              name: d.name,
              email: d.email,
              role: d.role,
              isSuperAdmin: d.isSuperAdmin,
              isActive: d.isActive,
              createdAt: d.createdAt,
              updatedAt: d.updatedAt,
              lastLogin: d.lastLogin,
              // DO NOT print password hash in full, just first 10 chars
              passwordPreview: d.password ? d.password.substring(0, 15) + '...' : 'NO PASSWORD',
              has2FA: d.twoFactorEnabled || d.mfaEnabled || d.totpEnabled || false,
            });
          });
        }
      } else {
        adminUsers.forEach(a => {
          console.log({ _id: a._id, name: a.name, email: a.email, role: a.role, isSuperAdmin: a.isSuperAdmin, passwordPreview: a.password ? a.password.substring(0, 15) + '...' : 'NONE', has2FA: a.twoFactorEnabled || false });
        });
      }
    } else {
      admins.forEach(a => {
        console.log({
          _id: a._id,
          name: a.name,
          email: a.email,
          role: a.role,
          isSuperAdmin: a.isSuperAdmin,
          isActive: a.isActive,
          createdAt: a.createdAt,
          lastLogin: a.lastLogin,
          passwordPreview: a.password ? a.password.substring(0, 15) + '...' : 'NONE',
          has2FA: a.twoFactorEnabled || a.mfaEnabled || false,
        });
      });
    }

    // ============ 2. ADMIN LOGS / SESSIONS ============
    console.log('\n═══════════════════════════════════════');
    console.log('2️⃣  ADMIN ACTIVITY LOGS (Last 20)');
    console.log('═══════════════════════════════════════');
    const allCols = await db.listCollections().toArray();
    const logCols = allCols.filter(c => c.name.toLowerCase().includes('log') || c.name.toLowerCase().includes('audit') || c.name.toLowerCase().includes('session'));
    console.log('Log/Session collections found:', logCols.map(c => c.name));
    
    for (const col of logCols) {
      const logs = await db.collection(col.name).find({}).sort({ createdAt: -1 }).limit(20).toArray();
      if (logs.length > 0) {
        console.log(`\n[${col.name}] - ${logs.length} recent records:`);
        logs.forEach(l => console.log(JSON.stringify({ action: l.action, admin: l.adminEmail || l.email || l.adminId, ip: l.ip || l.ipAddress, time: l.createdAt || l.timestamp, details: l.details || l.description })));
      }
    }

    // ============ 3. HACKER TRACES SCAN ============
    console.log('\n═══════════════════════════════════════');
    console.log('3️⃣  MALICIOUS CONTENT SCAN (LungzzX + Hacked Images)');
    console.log('═══════════════════════════════════════');
    const collections = await db.listCollections().toArray();
    let totalFound = 0;
    for (const col of collections) {
      const docs = await db.collection(col.name).find({}).toArray();
      for (const doc of docs) {
        const str = JSON.stringify(doc);
        if (str.match(/LungzzX/i) || str.match(/1788541470982|1788541134137/)) {
          console.log('⚠️  HACK TRACE FOUND in:', col.name, 'ID:', doc._id);
          totalFound++;
        }
      }
    }
    if (totalFound === 0) console.log('✅ NO hacker traces found in any collection');
    else console.log(`🚨 TOTAL hacker traces still present: ${totalFound}`);

    // ============ 4. BLOGS CHECK ============
    console.log('\n═══════════════════════════════════════');
    console.log('4️⃣  BLOGS - Check for suspicious content');
    console.log('═══════════════════════════════════════');
    const blogs = await db.collection('blogs').find({}).toArray().catch(() => []);
    const suspiciousPatterns = /<script|javascript:|eval\(|base64|onclick|onerror|LungzzX/i;
    let suspiciousBlogs = 0;
    blogs.forEach(b => {
      const str = JSON.stringify(b);
      if (str.match(suspiciousPatterns)) {
        console.log('⚠️  Suspicious blog:', b.slug, b.title, b._id);
        suspiciousBlogs++;
      }
    });
    console.log(`Total blogs: ${blogs.length} | Suspicious: ${suspiciousBlogs}`);
    if (suspiciousBlogs === 0) console.log('✅ All blogs clean');

    // ============ 5. HERO SETTINGS CHECK ============
    console.log('\n═══════════════════════════════════════');
    console.log('5️⃣  HERO SETTINGS (Homepage Content)');
    console.log('═══════════════════════════════════════');
    const heroCol = allCols.find(c => c.name.toLowerCase().includes('hero'));
    if (heroCol) {
      const hero = await db.collection(heroCol.name).findOne({});
      console.log('Collection:', heroCol.name);
      console.log(JSON.stringify(hero, null, 2));
    } else {
      console.log('No hero settings collection found');
    }

    // ============ 6. ALL COLLECTIONS OVERVIEW ============
    console.log('\n═══════════════════════════════════════');
    console.log('6️⃣  DATABASE OVERVIEW');
    console.log('═══════════════════════════════════════');
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`  ${col.name}: ${count} documents`);
    }

    // ============ 7. 2FA CHECK IN CODE ============
    console.log('\n═══════════════════════════════════════');
    console.log('7️⃣  2FA STATUS IN ADMIN SCHEMA');
    console.log('═══════════════════════════════════════');
    // Check if any admin has 2FA fields
    const adminDocs = await db.collection(collections.find(c=>c.name.toLowerCase().includes('admin'))?.name || 'admins').find({}).toArray().catch(() => []);
    const has2FAField = adminDocs.some(d => 'twoFactorEnabled' in d || 'mfaEnabled' in d || 'totpSecret' in d);
    console.log('2FA field exists in admin docs:', has2FAField);
    console.log('2FA enabled for any admin:', adminDocs.some(d => d.twoFactorEnabled || d.mfaEnabled));

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.close();
    console.log('\n✅ Audit complete. Connection closed.');
  }
}

runAudit();
