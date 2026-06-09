const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const BALANCE_ACCOUNTS = ['Cash', 'Bank', 'Visa Card', 'MTN MoMo', 'Telecel Cash', 'AirtelTigo Money'];

function normalizeAccountType(value) {
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase();

  if (normalized === 'cash') return 'Cash';
  if (normalized === 'bank' || normalized === 'bank transfer') return 'Bank';
  if (normalized.includes('visa') || normalized === 'card' || normalized === 'debit card') return 'Visa Card';
  if (normalized.includes('mtn') || normalized.includes('momo')) return 'MTN MoMo';
  if (normalized.includes('telecel') || normalized.includes('vodafone')) return 'Telecel Cash';
  if (normalized.includes('airteltigo') || normalized.includes('airtel tigo')) return 'AirtelTigo Money';

  return BALANCE_ACCOUNTS.includes(raw) ? raw : null;
}

function normalizeRows(rows) {
  const saved = new Map(rows.map(row => [row.account_type, row]));

  return BALANCE_ACCOUNTS.map(accountType => {
    const row = saved.get(accountType);
    return {
      account_type: accountType,
      amount: row ? Number(row.amount) : 0,
      updated_at: row ? row.updated_at : null
    };
  });
}

function buildResponse(rows, hasBalances) {
  const balances = normalizeRows(rows);
  const total = balances.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return {
    balances,
    total,
    has_balances: hasBalances
  };
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT account_type, amount, updated_at FROM account_balances WHERE user_id = $1 ORDER BY account_type',
      [req.user.id]
    );

    res.json({
      success: true,
      data: buildResponse(result.rows, result.rows.length > 0)
    });
  } catch (error) {
    console.error('Fetch balances error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch balances' });
  }
});

router.put('/', authenticateToken, async (req, res) => {
  try {
    const incomingBalances = Array.isArray(req.body.balances) ? req.body.balances : [];

    if (!incomingBalances.length) {
      return res.status(400).json({ success: false, message: 'Add at least one balance to save' });
    }

    const balancesByType = new Map();
    for (const item of incomingBalances) {
      const accountType = normalizeAccountType(item.account_type || item.accountType || item.name);
      const amount = Number(item.amount);

      if (!accountType) {
        return res.status(400).json({ success: false, message: 'Invalid balance account' });
      }

      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ success: false, message: 'Balance amounts must be zero or more' });
      }

      balancesByType.set(accountType, Math.round(amount * 100) / 100);
    }

    const rows = await transaction(async (client) => {
      for (const [accountType, amount] of balancesByType.entries()) {
        await client.query(
          `INSERT INTO account_balances (user_id, account_type, amount, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (user_id, account_type)
           DO UPDATE SET amount = EXCLUDED.amount, updated_at = NOW()`,
          [req.user.id, accountType, amount]
        );
      }

      const result = await client.query(
        'SELECT account_type, amount, updated_at FROM account_balances WHERE user_id = $1 ORDER BY account_type',
        [req.user.id]
      );

      return result.rows;
    });

    res.json({
      success: true,
      data: buildResponse(rows, true)
    });
  } catch (error) {
    console.error('Update balances error:', error);
    res.status(500).json({ success: false, message: 'Failed to update balances' });
  }
});

module.exports = router;
