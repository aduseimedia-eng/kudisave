const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const BALANCE_ACCOUNTS = ['Cash', 'Bank', 'Visa Card', 'Mastercard', 'MTN MoMo', 'Telecel Cash', 'AirtelTigo Money'];
const ACCOUNT_PAYMENT_METHODS = {
  Cash: 'Cash',
  Bank: 'Bank Transfer',
  'Visa Card': 'Visa Card',
  Mastercard: 'Mastercard',
  'MTN MoMo': 'MTN MoMo',
  'Telecel Cash': 'Telecel Cash',
  'AirtelTigo Money': 'AirtelTigo Money'
};

function normalizeAccountType(value) {
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase();

  if (normalized === 'cash') return 'Cash';
  if (normalized === 'bank' || normalized === 'bank transfer') return 'Bank';
  if (normalized.includes('visa') || normalized === 'card' || normalized === 'debit card') return 'Visa Card';
  if (normalized.includes('mastercard') || normalized.includes('master card')) return 'Mastercard';
  if (normalized.includes('mtn') || normalized.includes('momo')) return 'MTN MoMo';
  if (normalized.includes('telecel') || normalized.includes('vodafone')) return 'Telecel Cash';
  if (normalized.includes('airteltigo') || normalized.includes('airtel tigo')) return 'AirtelTigo Money';

  return BALANCE_ACCOUNTS.includes(raw) ? raw : null;
}

function getPaymentMethod(accountType, value) {
  const normalized = normalizeAccountType(value);
  if (normalized) return ACCOUNT_PAYMENT_METHODS[normalized];
  return ACCOUNT_PAYMENT_METHODS[accountType] || accountType;
}

function slugifyAccountKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function normalizeMask(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(-4);
}

function normalizeRow(row) {
  const accountType = normalizeAccountType(row.account_type) || 'Cash';
  const accountName = String(row.account_name || accountType).trim().slice(0, 80);
  const paymentMethod = getPaymentMethod(accountType, row.payment_method || accountType);
  const accountKey = slugifyAccountKey(row.account_key || `${accountType}-${accountName}`) || slugifyAccountKey(accountType);

  return {
    account_key: accountKey,
    account_type: accountType,
    account_name: accountName || accountType,
    payment_method: paymentMethod,
    account_mask: normalizeMask(row.account_mask),
    amount: Number(row.amount || 0),
    updated_at: row.updated_at || null
  };
}

function normalizeRows(rows) {
  const normalizedRows = rows.map(normalizeRow);
  const savedKeys = new Set(normalizedRows.map(row => row.account_key));

  const defaultRows = BALANCE_ACCOUNTS.map(accountType => {
    const accountKey = `default-${slugifyAccountKey(accountType)}`;
    return savedKeys.has(accountKey) ? null : {
      account_key: accountKey,
      account_type: accountType,
      account_name: accountType,
      payment_method: ACCOUNT_PAYMENT_METHODS[accountType],
      account_mask: '',
      amount: 0,
      updated_at: null
    };
  }).filter(Boolean);

  return [...normalizedRows, ...defaultRows].sort((a, b) => {
    const defaultOrder = BALANCE_ACCOUNTS.indexOf(a.account_type) - BALANCE_ACCOUNTS.indexOf(b.account_type);
    if (defaultOrder !== 0) return defaultOrder;
    return a.account_name.localeCompare(b.account_name);
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
      `SELECT account_key, account_type, account_name, payment_method, account_mask, amount, updated_at
       FROM account_balances
       WHERE user_id = $1
       ORDER BY account_type, account_name, created_at`,
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

    const balancesByKey = new Map();
    for (const item of incomingBalances) {
      const accountType = normalizeAccountType(item.account_type || item.accountType || item.payment_method || item.paymentMethod || item.name);
      const amount = Number(item.amount);

      if (!accountType) {
        return res.status(400).json({ success: false, message: 'Invalid balance account' });
      }

      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ success: false, message: 'Balance amounts must be zero or more' });
      }

      const paymentMethod = getPaymentMethod(accountType, item.payment_method || item.paymentMethod || accountType);
      const accountName = String(item.account_name || item.accountName || item.name || accountType).trim().slice(0, 80) || accountType;
      const accountMask = normalizeMask(item.account_mask || item.accountMask || item.mask);
      const preferredKey = item.account_key || item.accountKey || `${accountType}-${accountName}-${accountMask}`;
      let accountKey = slugifyAccountKey(preferredKey) || `account-${balancesByKey.size + 1}`;
      let suffix = 2;
      while (balancesByKey.has(accountKey)) {
        accountKey = `${slugifyAccountKey(preferredKey) || 'account'}-${suffix}`;
        suffix += 1;
      }

      balancesByKey.set(accountKey, {
        accountKey,
        accountType,
        accountName,
        paymentMethod,
        accountMask,
        amount: Math.round(amount * 100) / 100
      });
    }

    const rows = await transaction(async (client) => {
      for (const balance of balancesByKey.values()) {
        await client.query(
          `INSERT INTO account_balances (user_id, account_key, account_type, account_name, payment_method, account_mask, amount, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (user_id, account_key)
           DO UPDATE SET
             account_type = EXCLUDED.account_type,
             account_name = EXCLUDED.account_name,
             payment_method = EXCLUDED.payment_method,
             account_mask = EXCLUDED.account_mask,
             amount = EXCLUDED.amount,
             updated_at = NOW()`,
          [
            req.user.id,
            balance.accountKey,
            balance.accountType,
            balance.accountName,
            balance.paymentMethod,
            balance.accountMask,
            balance.amount
          ]
        );
      }

      const result = await client.query(
        `SELECT account_key, account_type, account_name, payment_method, account_mask, amount, updated_at
         FROM account_balances
         WHERE user_id = $1
         ORDER BY account_type, account_name, created_at`,
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
