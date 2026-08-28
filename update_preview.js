require('dotenv').config();
const mongoose = require('mongoose');

async function fix() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const collection = db.collection('manualhoroscopes');

    const docs = await collection.find({ period: 'today' }).toArray();
    for (let doc of docs) {
        const text = doc.readingData.reading;
        // Strip HTML tags and extra spaces
        let clean = text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
        // Remove the "Daily Overview Finances: " prefix part to make the snippet read naturally
        clean = clean.replace(/^Daily Overview\s*/i, '').replace(/^Finances:\s*/i, '');
        
        // Take first sentence or up to 120 chars
        let preview = clean.split('.')[0] + '.';
        if (preview.length > 130) {
            preview = clean.substring(0, 127).trim() + '...';
        } else if (preview.length < 30) {
            preview = clean.substring(0, 120).trim() + '...';
        }

        await collection.updateOne(
            { _id: doc._id },
            { $set: { "readingData.previewText": preview } }
        );
        console.log(`Updated preview text for ${doc.sign}: ${preview}`);
    }
    console.log("Done!");
    process.exit(0);
}

fix().catch(console.error);
