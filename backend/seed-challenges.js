// Script to seed practical default challenges into the database.
const { query } = require('./src/config/database');

const defaultChallenges = [
  {
    title: 'No-Spend Weekend',
    description: 'Avoid non-essential spending from Saturday morning through Sunday night.',
    challenge_type: 'no_spend',
    target_amount: null,
    target_days: 2,
    xp_reward: 60,
    difficulty: 'easy'
  },
  {
    title: 'Save GH\u20b550 This Week',
    description: 'Move GH\u20b550 into savings before the week ends.',
    challenge_type: 'save_amount',
    target_amount: 50,
    target_days: 7,
    xp_reward: 80,
    difficulty: 'easy'
  },
  {
    title: 'Bill-Ready Week',
    description: 'Set aside GH\u20b5100 toward upcoming bills before their due dates.',
    challenge_type: 'save_amount',
    target_amount: 100,
    target_days: 7,
    xp_reward: 100,
    difficulty: 'easy'
  },
  {
    title: 'Subscription Sweep',
    description: 'Review your subscriptions and cancel or pause one plan you do not use.',
    challenge_type: 'custom',
    target_amount: null,
    target_days: 3,
    xp_reward: 90,
    difficulty: 'easy'
  },
  {
    title: 'Lunchbox Week',
    description: 'Prepare meals or snacks and keep food spending under GH\u20b5120 for five days.',
    challenge_type: 'reduce_category',
    target_amount: 120,
    target_days: 5,
    xp_reward: 110,
    difficulty: 'medium'
  },
  {
    title: 'Transport Trim',
    description: 'Reduce trotro, fuel, taxi, or ride-hailing spending by 25% for one week.',
    challenge_type: 'reduce_category',
    target_amount: null,
    target_days: 7,
    xp_reward: 120,
    difficulty: 'medium'
  },
  {
    title: 'Data Detox',
    description: 'Keep airtime and mobile data spending under GH\u20b540 for seven days.',
    challenge_type: 'reduce_category',
    target_amount: 40,
    target_days: 7,
    xp_reward: 120,
    difficulty: 'medium'
  },
  {
    title: 'Rent Buffer Builder',
    description: 'Save GH\u20b5250 toward rent, hostel, or home costs before month-end.',
    challenge_type: 'save_amount',
    target_amount: 250,
    target_days: 30,
    xp_reward: 170,
    difficulty: 'medium'
  },
  {
    title: 'Emergency Starter Fund',
    description: 'Build a GH\u20b5500 cushion for surprise expenses over the next 45 days.',
    challenge_type: 'save_amount',
    target_amount: 500,
    target_days: 45,
    xp_reward: 240,
    difficulty: 'hard'
  },
  {
    title: 'No Betting Week',
    description: 'Avoid betting, gaming, and impulse entertainment expenses for seven days.',
    challenge_type: 'no_spend',
    target_amount: null,
    target_days: 7,
    xp_reward: 180,
    difficulty: 'hard'
  },
  {
    title: '30-Day Money Streak',
    description: 'Log your spending or savings activity every day for 30 days.',
    challenge_type: 'streak',
    target_amount: null,
    target_days: 30,
    xp_reward: 320,
    difficulty: 'extreme'
  }
];

async function seedChallenges() {
  try {
    console.log('Seeding practical challenges...');

    let created = 0;
    let skipped = 0;

    for (const challenge of defaultChallenges) {
      const result = await query(
        `INSERT INTO savings_challenges
         (title, description, challenge_type, target_amount, target_days, xp_reward, difficulty)
         SELECT $1, $2, $3, $4, $5, $6, $7
         WHERE NOT EXISTS (
           SELECT 1 FROM savings_challenges WHERE LOWER(title) = LOWER($1)
         )
         RETURNING id, title`,
        [
          challenge.title,
          challenge.description,
          challenge.challenge_type,
          challenge.target_amount,
          challenge.target_days,
          challenge.xp_reward,
          challenge.difficulty
        ]
      );

      if (result.rows.length) {
        created += 1;
        console.log(`  Created: ${result.rows[0].title}`);
      } else {
        skipped += 1;
        console.log(`  Already exists: ${challenge.title}`);
      }
    }

    console.log(`\nDone. Created ${created}, skipped ${skipped}.`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding challenges:', error.message);
    process.exit(1);
  }
}

seedChallenges();
