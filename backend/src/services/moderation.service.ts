import { query, transaction } from '../db/pool.js';
import type { UserRiskScore, Block, Report } from '../types/index.js';

// ============ CONTENT PATTERNS ============

interface Pattern {
  pattern: RegExp;
  score: number;
}

const SPAM_PATTERNS: Pattern[] = [
  { pattern: /(?:bit\.ly|tinyurl|goo\.gl)\/\w+/i, score: 50 },
  { pattern: /(?:paypal|venmo|wire transfer)/i, score: 80 },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, score: 25 },
  { pattern: /(?:\+?\d[\d -]{8,12}\d)/, score: 25 },
  { pattern: /(?:crypto|bitcoin|ethereum|invest)/i, score: 40 },
  { pattern: /(?:cash app|western union)/i, score: 70 },
];

const TOXICITY_PATTERNS: Pattern[] = [
  { pattern: /(?:fuck|merde|putain|connard|salope|pute)/i, score: 40 },
  { pattern: /(?:kill yourself|crève|va mourir|suicide)/i, score: 90 },
  { pattern: /(?:retard|débile|crétin)/i, score: 30 },
];

const HARASSMENT_PATTERNS: Pattern[] = [
  { pattern: /(?:send nudes|photo de toi nue|naked)/i, score: 70 },
  { pattern: /(?:viens chez moi|on se voit ce soir)/i, score: 40 },
  { pattern: /(?:ton adresse|where do you live)/i, score: 50 },
  { pattern: /(?:give me your number|donne-moi ton numéro)/i, score: 35 },
];

const LOW_EFFORT_FIRST_MESSAGE = [
  /^salut$/i,
  /^hello$/i,
  /^hey$/i,
  /^coucou$/i,
  /^ça va\s*\??$/i,
  /^hi$/i,
  /^bonjour$/i,
  /^yo$/i,
  /^slt$/i,
  /^cc$/i,
];

// ============ BEHAVIORAL THRESHOLDS ============

const THRESHOLDS = {
  MESSAGES_24H_WARN: 30,
  MESSAGES_24H_CRITICAL: 80,
  RESPONSE_RATE_WARN: 0.15,
  RESPONSE_RATE_CRITICAL: 0.05,
  BLOCKS_30D_WARN: 3,
  BLOCKS_30D_CRITICAL: 8,
  REPORTS_30D_WARN: 2,
  REPORTS_30D_CRITICAL: 5,
};

// ============ CONTENT ANALYSIS ============

export interface ContentAnalysis {
  spamScore: number;
  toxicityScore: number;
  harassmentScore: number;
  isLowEffort: boolean;
  totalScore: number;
  flags: string[];
}

export function analyzeContent(content: string, isFirstMessage: boolean = false): ContentAnalysis {
  const flags: string[] = [];
  let spamScore = 0;
  let toxicityScore = 0;
  let harassmentScore = 0;

  // Check spam patterns
  for (const { pattern, score } of SPAM_PATTERNS) {
    if (pattern.test(content)) {
      spamScore += score;
      flags.push(`spam:${pattern.source.slice(0, 20)}`);
    }
  }

  // Check toxicity patterns
  for (const { pattern, score } of TOXICITY_PATTERNS) {
    if (pattern.test(content)) {
      toxicityScore += score;
      flags.push(`toxicity:${pattern.source.slice(0, 20)}`);
    }
  }

  // Check harassment patterns
  for (const { pattern, score } of HARASSMENT_PATTERNS) {
    if (pattern.test(content)) {
      harassmentScore += score;
      flags.push(`harassment:${pattern.source.slice(0, 20)}`);
    }
  }

  // Check low-effort first message
  let isLowEffort = false;
  if (isFirstMessage) {
    isLowEffort = LOW_EFFORT_FIRST_MESSAGE.some((pattern) => pattern.test(content.trim()));
    if (isLowEffort) {
      flags.push('low_effort');
    }
  }

  // Cap scores at 100
  spamScore = Math.min(spamScore, 100);
  toxicityScore = Math.min(toxicityScore, 100);
  harassmentScore = Math.min(harassmentScore, 100);

  const totalScore = Math.min(spamScore + toxicityScore + harassmentScore, 100);

  return {
    spamScore,
    toxicityScore,
    harassmentScore,
    isLowEffort,
    totalScore,
    flags,
  };
}

// ============ RISK SCORE MANAGEMENT ============

export async function getUserRiskScore(userId: string): Promise<UserRiskScore | null> {
  const result = await query('SELECT * FROM user_risk_scores WHERE user_id = $1', [userId]);

  if (result.rows.length === 0) {
    return null;
  }

  return mapDbRowToRiskScore(result.rows[0]);
}

