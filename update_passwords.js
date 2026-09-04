const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

async function updatePasswords() {
  const uri = 'mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk';
  let client;
  try {
    client = new MongoClient(uri);
    await client.connect();
    const db = client.db('vaidiktalk');
    
    console.log("🔒 Securing Admin Accounts...");

    // Generate secure passwords
    const adminPass = "Vaidik@!$Secure" + Math.floor(Math.random() * 999999);
    const vishalPass = "Vaidik@!$Secure" + Math.floor(Math.random() * 999999);

    const salt = await bcrypt.genSalt(10);
    const hashedAdminPass = await bcrypt.hash(adminPass, salt);
    const hashedVishalPass = await bcrypt.hash(vishalPass, salt);

    // Update the database
    await db.collection('admins').updateOne(
      { email: 'admin@vaidiktalk.com' },
      { $set: { password: hashedAdminPass } }
    );
    
    await db.collection('admins').updateOne(
      { email: 'vishal456@gmail.com' },
      { $set: { password: hashedVishalPass } }
    );

    console.log("✅ Passwords updated successfully!");
    console.log("\n--- NEW SECURE PASSWORDS ---");
    console.log(`Email: admin@vaidiktalk.com`);
    console.log(`Password: ${adminPass}`);
    console.log(`-----------------------------`);
    console.log(`Email: vishal456@gmail.com`);
    console.log(`Password: ${vishalPass}`);
    console.log(`-----------------------------`);
    console.log("\n⚠️ IMPORTANT: Please save these passwords. You can change them later from the Admin Dashboard.");

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    if (client) await client.close();
  }
}

updatePasswords();
