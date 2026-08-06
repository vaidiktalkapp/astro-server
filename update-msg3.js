const mongoose = require('mongoose');

const uri = 'mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk';

async function run() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const collection = db.collection('chat_messages');
    
    // Find any message with this text
    const msgs = await collection.find({
      content: { $regex: "technical issue" }
    }).toArray();
    
    console.log("Found", msgs.length, "messages containing 'technical issue'");
    
    for (const msg of msgs) {
        console.log("Session ID:", msg.sessionId, "ID:", msg._id);
        const newContent = msg.content
          .replace("mujhe thoda technical issue aa raha hai Kundan ke chart ko calculate karne mein. Lekin ", "")
          .replace("Riya, mujhe thoda technical issue aa raha hai Kundan ke chart ko calculate karne mein. Lekin ", "Riya, ");
          
        await collection.updateOne({ _id: msg._id }, { $set: { content: newContent, message: newContent } });
        console.log("Updated!");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