export async function updateRiskScore(
  userId: string,
  analysis: ContentAnalysis
): Promise<UserRiskScore> {
  const result = await query(
    `UPDATE user_risk_scores SET
      spam_score = LEAST(spam_score + $2, 100),
      toxicity_score = LEAST(toxicity_score + $3, 100),
      harassment_score = LEAST(harassment_score + $4, 100),
      updated_at = NOW()
    WHERE user_id = $1
    RETURNING *`,
    [userId, analysis.spamScore, analysis.toxicityScore, analysis.harassmentScore]
  );

  return mapDbRowToRiskScore(result.rows[0]);
}

export async function checkAndApplyActions(userId: string): Promise<string | null> {
  const riskScore = await getUserRiskScore(userId);
  if (!riskScore) return null;

  const totalScore =
    riskScore.spamScore +
    riskScore.toxicityScore +
    riskScore.harassmentScore +
    riskScore.messageAsymmetryScore +
    riskScore.persistenceScore +
    riskScore.velocityScore;

  const avgScore = totalScore / 6;

  // Determine action based on score
  // score < 20 → none
  // score 20-40 → warn
  // score 40-60 → throttle (not implemented here, would limit initiatives)
  // score 60-80 → shadow_ban
  // score >= 80 → suspend

  if (avgScore >= 80 && !riskScore.isSuspended) {
    await suspendUser(userId, 'Automated suspension due to high risk score', 30);
    return 'suspend';
  }

  if (avgScore >= 60 && !riskScore.isShadowBanned) {
    await shadowBanUser(userId, 'Automated shadow ban due to elevated risk score');
    return 'shadow_ban';
  }

  if (avgScore >= 20 && riskScore.warningCount < 3) {
    await warnUser(userId, 'Automated warning due to content violations');
    return 'warn';
  }

  return null;
}

export async function warnUser(userId: string, reason: string): Promise<void> {
  await transaction(async (client) => {
    await client.query(
      `UPDATE user_risk_scores SET
        warning_count = warning_count + 1,
        last_warning_at = NOW(),
        updated_at = NOW()
      WHERE user_id = $1`,
      [userId]
    );

    await client.query(
      `INSERT INTO moderation_history (user_id, action, reason, triggered_by)
       VALUES ($1, 'warn', $2, 'system')`,
      [userId, reason]
    );
  });
}

export async function shadowBanUser(userId: string, reason: string): Promise<void> {
  await transaction(async (client) => {
    await client.query(
      `UPDATE user_risk_scores SET
        is_shadow_banned = true,
        updated_at = NOW()
      WHERE user_id = $1`,
      [userId]
    );

    await client.query(
      `INSERT INTO moderation_history (user_id, action, reason, triggered_by)
       VALUES ($1, 'shadow_ban', $2, 'system')`,
      [userId, reason]
    );
  });
}

export async function suspendUser(userId: string, reason: string, days: number): Promise<void> {
  const suspensionEnd = new Date();
  suspensionEnd.setDate(suspensionEnd.getDate() + days);

  await transaction(async (client) => {
    await client.query(
      `UPDATE user_risk_scores SET
        is_suspended = true,
        suspension_end = $2,
        updated_at = NOW()
      WHERE user_id = $1`,
      [userId, suspensionEnd]
    );

    await client.query(
      `INSERT INTO moderation_history (user_id, action, reason, triggered_by, duration_days)
       VALUES ($1, 'suspend', $2, 'system', $3)`,
      [userId, reason, days]
    );
  });
}

// ============ BLOCKS ============

export async function blockUser(
  blockerId: string,
  blockedId: string,
  reason?: string
): Promise<Block> {
  const result = await query(
    `INSERT INTO blocks (blocker_id, blocked_id, reason)
     VALUES ($1, $2, $3)
     ON CONFLICT (blocker_id, blocked_id) DO UPDATE SET reason = $3
     RETURNING *`,
    [blockerId, blockedId, reason || null]
  );

  // Update blocked user's risk score
  await query(
    `UPDATE user_risk_scores SET
      blocks_received_count = blocks_received_count + 1,
      updated_at = NOW()
    WHERE user_id = $1`,
    [blockedId]
  );

  // Archive any conversation between them
  const [user1Id, user2Id] = [blockerId, blockedId].sort();
  await query(
    `UPDATE conversations SET status = 'blocked'
     WHERE user1_id = $1 AND user2_id = $2`,
    [user1Id, user2Id]
  );

  return mapDbRowToBlock(result.rows[0]);
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  await query(
    'DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2',
    [blockerId, blockedId]
  );
}

