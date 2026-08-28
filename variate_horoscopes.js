require('dotenv').config();
const mongoose = require('mongoose');

// Variation dictionary
const variations = {
    'steady this day, with a chance of minor monetary benefits': [
        "Your financial foundation looks secure today, bringing subtle opportunities for extra income.",
        "You can expect a stable financial environment today, potentially highlighted by small, unexpected gains.",
        "Monetary matters should remain balanced today, and a minor financial perk could come your way.",
        "Today promises financial stability, with a slight possibility of receiving a small monetary bonus.",
        "Finances look solid and steady right now, offering a subtle chance for minor wealth accumulation.",
        "Expect a smooth financial day, which might even include a small, pleasant monetary surprise."
    ],
    'unlikely to face any major financial setbacks in your financial dealings this day': [
        "You should experience smooth sailing in your financial transactions today, with minimal risks of loss.",
        "It is a highly secure day for your finances, keeping major setbacks well out of your path.",
        "Your financial dealings are protected today, ensuring you avoid any significant monetary hurdles.",
        "Today's cosmic energy shields your finances, making significant setbacks highly improbable.",
        "Expect your monetary matters to proceed without any major friction or unexpected losses today.",
        "Financial stability is your ally today, preventing any major disruptions in your economic plans."
    ],
    'decline in your financial situation, which may impact your financial capability': [
        "A temporary dip in your finances could require you to tighten your budget today.",
        "You might experience slight financial turbulence today, urging you to be more cautious with spending.",
        "Cosmic alignments suggest a minor financial slowdown, which could briefly limit your purchasing power.",
        "Be mindful of your expenses today, as a subtle decline in cash flow might affect your plans.",
        "Your financial capacity might feel slightly restricted today due to unexpected minor expenses."
    ],
    'very auspicious day for making your financial plans successful': [
        "The stars align perfectly today to bring your financial strategies and plans to fruition.",
        "This is an exceptionally fortunate day to execute your financial plans and see them succeed.",
        "Cosmic blessings surround your finances today, making it a prime time for monetary success.",
        "Your financial endeavors are highly favored today, paving the way for lucrative outcomes.",
        "A highly prosperous energy surrounds you today, ensuring success in your monetary planning."
    ],
    'carefully consider financial issues, which could slow down your financial processes': [
        "Take a moment to review your finances today; careful planning is needed even if it delays things.",
        "You may need to pause and assess your financial situation today, causing a temporary slowdown.",
        "A cautious approach to money matters is advised today, even if it means halting some financial processes.",
        "Prudence is key today; reviewing your financial strategies might temporarily pause your progress."
    ],
    
    // CAREER
    'fresh golden opportunities in your professional life this day': [
        "Exciting new prospects are likely to emerge in your career today, offering a chance to shine.",
        "Today could bring brilliant new professional opportunities that align perfectly with your career goals.",
        "Keep an eye out for golden career advancements today that could significantly boost your professional standing.",
        "The workplace holds promising new avenues for you today, ready to be explored.",
        "A wave of fresh, lucrative opportunities is set to enter your professional life today.",
        "Career growth is highly favored today, with new and exciting pathways opening up for you."
    ],
    'decline in productivity, planning ahead might seem challenging. Consider improving your skills': [
        "You might feel a slight dip in motivation today; focusing on skill development can help you bounce back.",
        "Productivity could be a struggle today, making it a perfect time to step back and refine your professional skills.",
        "Planning may feel overwhelming today due to lower energy levels, so focus on small skill-building tasks.",
        "A temporary slump at work could challenge your planning, but investing time in learning will pay off.",
        "Work might feel sluggish today; counter this by dedicating time to self-improvement and upskilling.",
        "You may face challenges in maintaining focus today; try brushing up on your core professional skills."
    ],
    'increased pressure and instability in your professional sphere this day': [
        "Workplace demands might feel heavy today, bringing a sense of unpredictability to your tasks.",
        "You could face a high-pressure environment at work today, requiring extra patience and adaptability.",
        "Professional stress levels might be elevated today, urging you to stay calm and grounded.",
        "The professional sphere could seem chaotic today; remember to take things one step at a time."
    ],

    // LOVE
    'take a backseat this day due to personal commitments': [
        "Romance might need to wait today as your personal responsibilities demand your full attention.",
        "Your personal schedule is packed today, leaving little room for romantic endeavors.",
        "Love matters may be temporarily paused today while you focus on pressing personal commitments.",
        "With so much on your plate today, your romantic life might gently be placed on hold.",
        "Personal duties take precedence today, meaning romantic plans might need to be rescheduled.",
        "You may find that personal obligations overshadow your romantic interests for the time being."
    ],
    'filled with profound joy this day': [
        "Expect your romantic life to overflow with deep happiness and meaningful connections today.",
        "Today brings immense joy and harmony to your romantic relationships, deepening your bonds.",
        "A wave of profound happiness is set to wash over your love life today.",
        "Your romantic connections will be a source of immense bliss and comfort today.",
        "Love is in the air, promising a day filled with deep emotional satisfaction and joy.",
        "You and your partner (or a potential interest) will share profoundly joyful moments today."
    ],
    'arrange a romantic dinner outing or prefer spending quiet evenings together': [
        "A cozy evening or a special dinner date will bring you and your partner closer today.",
        "Spending quality, peaceful time with your significant other is highly favored this evening.",
        "Whether it's a romantic dinner or a quiet night in, today is perfect for couples to connect.",
        "Focus on creating intimate, quiet moments with your partner to strengthen your bond today."
    ],
    'fear some misunderstandings arising this day': [
        "Be mindful of your communication today to prevent small misunderstandings with your partner.",
        "A lack of clarity could cause slight friction in your relationship today, so speak openly.",
        "Tread carefully in your conversations today to avoid unnecessary romantic misunderstandings.",
        "Patience is required today, as minor miscommunications could momentarily disrupt romantic harmony."
    ],
    'disagreement with your partner is possible this day': [
        "A difference of opinion might arise with your partner today; approach it with a calm mind.",
        "You may experience slight friction in your relationship today, requiring patience and understanding.",
        "Conflicts of interest could briefly surface in your love life today, but they can be resolved gently.",
        "Stay composed, as a minor disagreement with your significant other is possible today."
    ],

    // HEALTH
    'Eating nutritious food this day may clearly boost your well-being': [
        "Focusing on a balanced, healthy diet today will significantly enhance your physical vitality.",
        "Nourishing your body with wholesome foods today will directly improve your overall health.",
        "Your energy levels will soar today if you prioritize nutritious meals and stay hydrated.",
        "A mindful approach to your diet today will bring immediate benefits to your physical well-being.",
        "Choosing healthy, nutrient-rich foods today is the key to maintaining your vibrant energy.",
        "Your health will greatly benefit from clean eating and mindful nutritional choices today."
    ]
};

function variate(text) {
    let result = text;
    for (const [key, options] of Object.entries(variations)) {
        if (result.includes(key)) {
            const randomOption = options[Math.floor(Math.random() * options.length)];
            result = result.replace(key, randomOption);
        }
    }
    return result;
}

async function fix() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const collection = db.collection('manualhoroscopes');

    const docs = await collection.find({ period: 'today' }).toArray();
    for (let doc of docs) {
        let reading = doc.readingData.reading;
        let preview = doc.readingData.previewText;

        // Apply variations
        reading = variate(reading);
        preview = variate(preview);

        await collection.updateOne(
            { _id: doc._id },
            { $set: { "readingData.reading": reading, "readingData.previewText": preview } }
        );
        console.log(`Variated ${doc.sign}`);
    }
    console.log("Done!");
    process.exit(0);
}

fix().catch(console.error);
