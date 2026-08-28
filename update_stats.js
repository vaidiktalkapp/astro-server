require('dotenv').config();
const mongoose = require('mongoose');

const positiveWords = ['steady', 'benefits', 'boost', 'happiness', 'success', 'prosperity', 'good', 'joy', 'healthy', 'immense', 'opportunities', 'golden'];
const negativeWords = ['decline', 'challenging', 'hurdles', 'discontent', 'stress', 'obstacles', 'dissatisfaction', 'backseat', 'losses', 'worry', 'conflict', 'concern'];

function analyzeText(text) {
    let score = 50;
    const lower = text.toLowerCase();
    
    for (let word of positiveWords) {
        if (lower.includes(word)) score += 15;
    }
    for (let word of negativeWords) {
        if (lower.includes(word)) score -= 15;
    }
    
    // add some randomization so it doesn't look static
    score += Math.floor(Math.random() * 10) - 5;
    
    score = Math.max(35, Math.min(95, score)); // range 35-95
    
    let label = 'Average';
    if (score >= 80) label = 'Excellent';
    else if (score >= 60) label = 'Good';
    else if (score < 45) label = 'Challenging';
    
    return { value: score, label };
}

async function fix() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const collection = db.collection('manualhoroscopes');

    const docs = await collection.find({ period: { $in: ['today', 'tomorrow'] } }).toArray();
    for (let doc of docs) {
        const reading = doc.readingData.reading;
        
        const extractCategory = (cat) => {
            const regex = new RegExp(`<strong>${cat}:<\\/strong> (.*?)<\\/li>`, 'i');
            const match = reading.match(regex);
            return match ? match[1] : '';
        };

        const finances = extractCategory('Finances');
        const career = extractCategory('Career');
        const health = extractCategory('Health');
        const love = extractCategory('Love life') + ' ' + extractCategory('Married life');
        
        const moneyStat = analyzeText(finances);
        const careerStat = analyzeText(career);
        const healthStat = analyzeText(health);
        const loveStat = analyzeText(love);
        
        const avgScore = (moneyStat.value + careerStat.value + healthStat.value + loveStat.value) / 4;
        let mood = '🔮 Neutral';
        if (avgScore >= 75) mood = '🌟 Joyful';
        else if (avgScore >= 60) mood = '✨ Balanced';
        else if (avgScore < 50) mood = '🌊 Reflective';

        const updatedStats = {
            love: loveStat,
            career: careerStat,
            health: healthStat,
            money: moneyStat
        };
        
        const colors = ['Red', 'Blue', 'Green', 'Yellow', 'White', 'Orange', 'Purple', 'Pink'];
        const luckyNumber = Math.floor(Math.random() * 9) + 1;
        const color = colors[Math.floor(Math.random() * colors.length)];

        await collection.updateOne(
            { _id: doc._id },
            { $set: { 
                "readingData.stats": updatedStats, 
                "readingData.mood": mood,
                "readingData.luckyNumber": luckyNumber,
                "readingData.color": color
              } 
            }
        );
        console.log(`Updated stats for ${doc.sign}`);
    }
    console.log("Done!");
    process.exit(0);
}

fix().catch(console.error);