export async function getBlockedUsers(userId: string): Promise<string[]> {
  const result = await query(
    'SELECT blocked_id FROM blocks WHERE blocker_id = $1',
    [userId]
  );

  return result.rows.map((row) => row.blocked_id);
}

// ============ REPORTS ============

export async function createReport(
  reporterId: string,
  reportedId: string,
  contentType: Report['contentType'],
  reason: string,
  contentId?: string
): Promise<Report> {
  const result = await query(
    `INSERT INTO reports (reporter_id, reported_id, content_type, content_id, reason)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [reporterId, reportedId, contentType, contentId || null, reason]
  );

  // Update reported user's risk score
  await query(
    `UPDATE user_risk_scores SET
      reports_received_count = reports_received_count + 1,
      updated_at = NOW()
    WHERE user_id = $1`,
    [reportedId]
  );

  // Check if action is needed
  await checkAndApplyActions(reportedId);

  return mapDbRowToReport(result.rows[0]);
}

// ============ BEHAVIORAL ANALYSIS ============

export async function analyzeBehavior(userId: string): Promise<{
  asymmetryScore: number;
  velocityScore: number;
  persistenceScore: number;
}> {
  // Message velocity (messages sent in last 24h)
  const velocityResult = await query(
    `SELECT COUNT(*) FROM messages
     WHERE sender_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
    [userId]
  );
  const messageCount = parseInt(velocityResult.rows[0].count, 10);

  let velocityScore = 0;
  if (messageCount > THRESHOLDS.MESSAGES_24H_CRITICAL) {
    velocityScore = 80;
  } else if (messageCount > THRESHOLDS.MESSAGES_24H_WARN) {
    velocityScore = 40;
  }

  // Message asymmetry (ratio of sent to received)
  const asymmetryResult = await query(
    `SELECT
      (SELECT COUNT(*) FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE m.sender_id = $1) as sent,
      (SELECT COUNT(*) FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE (c.user1_id = $1 OR c.user2_id = $1) AND m.sender_id != $1) as received`,
    [userId]
  );

  const sent = parseInt(asymmetryResult.rows[0].sent, 10);
  const received = parseInt(asymmetryResult.rows[0].received, 10);
  const responseRate = sent > 0 ? received / sent : 1;

  let asymmetryScore = 0;
  if (responseRate < THRESHOLDS.RESPONSE_RATE_CRITICAL) {
    asymmetryScore = 80;
  } else if (responseRate < THRESHOLDS.RESPONSE_RATE_WARN) {
    asymmetryScore = 40;
  }

  // Persistence (how many times user messages after no response)
  // This would require more complex tracking, simplified here
  const persistenceScore = 0;

  // Update risk scores
  await query(
    `UPDATE user_risk_scores SET
      message_asymmetry_score = $2,
      velocity_score = $3,
      persistence_score = $4,
      updated_at = NOW()
    WHERE user_id = $1`,
    [userId, asymmetryScore, velocityScore, persistenceScore]
  );

  return { asymmetryScore, velocityScore, persistenceScore };
}

// ============ MAPPERS ============

function mapDbRowToRiskScore(row: Record<string, unknown>): UserRiskScore {
  return {
    userId: row.user_id as string,
    spamScore: row.spam_score as number,
    toxicityScore: row.toxicity_score as number,
    harassmentScore: row.harassment_score as number,
    messageAsymmetryScore: row.message_asymmetry_score as number,
    persistenceScore: row.persistence_score as number,
    velocityScore: row.velocity_score as number,
    warningCount: row.warning_count as number,
    lastWarningAt: row.last_warning_at ? new Date(row.last_warning_at as string) : undefined,
    reportsReceivedCount: row.reports_received_count as number,
    blocksReceivedCount: row.blocks_received_count as number,
    isShadowBanned: row.is_shadow_banned as boolean,
    isSuspended: row.is_suspended as boolean,
    suspensionEnd: row.suspension_end ? new Date(row.suspension_end as string) : undefined,
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapDbRowToBlock(row: Record<string, unknown>): Block {
  return {
    id: row.id as string,
    blockerId: row.blocker_id as string,
    blockedId: row.blocked_id as string,
    reason: row.reason as string | undefined,
    createdAt: new Date(row.created_at as string),
  };
}

function mapDbRowToReport(row: Record<string, unknown>): Report {
  return {
    id: row.id as string,
    reporterId: row.reporter_id as string,
    reportedId: row.reported_id as string,
    contentType: row.content_type as Report['contentType'],
    contentId: row.content_id as string | undefined,
    reason: row.reason as string,
    status: row.status as Report['status'],
    createdAt: new Date(row.created_at as string),
  };
}
