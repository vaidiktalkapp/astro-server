const mongoose = require('mongoose');

const uri = 'mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk';

async function run() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const collection = db.collection('chat_messages');
    
    const msgs = await collection.find({
      sessionId: "6a58c67eab53d16c6c8e20dd"
    }).toArray();
    
    for (const msg of msgs) {
      if (msg.content && msg.content.includes("technical issue")) {
        console.log("ID:", msg._id, "Content:", msg.content);
        const stringToRemove = "mujhe thoda technical issue aa raha hai Kundan ke chart ko calculate karne mein. Lekin ";
        const stringToRemove2 = "Riya, mujhe thoda technical issue aa raha hai Kundan ke chart ko calculate karne mein. Lekin ";
        const newContent = msg.content.replace(stringToRemove2, "Riya, ").replace(stringToRemove, "");
        await collection.updateOne({ _id: msg._id }, { $set: { content: newContent, message: newContent } });
        console.log("Updated to:", newContent);
      }
    }
    console.log("Done checking", msgs.length, "messages");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
