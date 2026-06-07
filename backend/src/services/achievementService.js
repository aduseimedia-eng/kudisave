const { query } = require('../config/database');
const { awardXP } = require('./gamificationService');

const getAchievementStats = async (userId) => {
  const statsResult = await query(
    `SELECT
      (SELECT COUNT(*) FROM expenses WHERE user_id = $1) as expense_count,
      (SELECT COUNT(*) FROM budgets WHERE user_id = $1) as budget_count,
      (SELECT COUNT(*) FROM goals WHERE user_id = $1) as goal_count,
      (SELECT COUNT(*) FROM goals WHERE user_id = $1 AND status = 'completed') as goals_completed,
      COALESCE((SELECT current_streak FROM streaks WHERE user_id = $1), 0) as streak_days,
      (SELECT COALESCE(SUM(current_amount), 0) FROM goals WHERE user_id = $1) as total_saved,
      (SELECT COUNT(*) FROM user_challenges WHERE user_id = $1 AND status = 'completed') as challenges_completed`,
    [userId]
  );

  return statsResult.rows[0] || {};
};

const getRequirementValue = (achievement, stats) => {
  switch (achievement.requirement_type) {
    case 'expense_count': return parseInt(stats.expense_count) || 0;
    case 'budget_count': return parseInt(stats.budget_count) || 0;
    case 'goal_count': return parseInt(stats.goal_count) || 0;
    case 'goals_completed': return parseInt(stats.goals_completed) || 0;
    case 'streak_days': return parseInt(stats.streak_days) || 0;
    case 'total_saved': return parseFloat(stats.total_saved) || 0;
    case 'challenges_completed': return parseInt(stats.challenges_completed) || 0;
    default: return 0;
  }
};

const checkAndAwardAchievements = async (userId, requirementTypes = null) => {
  const stats = await getAchievementStats(userId);
  const params = [userId];
  let typeFilter = '';

  if (Array.isArray(requirementTypes) && requirementTypes.length) {
    typeFilter = ' AND a.requirement_type = ANY($2)';
    params.push(requirementTypes);
  }

  const unearnedResult = await query(
    `SELECT a.* FROM achievements a
     WHERE NOT EXISTS (
       SELECT 1 FROM user_achievements ua
       WHERE ua.achievement_id = a.id AND ua.user_id = $1
     )
     ${typeFilter}`,
    params
  );

  const newlyEarned = [];

  for (const achievement of unearnedResult.rows) {
    const currentValue = getRequirementValue(achievement, stats);
    const targetValue = parseFloat(achievement.requirement_value) || 0;

    if (targetValue > 0 && currentValue >= targetValue) {
      await query(
        'INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)',
        [userId, achievement.id]
      );

      const xpResult = await awardXP(
        userId,
        achievement.xp_reward || 0,
        `Achievement earned: ${achievement.name}`
      );

      newlyEarned.push({
        ...achievement,
        current_value: currentValue,
        leveledUp: xpResult.leveledUp,
        newLevel: xpResult.newLevel
      });
    }
  }

  return newlyEarned;
};

module.exports = {
  checkAndAwardAchievements,
  getAchievementStats,
  getRequirementValue
};
