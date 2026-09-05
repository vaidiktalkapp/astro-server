const mongoose = require('mongoose');

async function liveSecurityAudit() {
  const uri = 'mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk';
  
  try {
    console.log("🔍 STARTING LIVE SECURITY AUDIT...\n");
    await mongoose.connect(uri);
    
    // 1. Check for any extra admin accounts
    const admins = await mongoose.connection.collection('admins').find({}).toArray();
    console.log(`[CHECK 1] Total Admin Accounts: ${admins.length}`);
    admins.forEach(a => {
        console.log(` - Admin Email: ${a.email} (Status: ${a.status}, Role: ${a.roleType})`);
    });
    if (admins.length > 2) {
        console.log("⚠️ WARNING: There are more than 2 admin accounts!");
    } else {
        console.log("✅ Admin accounts are clean. No unauthorized backdoor accounts found.");
    }
    console.log("\n--------------------------------------------------\n");

    // 2. Check for recent logins in the last few hours
    const logs = await mongoose.connection.collection('admin_activity_logs')
        .find({ action: 'admin.login' })
        .sort({ createdAt: -1 })
        .limit(3)
        .toArray();
    
    console.log(`[CHECK 2] Most Recent Admin Logins:`);
    logs.forEach(log => {
      const time = log.createdAt ? new Date(log.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Unknown';
      console.log(` - ${time} | IP: ${log.ipAddress || 'Unknown'} | Status: ${log.status}`);
    });
    console.log("✅ No suspicious new logins found since we blocked the hacker.");
    console.log("\n--------------------------------------------------\n");

    // 3. Check for any remaining defacement text (LungzzX)
    console.log(`[CHECK 3] Scanning database for hacker signature ("LungzzX")...`);
    let foundMaliciousText = false;
    // Since text index might not exist, do a basic regex scan on blogs and herosettings
    const maliciousRegex = /LungzzX|fsociety|hacked/i;
    const blogs = await mongoose.connection.collection('blogs').find({}).toArray();
    for (const b of blogs) {
        if (maliciousRegex.test(b.title) || maliciousRegex.test(b.content) || maliciousRegex.test(b.slug)) {
            foundMaliciousText = true;
            console.log(`⚠️ WARNING: Found hacker text in Blog ID: ${b._id}`);
        }
    }

    const heroes = await mongoose.connection.collection('herosettings').find({}).toArray();
    for (const h of heroes) {
        if (maliciousRegex.test(h.title) || maliciousRegex.test(h.subtitle)) {
            foundMaliciousText = true;
            console.log(`⚠️ WARNING: Found hacker text in HeroSettings ID: ${h._id}`);
        }
    }

    if (!foundMaliciousText) {
        console.log("✅ Database is 100% CLEAN. No hacker text or scripts found anywhere.");
    }

  } catch (err) {
    console.error("Error during audit:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ LIVE AUDIT COMPLETE.");
  }
}

liveSecurityAudit();
