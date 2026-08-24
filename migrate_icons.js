const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const getNavIcon = (title) => {
  const t = (title || '').toLowerCase();
  if(t.includes('chat') && t.includes('ai')) return '<svg width="18" height="18" viewBox="0 0 24 24" fill="#cffafe" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>';
  if(t.includes('talk') && t.includes('ai')) return '<svg width="18" height="18" viewBox="0 0 24 24" fill="#f3e8ff" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>';
  if(t.includes('chat')) return '<svg width="18" height="18" viewBox="0 0 24 24" fill="#dcfce7" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  if(t.includes('talk') || t.includes('call')) return '<svg width="18" height="18" viewBox="0 0 24 24" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  if(t.includes('celebrity')) return '👑';
  if(t.includes('daily') || t.includes('today')) return '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fef08a" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>';
  if(t.includes('tomorrow')) return '🔭';
  if(t.includes('weekly')) return '<svg width="18" height="18" viewBox="0 0 24 24" fill="#e0e7ff" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>';
  if(t.includes('monthly')) return '🌕';
  if(t.includes('yearly')) return '🪐';
  if(t.includes('blog') || t.includes('insight')) return '📰';
  if(t.includes('faq')) return '💬';
  if(t.includes('matrimony')) return '💞';
  if(t.includes('rudrabhishek') || t.includes('shiv') || t.includes('mahamrityunjay')) return '🕉️';
  if(t.includes('mangal')) return '🔴';
  if(t.includes('hanuman')) return '🚩';
  if(t.includes('job') || t.includes('career') || t.includes('business')) return '💼';
  if(t.includes('money') || t.includes('dhan')) return '💰';
  if(t.includes('ganesh') || t.includes('ganapati')) return '🐘';
  if(t.includes('vishnu') || t.includes('satyanarayan')) return '🐚';
  if(t.includes('shani')) return '🪐';
  if(t.includes('rahu') || t.includes('ketu')) return '🌑';
  if(t.includes('attract your love')) return '🧲';
  if(t.includes('commitment')) return '💍';
  if(t.includes('love') || t.includes('marriage') || t.includes('spell')) return '💖';
  if(t.includes('heal')) return '🌿';
  if(t.includes('learn') || t.includes('course')) return '📚';
  if(t.includes('puja') || t.includes('pooja')) return '🪔';
  if(t.includes('kundali matching') || t.includes('kundli matching')) return '💑';
  if(t.includes('smart kundali') || t.includes('smart kundli')) return '🔮';
  if(t.includes('kundli') || t.includes('kundali')) return '🕉️';
  if(t.includes('flame')) return '❤️‍🔥';
  if(t.includes('love') || t.includes('match') || t.includes('compatibility')) return '💖';
  if(t.includes('numerology') || t.includes('destiny')) return '🔢';
  if(t.includes('nakshatra')) return '🌟';
  if(t.includes('sade sati')) return '🪐';
  if(t.includes('rudraksha')) return '📿';
  if(t.includes('gemstone')) return '💎';
  if(t.includes('muhurat')) return '🔔';
  if(t.includes('date')) return '📆';
  if(t.includes('color')) return '🎨';
  if(t.includes('lal kitab')) return '📕';
  if(t.includes('baby')) return '👶';
  if(t.includes('moon')) return '🌙';
  if(t.includes('rashi')) return '🧿';
  if(t.includes('chinese')) return '🐉';
  if(t.includes('festival')) return '🎉';
  if(t.includes('panchang')) return '📜';
  if(t.includes('rahu')) return '🌑';
  if(t.includes('atlas') || t.includes('location')) return '🗺️';
  if(t.includes('horoscope') || t.includes('report')) return '📜';
  if(t.includes('kaal sarp')) return '🐍';
  if(t.includes('occult')) return '👁️';
  return '⭐';
};

async function migrateIcons() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    // Migrate Menus
    const menuSchema = new mongoose.Schema({ title: String, icon: String }, { strict: false });
    const Menu = mongoose.models.Menu || mongoose.model('Menu', menuSchema);

    let menus = await Menu.find({});
    let updatedMenus = 0;
    for (let menu of menus) {
      if (!menu.icon) {
        menu.icon = getNavIcon(menu.title);
        await menu.save();
        updatedMenus++;
      }
    }
    console.log(`Updated ${updatedMenus} menus`);

    // Migrate Pujas
    const pujaSchema = new mongoose.Schema({ title: String, icon: String }, { strict: false });
    const Puja = mongoose.models.Puja || mongoose.model('Puja', pujaSchema);

    let pujas = await Puja.find({});
    let updatedPujas = 0;
    for (let puja of pujas) {
      if (!puja.icon) {
        puja.icon = getNavIcon(puja.title);
        await puja.save();
        updatedPujas++;
      }
    }
    console.log(`Updated ${updatedPujas} pujas`);

    console.log('Migration complete');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

migrateIcons();
