export interface RashiDetails {
    sanskritName: string;
    englishName: string;
    classics: string;
    symbol: string;
    traits: {
        strength: string;
        power: string;
        insight: string;
    };
}

export const RASHI_CLASSICS: Record<string, RashiDetails> = {
    Aries: {
        sanskritName: "Mesha",
        englishName: "Aries",
        symbol: "♈",
        classics: "Courageous and adventurous, but prone to impulsive reactions. Physical traits include a broad forehead and medium height. You may suffer from blood-related ailments or skin issues on the face. Sensitive ages for health are 7, 12, 16, and 30. Your lucky days are Tuesday and Friday. You possess a fiery spirit and often lead with initiative, though you must guard against quick anger and restlessness.",
        traits: {
            strength: "Immense physical vitality and the daring courage to conquer new frontiers.",
            power: "Natural ability to initiate action and lead from the front with bold confidence.",
            insight: "Governs swift primal instincts and a fiercely independent sense of self-awareness."
        }
    },
    Taurus: {
        sanskritName: "Vrishabha",
        englishName: "Taurus",
        symbol: "♉",
        classics: "Patient, persistent, and grounded. You have a beautiful face and a steady gaze, often with a robust physical build. You find emotional security in material stability and routine. Sensitive ages are 1, 33, 44, and 61. Major gains come through persistence. You may face issues related to the throat or neck. Lucky days are Wednesday and Friday. Once committed, you are deeply loyal but can be incredibly stubborn when pushed.",
        traits: {
            strength: "Incredible resilience and the patience to weather any storm with grace.",
            power: "Unmatched capacity to build and sustain long-term wealth, value, and comfort.",
            insight: "Deep instinctual connection to the earthly realm, nature, and the five senses."
        }
    },
    Gemini: {
        sanskritName: "Mithuna",
        englishName: "Gemini",
        symbol: "♊",
        classics: "Talkative, curious, and dual-minded. You possess a quick wit and expressive hands. Your intellect is your greatest asset. Sensitive ages are 32, 33, 35, and 36. You may suffer from ailments related to the lungs or respiratory system. Your lucky day is Thursday. You thrive on variety and communication, though you may struggle with consistency and decision-making due to your multifaceted nature.",
        traits: {
            strength: "Brilliant adaptability and the skill to thrive in constantly changing situations.",
            power: "The power to persuade, articulate, and connect vast, disparate ideas instantly.",
            insight: "Governs the cognitive intellect and the ability to examine all perspectives."
        }
    },
    Cancer: {
        sanskritName: "Karka",
        englishName: "Cancer",
        symbol: "♋",
        classics: "Emotional, sensitive, and deeply attached to home. You have a round face and expressive eyes. You are highly intuitive and nurturing. Sensitive ages for major life changes are 12, 18, 22, and 24. You may have a fear of water and should be careful with stomach-related issues. Your lucky day is Monday. You are the protector of the family, though your moods can change as rapidly as the moon's phases.",
        traits: {
            strength: "Fierce loyalty to family and a deeply protective emotional endurance.",
            power: "Innate ability to nurture, heal, and cultivate profound emotional connections.",
            insight: "Governs psychic receptivity and profound subconscious empathy."
        }
    },
    Leo: {
        sanskritName: "Simha",
        englishName: "Leo",
        symbol: "♌",
        classics: "Royal, dominating, and warm-hearted. You possess a majestic physical presence and a strong spine. You seek recognition and respect. Sensitive ages are 5, 13, 17, 28, and 35. You may suffer from issues related to the heart or stomach. Your lucky days are Sunday and Tuesday. You are a natural leader with a generous soul, though your pride can sometimes lead to conflicts with authority.",
        traits: {
            strength: "Unshakable self-belief and a radiant auric presence in any setting.",
            power: "Natural authority to command respect, inspire others, and magnify light.",
            insight: "Deep intuitive knowing of one's creative destiny and heart-centered truth."
        }
    },
    Virgo: {
        sanskritName: "Kanya",
        englishName: "Virgo",
        symbol: "♍",
        classics: "Analytical, thoughtful, and service-oriented. You have a lean build and a quiet, observant nature. You value purity and order. Sensitive ages are 22, 25, 30, and 31. You may be prone to skin disorders or digestive issues. Your lucky day is Wednesday. You have a sharp eye for detail and excel in tasks requiring calculation, though you can be overly self-critical and prone to worry.",
        traits: {
            strength: "Meticulous discipline and the capacity to perfect and refine processes effortlessly.",
            power: "The ability to heal, organize complex chaos, and serve with pure intention.",
            insight: "Highly attuned discrimination that easily separates truth from illusion."
        }
    },
    Libra: {
        sanskritName: "Tula",
        englishName: "Libra",
        symbol: "♎",
        classics: "Balanced, harmonious, and relationship-focused. You have a pleasant appearance and a diplomatic personality. You seek justice and fairness. Sensitive ages are 1, 31, 32, 33, and 35. You may face issues related to the kidneys or lower back. Your lucky days are Friday and Monday. You are highly social and aesthetic, but your desire for balance can sometimes lead to indecisiveness.",
        traits: {
            strength: "Incredible diplomacy and the endurance to maintain harmony through conflicts.",
            power: "Ability to mirror others, forge powerful alliances, and attract material abundance.",
            insight: "Governs the instinct for aesthetic balance, justice, and interpersonal grace."
        }
    },
    Scorpio: {
        sanskritName: "Vrischika",
        englishName: "Scorpio",
        symbol: "♏",
        classics: "Intense, secretive, and perceptive. You have piercing eyes and a strong, magnetic personality. You crave transformative emotional depth. Sensitive ages are 11, 23, 28, and 44. You may suffer from reproductive or excretory issues. Your lucky day is Tuesday. You are incredibly resourceful and resilient, though your intense nature can lead to deep-seated grudges if you feel betrayed.",
        traits: {
            strength: "Unbreakable psychological resilience and the capacity to survive extreme transformations.",
            power: "Command over hidden resources, profound strategic depth, and piercing focus.",
            insight: "Penetrating awareness of hidden motives, occult truths, and the subconscious."
        }
    },
    Sagittarius: {
        sanskritName: "Dhanu",
        englishName: "Sagittarius",
        symbol: "♐",
        classics: "Optimistic, truthful, and philosophical. You have a broad forehead and a sturdy build, often with strong thighs. You are a natural truth-seeker. Sensitive ages are 2, 10, 18, 20, 33, and 38. You may face issues related to the liver or hips. Your lucky day is Thursday. You possess an adventurous spirit and deep wisdom, though your blunt honesty can sometimes be perceived as tactlessness.",
        traits: {
            strength: "Boundless optimism and a resilient faith that transcends earthly setbacks.",
            power: "Capacity to expand consciousness, teach ancient wisdom, and discover ultimate truth.",
            insight: "Governs the higher mind, prophetic visions, and an attuned sense of purpose."
        }
    },
    Capricorn: {
        sanskritName: "Makara",
        englishName: "Capricorn",
        symbol: "♑",
        classics: "Hardworking, disciplined, and practical. You have a medium height and a determined gaze. You find security through responsibility and long-term goals. Sensitive ages include 8, 16, 20, 30, 34, 44, and 59. You may suffer from skin disorders or knee-related ailments. Between 40-60 years, watch for appendix issues. Your lucky days are Wednesday, Saturday, and Friday. You are a steady achiever, though your cautious nature can sometimes lead to miserliness or melancholy.",
        traits: {
            strength: "Iron-clad discipline, monumental patience, and strict karmic endurance.",
            power: "The unmatched ability to climb social hierarchies and build lasting legacies.",
            insight: "Profound understanding of time, duty, action, and karmic consequence."
        }
    },
    Aquarius: {
        sanskritName: "Kumbha",
        englishName: "Aquarius",
        symbol: "♒",
        classics: "Independent, unique, and philosophical. You have a friendly but detached nature and often possess strong legs and ankles. You seek intellectual freedom and progress. Sensitive ages are 7, 12, 25, 27, and 29. You may face issues related to blood circulation or the calves. Your lucky days are Thursday and Friday. You are a visionary who cares for humanity, though your progressive ideas can make you appear aloof to others.",
        traits: {
            strength: "Radical independence and the fortitude to stand against immense societal pressures.",
            power: "Capacity to channel progressive, humanitarian visions that shift collective realities.",
            insight: "Governs detached universal awareness and sudden strokes of genius intuition."
        }
    },
    Pisces: {
        sanskritName: "Meena",
        englishName: "Pisces",
        symbol: "♓",
        classics: "Spiritual, dreamy, and deeply empathetic. You have soft, soulful eyes and a gentle presence. You are highly intuitive and emotionally connected. Sensitive ages are 1, 3, 22, 25, and 28. You may be prone to ailments of the feet or toes. Your lucky days are Monday and Thursday. You find peace through creativity and solitude, though you must guard against your tendency to absorb the emotional burdens of the people around you.",
        traits: {
            strength: "Boundless spiritual endurance and the empathy to carry the weight of others.",
            power: "The power of emotional surrender, artistic flow, and manifesting through imagination.",
            insight: "Deepest access to the collective unconscious, dreams, and mystical knowing."
        }
    }
};
