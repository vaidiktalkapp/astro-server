const http = require('http');

const festivals = [
    {
        name: "Maha Shivaratri",
        slug: "maha-shivaratri-2026",
        date: "2026-02-14",
        tithi: "Chaturdashi",
        month: "Phalguna",
        deity: "Lord Shiva",
        description: "The Great Night of Shiva, marking the convergence of Shiva and Shakti. Devotees perform night-long vigils and fasting.",
        rituals: ["Strict fasting", "Offering Bael leaves to the Lingam", "Night-long Jagaran (vigil)", "Chanting Om Namah Shivaya"],
        muhurat: "Nishita Kaal Puja: 12:09 AM to 01:00 AM",
        color: "#1e3a8a",
        isMajor: true
    },
    {
        name: "Holi",
        slug: "holi-2026",
        date: "2026-03-03",
        tithi: "Purnima",
        month: "Phalguna",
        deity: "Lord Krishna / Holika",
        description: "The Festival of Colors, celebrating the eternal and divine love of Radha Krishna, and the triumph of good over evil.",
        rituals: ["Holika Dahan on the previous night", "Playing with colors (Gulal)", "Distributing sweets like Gujiya"],
        muhurat: "Holika Dahan: 06:14 PM to 08:39 PM (March 2)",
        color: "#e11d48",
        isMajor: true
    },
    {
        name: "Chaitra Navratri",
        slug: "chaitra-navratri-2026",
        date: "2026-03-19",
        endDate: "2026-03-27",
        tithi: "Pratipada to Navami",
        month: "Chaitra",
        deity: "Goddess Durga",
        description: "Nine days dedicated to the worship of the nine divine forms of Goddess Durga, marking the Hindu New Year in many regions.",
        rituals: ["Ghatasthapana", "Nine days of fasting", "Kanya Pujan on Ashtami/Navami"],
        muhurat: "Ghatasthapana: 06:26 AM to 10:48 AM",
        color: "#ea580c",
        isMajor: true
    },
    {
        name: "Rama Navami",
        slug: "rama-navami-2026",
        date: "2026-03-27",
        tithi: "Navami",
        month: "Chaitra",
        deity: "Lord Rama",
        description: "Celebrates the birth of Lord Rama, the seventh avatar of Lord Vishnu, born in Ayodhya.",
        rituals: ["Reading Ramayana", "Offering Panakam and Neer Mor", "Rath Yatras"],
        muhurat: "Madhyahna Muhurat: 11:12 AM to 01:40 PM",
        color: "#fbbf24",
        isMajor: true
    },
    {
        name: "Hanuman Jayanti",
        slug: "hanuman-jayanti-2026",
        date: "2026-04-14",
        tithi: "Purnima",
        month: "Chaitra",
        deity: "Lord Hanuman",
        description: "Celebrates the birth of Lord Hanuman, the devoted servant of Lord Rama and the embodiment of strength and devotion.",
        rituals: ["Reciting Hanuman Chalisa", "Offering sindoor and oil", "Visiting Hanuman temples", "Distributing prasad"],
        muhurat: "Sunrise to Sunset",
        color: "#dc2626",
        isMajor: true
    },
    {
        name: "Akshaya Tritiya",
        slug: "akshaya-tritiya-2026",
        date: "2026-04-26",
        tithi: "Tritiya",
        month: "Vaishakha",
        deity: "Lord Vishnu / Goddess Lakshmi",
        description: "One of the most auspicious days in the Hindu calendar. Any investment or venture begun on this day is believed to bring success and prosperity.",
        rituals: ["Buying gold or property", "Performing Lakshmi Puja", "Charity and donations", "Starting new ventures"],
        muhurat: "Entire day is auspicious",
        color: "#ca8a04",
        isMajor: true
    },
    {
        name: "Guru Purnima",
        slug: "guru-purnima-2026",
        date: "2026-07-11",
        tithi: "Purnima",
        month: "Ashadha",
        deity: "Vyasa / Guru (Teacher)",
        description: "A festival dedicated to spiritual and academic gurus. It marks the birthday of Vyasa, the author of the Mahabharata.",
        rituals: ["Honoring one's Guru", "Offering Guru Dakshina", "Meditation and spiritual practices"],
        muhurat: "Full day auspicious for Guru Puja",
        color: "#7c3aed",
        isMajor: false
    },
    {
        name: "Raksha Bandhan",
        slug: "raksha-bandhan-2026",
        date: "2026-08-28",
        tithi: "Purnima",
        month: "Shravana",
        deity: "None",
        description: "A festival celebrating the bond of protection, love, and care between brothers and sisters.",
        rituals: ["Tying the Rakhi", "Aarti", "Exchanging gifts and sweets"],
        muhurat: "Aparahna Time: 01:42 PM to 04:18 PM",
        color: "#f43f5e",
        isMajor: false
    },
    {
        name: "Janmashtami",
        slug: "krishna-janmashtami-2026",
        date: "2026-09-04",
        tithi: "Ashtami",
        month: "Bhadrapada",
        deity: "Lord Krishna",
        description: "The celebration of the birth of Lord Krishna, the eighth avatar of Vishnu.",
        rituals: ["Midnight birth celebrations", "Fasting until midnight", "Dahi Handi on the next day"],
        muhurat: "Nishita Puja Time: 11:58 PM to 12:44 AM",
        color: "#3b82f6",
        isMajor: true
    },
    {
        name: "Ganesh Chaturthi",
        slug: "ganesh-chaturthi-2026",
        date: "2026-09-12",
        tithi: "Chaturthi",
        month: "Bhadrapada",
        deity: "Lord Ganesha",
        description: "Ten-day festival celebrating the birth of Lord Ganesha, the remover of obstacles and god of beginnings.",
        rituals: ["Installing Ganesh idol at home", "Modak offering", "Aarti and Puja daily", "Visarjan on 10th day"],
        muhurat: "Madhyahna Muhurat: 11:05 AM to 01:35 PM",
        color: "#ea580c",
        isMajor: true
    },
    {
        name: "Sharad Navratri",
        slug: "sharad-navratri-2026",
        date: "2026-10-18",
        endDate: "2026-10-26",
        tithi: "Pratipada to Navami",
        month: "Ashvin",
        deity: "Goddess Durga",
        description: "The most celebrated Navratri of the year. Nine nights of worship, Garba, and Dandiya celebrating the victory of Goddess Durga.",
        rituals: ["Ghatasthapana", "Nine days of fasting", "Garba and Dandiya nights", "Kanya Pujan and Havan"],
        muhurat: "Ghatasthapana: 06:15 AM to 07:22 AM",
        color: "#dc2626",
        isMajor: true
    },
    {
        name: "Dussehra",
        slug: "dussehra-2026",
        date: "2026-10-27",
        tithi: "Dashami",
        month: "Ashvin",
        deity: "Lord Rama / Goddess Durga",
        description: "Victory of Lord Rama over Ravana and of Goddess Durga over Mahishasura. Symbolizes the triumph of good over evil.",
        rituals: ["Ravana Dahan (effigy burning)", "Weapon worship (Shastra Puja)", "Processions and cultural programs"],
        muhurat: "Vijay Muhurat: 02:02 PM to 02:48 PM",
        color: "#b45309",
        isMajor: true
    },
    {
        name: "Diwali",
        slug: "diwali-2026",
        date: "2026-11-08",
        tithi: "Amavasya",
        month: "Kartika",
        deity: "Goddess Lakshmi / Lord Ganesha",
        description: "The Festival of Lights, signifying the victory of light over darkness, knowledge over ignorance, and good over evil.",
        rituals: ["Lighting Diyas", "Lakshmi Puja", "Distributing sweets and gifts", "Fireworks"],
        muhurat: "Lakshmi Puja Time: 05:32 PM to 07:28 PM",
        color: "#ca8a04",
        isMajor: true
    },
    {
        name: "Govardhan Puja",
        slug: "govardhan-puja-2026",
        date: "2026-11-09",
        tithi: "Pratipada",
        month: "Kartika",
        deity: "Lord Krishna",
        description: "Celebrates the day Lord Krishna lifted the Govardhan Hill to protect the villagers of Vrindavan from torrential rains sent by Lord Indra.",
        rituals: ["Making Annakut (mountain of food)", "Go Puja (cow worship)", "Govardhan Parikrama"],
        muhurat: "Morning: 06:36 AM to 08:49 AM",
        color: "#16a34a",
        isMajor: false
    },
    {
        name: "Bhai Dooj",
        slug: "bhai-dooj-2026",
        date: "2026-11-10",
        tithi: "Dwitiya",
        month: "Kartika",
        deity: "Yama (God of Death) / Yamuna",
        description: "Sisters pray for their brothers' long life and prosperity. Brothers give gifts to their sisters.",
        rituals: ["Tilak ceremony by sister", "Special meals together", "Gift exchange"],
        muhurat: "Aparahna Time: 01:11 PM to 03:24 PM",
        color: "#ec4899",
        isMajor: false
    },
    {
        name: "Dev Deepawali",
        slug: "dev-deepawali-2026",
        date: "2026-11-23",
        tithi: "Purnima",
        month: "Kartika",
        deity: "Lord Shiva / All Gods",
        description: "The Diwali of the Gods. Celebrated in Varanasi with millions of lamps on the ghats of the Ganga. Marks when gods descend to earth.",
        rituals: ["Lighting diyas on river ghats", "Holy bath in Ganga", "Deep daan (lamp donation)"],
        muhurat: "Pradosh Kaal: 05:25 PM to 08:02 PM",
        color: "#0ea5e9",
        isMajor: false
    }
];

function postFestival(fest, index) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(fest);
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: '/api/v1/festivals',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log(`✅ [${index + 1}/${festivals.length}] ${fest.name}`);
                    resolve();
                } else {
                    console.log(`⚠️ [${index + 1}/${festivals.length}] ${fest.name}: ${body}`);
                    resolve(); // Don't reject, could be a duplicate
                }
            });
        });
        req.on('error', (err) => {
            console.log(`❌ [${index + 1}/${festivals.length}] ${fest.name}: ${err.message}`);
            reject(err);
        });
        req.write(data);
        req.end();
    });
}

async function seed() {
    console.log(`\n🕉️  Seeding ${festivals.length} festivals...\n`);
    for (let i = 0; i < festivals.length; i++) {
        await postFestival(festivals[i], i);
    }
    console.log('\n🎉 Done!\n');
}

seed();
