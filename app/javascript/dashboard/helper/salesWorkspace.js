export function hasUnreadMessages(conversation) {
  return Number(conversation.unread_count || conversation.unreadCount || 0) > 0;
}

export function hasLabel(conversation, label) {
  return (conversation.labels || []).includes(label);
}

export function isConversationStale(conversation) {
  const timestamp =
    conversation.last_activity_at ||
    conversation.lastActivityAt ||
    conversation.timestamp ||
    conversation.created_at;
  if (!timestamp || hasUnreadMessages(conversation)) return false;

  const numericTimestamp = Number(timestamp);
  const lastActivity = Number.isFinite(numericTimestamp)
    ? numericTimestamp * 1000
    : new Date(timestamp).getTime();
  if (!lastActivity) return false;

  const sixHours = 6 * 60 * 60 * 1000;
  return Date.now() - lastActivity > sixHours;
}

export const SALES_LABELS = {
  FOLLOW_UP: 'follow_up',
  PROPOSAL_SENT: 'proposta_enviada',
  SOLD: 'vendido',
  LOST: 'declinado',
  BOT_OFF: 'bot_off',
  SCORM: 'scorm',
};

export const SALES_QUICK_FILTERS = [
  {
    id: 'attention',
    label: 'Prioridade',
    icon: 'i-lucide-siren',
    matches: conversation => hasUnreadMessages(conversation),
  },
  {
    id: 'follow_up',
    label: 'Follow-up',
    icon: 'i-lucide-clock-3',
    matches: conversation => hasLabel(conversation, SALES_LABELS.FOLLOW_UP),
  },
  {
    id: 'proposal',
    label: 'Propostas',
    icon: 'i-lucide-file-check-2',
    matches: conversation => hasLabel(conversation, SALES_LABELS.PROPOSAL_SENT),
  },
  {
    id: 'stale',
    label: 'Paradas',
    icon: 'i-lucide-timer-off',
    matches: conversation => isConversationStale(conversation),
  },
  {
    id: 'sold',
    label: 'Vendidas',
    icon: 'i-lucide-trophy',
    matches: conversation => hasLabel(conversation, SALES_LABELS.SOLD),
  },
];

export const SALES_STAGE_ACTIONS = [
  {
    id: SALES_LABELS.FOLLOW_UP,
    label: 'Follow-up',
    icon: 'i-lucide-clock-3',
  },
  {
    id: SALES_LABELS.PROPOSAL_SENT,
    label: 'Proposta',
    icon: 'i-lucide-file-check-2',
  },
  {
    id: SALES_LABELS.SOLD,
    label: 'Vendido',
    icon: 'i-lucide-trophy',
  },
  {
    id: SALES_LABELS.LOST,
    label: 'Perdido',
    icon: 'i-lucide-circle-x',
  },
];

export const FOLLOW_UP_ACTIONS = [
  {
    id: 'today',
    label: 'Hoje',
    hours: 2,
  },
  {
    id: 'tomorrow',
    label: 'Amanhã',
    hours: 24,
  },
  {
    id: 'three_days',
    label: '3 dias',
    hours: 72,
  },
];

export function getSalesMetrics(conversations) {
  return {
    unread: conversations.filter(hasUnreadMessages).length,
    followUp: conversations.filter(conversation =>
      hasLabel(conversation, SALES_LABELS.FOLLOW_UP)
    ).length,
    proposal: conversations.filter(conversation =>
      hasLabel(conversation, SALES_LABELS.PROPOSAL_SENT)
    ).length,
    stale: conversations.filter(isConversationStale).length,
    sold: conversations.filter(conversation =>
      hasLabel(conversation, SALES_LABELS.SOLD)
    ).length,
  };
}

export function applySalesFilter(conversations, filterId) {
  if (!filterId || filterId === 'all') return conversations;

  const filter = SALES_QUICK_FILTERS.find(item => item.id === filterId);
  if (!filter) return conversations;

  return conversations.filter(filter.matches);
}

export function getSnoozeDate(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}
