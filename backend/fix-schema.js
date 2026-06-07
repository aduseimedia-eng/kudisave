const { pool } = require('./src/config/database');
require('dotenv').config();

async function fix() {
  const client = await pool.connect();
  try {
    // 1. Add missing is_paid column to bill_reminders
    console.log('Adding is_paid column to bill_reminders...');
    await client.query(`ALTER TABLE bill_reminders ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE`);
    console.log('✅ is_paid column added');

    // 2. Create the upcoming_bills view (now that is_paid exists)
    console.log('Creating upcoming_bills view...');
    await client.query(`
      CREATE OR REPLACE VIEW upcoming_bills AS
      SELECT 
          br.*,
          CASE 
              WHEN due_date <= CURRENT_DATE THEN 'overdue'
              WHEN due_date <= CURRENT_DATE + reminder_days_before THEN 'due_soon'
              ELSE 'upcoming'
          END as status,
          due_date - CURRENT_DATE as days_until_due
      FROM bill_reminders br
      WHERE is_active = TRUE AND (is_paid = FALSE OR frequency != 'once')
      ORDER BY due_date ASC
    `);
    console.log('✅ upcoming_bills view created');

    // 3. Insert savings_challenges seed data if empty
    const count = await client.query(`SELECT COUNT(*) FROM savings_challenges`);
    if (parseInt(count.rows[0].count) === 0) {
      console.log('Inserting savings challenge seed data...');
      await client.query(`
        INSERT INTO savings_challenges (title, description, challenge_type, target_amount, target_days, xp_reward, difficulty) VALUES
          ('No-Spend Weekend', 'Avoid non-essential spending from Saturday morning through Sunday night.', 'no_spend', NULL, 2, 60, 'easy'),
          ('Save GH\u20b550 This Week', 'Move GH\u20b550 into savings before the week ends.', 'save_amount', 50, 7, 80, 'easy'),
          ('Bill-Ready Week', 'Set aside GH\u20b5100 toward upcoming bills before their due dates.', 'save_amount', 100, 7, 100, 'easy'),
          ('Subscription Sweep', 'Review your subscriptions and cancel or pause one plan you do not use.', 'custom', NULL, 3, 90, 'easy'),
          ('Lunchbox Week', 'Prepare meals or snacks and keep food spending under GH\u20b5120 for five days.', 'reduce_category', 120, 5, 110, 'medium'),
          ('Transport Trim', 'Reduce trotro, fuel, taxi, or ride-hailing spending by 25% for one week.', 'reduce_category', NULL, 7, 120, 'medium'),
          ('Data Detox', 'Keep airtime and mobile data spending under GH\u20b540 for seven days.', 'reduce_category', 40, 7, 120, 'medium'),
          ('Rent Buffer Builder', 'Save GH\u20b5250 toward rent, hostel, or home costs before month-end.', 'save_amount', 250, 30, 170, 'medium'),
          ('Emergency Starter Fund', 'Build a GH\u20b5500 cushion for surprise expenses over the next 45 days.', 'save_amount', 500, 45, 240, 'hard'),
          ('No Betting Week', 'Avoid betting, gaming, and impulse entertainment expenses for seven days.', 'no_spend', NULL, 7, 180, 'hard'),
          ('30-Day Money Streak', 'Log your spending or savings activity every day for 30 days.', 'streak', NULL, 30, 320, 'extreme')
      `);
      console.log('✅ Savings challenges seeded');
    } else {
      console.log('⏭️  Savings challenges already seeded (' + count.rows[0].count + ' rows)');
    }

    // Verify everything
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name
    `);
    const views = await client.query(`
      SELECT table_name FROM information_schema.views 
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    
    console.log('\n✅ All fixed! Database has ' + tables.rows.length + ' tables and ' + views.rows.length + ' views.');
    
  } finally {
    client.release();
    await pool.end();
  }
}
fix().catch(e => { console.error('❌', e.message); process.exit(1); });
