const mongoose = require('mongoose');

const uri = 'mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk';
const stringToRemove = "mujhe thoda technical issue aa raha hai Kundan ke chart ko calculate karne mein. Lekin ";

async function run() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const collection = db.collection('chat_messages');
    
    const msg = await collection.findOne({
      sessionId: "6a58c67eab53d16c6c8e20dd",
      content: { $regex: "technical issue aa raha hai" }
    });
    
    if (msg) {
      console.log("Found message:", msg.content);
      const newContent = msg.content.replace(stringToRemove, "");
      await collection.updateOne({ _id: msg._id }, { $set: { content: newContent, message: newContent } });
      console.log("Successfully updated the message!");
    } else {
      console.log("Message not found.");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
