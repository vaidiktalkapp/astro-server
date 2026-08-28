require('dotenv').config();
const mongoose = require('mongoose');

async function fix() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const collection = db.collection('manualhoroscopes');

    const docs = await collection.find({ period: 'today' }).toArray();
    for (let doc of docs) {
        const text = doc.readingData.reading;
        
        // Helper to extract the text for a specific category
        const extractCategory = (cat) => {
            const regex = new RegExp(`<strong>${cat}:<\\/strong> (.*?)<\\/li>`, 'i');
            const match = text.match(regex);
            return match ? match[1].trim() : '';
        };

        const career = extractCategory('Career');
        const love = extractCategory('Love life') || extractCategory('Married life');
        const health = extractCategory('Health');
        const family = extractCategory('Family');
        const finance = extractCategory('Finances');

        // Build a dynamic paragraph using 2-3 sentences.
        // We will randomly pick categories or just combine them nicely.
        const parts = [];
        if (career) parts.push(career);
        if (love) parts.push(love);
        if (health) parts.push(health);
        
        let combined = parts.join(' ').replace(/\s+/g, ' ').trim();
        
        // If it's still too short, add another
        if (combined.length < 150 && family) {
            combined += ' ' + family;
        }
        if (combined.length < 150 && finance) {
            combined += ' ' + finance;
        }

        let preview = combined;
        // Cap around 220 characters for UI consistency without looking too small
        if (preview.length > 250) {
            // Cut off at the last period before 250 chars
            const sub = preview.substring(0, 250);
            const lastPeriod = sub.lastIndexOf('.');
            if (lastPeriod > 100) {
                preview = sub.substring(0, lastPeriod + 1);
            } else {
                preview = sub.trim() + '...';
            }
        }

        await collection.updateOne(
            { _id: doc._id },
            { $set: { "readingData.previewText": preview } }
        );
        console.log(`Updated preview for ${doc.sign}:\n${preview}\n`);
    }
    console.log("Done!");
    process.exit(0);
}

fix().catch(console.error);
