const mongoose = require('mongoose');
const fs = require('fs');

async function main() {
    const uri = "mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk";
    
    try {
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const walletTransactionsColl = db.collection('wallettransactions');
        const usersColl = db.collection('users');
        const astrologersColl = db.collection('astrologers');

        const startDate = new Date('2026-06-01T00:00:00.000Z');
        const endDate = new Date('2026-06-29T23:59:59.999Z');

        // 1. Users who recharged wallet
        const recharges = await walletTransactionsColl.aggregate([
            {
                $match: {
                    type: 'recharge',
                    status: 'completed',
                    createdAt: { $gte: startDate, $lte: endDate },
                    userModel: 'User'
                }
            },
            {
                $group: {
                    _id: '$userId',
                    totalRecharge: { $sum: '$amount' },
                    count: { $sum: 1 },
                    dates: { $push: '$createdAt' }
                }
            }
        ]).toArray();

        // 2. Users who talked with astrologers (calls/chats)
        const sessionPayments = await walletTransactionsColl.aggregate([
            {
                $match: {
                    type: { $in: ['session_payment', 'charge', 'deduction'] },
                    status: 'completed',
                    createdAt: { $gte: startDate, $lte: endDate },
                    userModel: 'User'
                }
            },
            {
                $group: {
                    _id: '$userId',
                    totalSpent: { $sum: '$amount' },
                    sessions: { $sum: 1 },
                    astroIds: { $addToSet: '$relatedAstrologerId' },
                    dates: { $push: '$createdAt' }
                }
            }
        ]).toArray();

        // Construct Markdown
        let md = `# June 2026 Database Analysis Report (1st June - 29th June)\n\n`;

        md += `## 1. Users who recharged their wallet\n`;
        md += `**Total Unique Users:** ${recharges.length}\n\n`;
        md += `| S.No | Name | Phone Number | Total Recharge Amount (₹) | Number of Recharge Transactions | Recharge Dates |\n`;
        md += `|---|---|---|---|---|---|\n`;

        let i = 1;
        for (const r of recharges) {
            const user = await usersColl.findOne({ _id: r._id });
            const datesStr = r.dates.map(d => new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' })).join(', ');
            md += `| ${i++} | ${user?.name || 'N/A'} | ${user?.phoneNumber || 'N/A'} | ₹${r.totalRecharge.toFixed(2)} | ${r.count} | ${datesStr} |\n`;
        }

        md += `\n## 2. Users who talked with astrologers (Calls/Chats)\n`;
        md += `**Total Unique Users:** ${sessionPayments.length}\n\n`;
        md += `| S.No | Name | Phone Number | Total Amount Spent (₹) | Number of Sessions (Calls/Chats) | Astrologer(s) Talked To | Session Dates |\n`;
        md += `|---|---|---|---|---|---|---|\n`;

        i = 1;
        for (const sp of sessionPayments) {
            const user = await usersColl.findOne({ _id: sp._id });
            
            // Fetch Astrologer Names
            let astroNames = [];
            if (sp.astroIds && sp.astroIds.length > 0) {
                const validIds = sp.astroIds.filter(id => id != null);
                if (validIds.length > 0) {
                    const astros = await astrologersColl.find({ _id: { $in: validIds } }).toArray();
                    astroNames = astros.map(a => a.name);
                }
            }
            const astroStr = astroNames.length > 0 ? astroNames.join(', ') : 'N/A';
            const datesStr = sp.dates.map(d => new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' })).join(', ');

            md += `| ${i++} | ${user?.name || 'N/A'} | ${user?.phoneNumber || 'N/A'} | ₹${sp.totalSpent} | ${sp.sessions} | ${astroStr} | ${datesStr} |\n`;
        }

        fs.writeFileSync('june_2026_analysis.md', md);
        console.log(`✅ Artifact saved to june_2026_analysis.md`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

main().catch(console.error);
