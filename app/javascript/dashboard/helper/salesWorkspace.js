export const FOLLOW_UP_ATTRIBUTE = 'mfj_follow_up_at';

export const SALES_LABELS = {
  FOLLOW_UP: 'follow_up',
  PROPOSAL_SENT: 'proposta_enviada',
  SOLD: 'vendido',
  LOST: 'declinado',
  BOT_OFF: 'bot_off',
  SCORM: 'scorm',
};

function getCustomAttributes(conversation = {}) {
  return conversation.custom_attributes || conversation.customAttributes || {};
}

export function getFollowUpAt(conversation) {
  return getCustomAttributes(conversation)[FOLLOW_UP_ATTRIBUTE];
}

export function hasUnreadMessages(conversation) {
  return Number(conversation.unread_count || conversation.unreadCount || 0) > 0;
}

export function hasLabel(conversation, label) {
  return (conversation.labels || []).includes(label);
}

export function hasFollowUp(conversation) {
  return hasLabel(conversation, SALES_LABELS.FOLLOW_UP);
}

export function isFollowUpDue(conversation) {
  const followUpAt = getFollowUpAt(conversation);
  if (!followUpAt) return false;

  const date = new Date(followUpAt);
  if (Number.isNaN(date.getTime())) return false;

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  return date <= todayEnd;
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

export const SALES_QUICK_FILTERS = [
  {
    id: 'response',
    label: 'Responder',
    icon: 'i-lucide-message-circle-reply',
    matches: conversation => hasUnreadMessages(conversation),
  },
  {
    id: 'attention',
    label: 'Prioridade',
    icon: 'i-lucide-siren',
    matches: conversation =>
      hasUnreadMessages(conversation) || isFollowUpDue(conversation),
  },
  {
    id: 'follow_up',
    label: 'Follow-up',
    icon: 'i-lucide-clock-3',
    matches: conversation => hasFollowUp(conversation),
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
    response: conversations.filter(hasUnreadMessages).length,
    attention: conversations.filter(
      conversation =>
        hasUnreadMessages(conversation) || isFollowUpDue(conversation)
    ).length,
    unread: conversations.filter(hasUnreadMessages).length,
    followUp: conversations.filter(hasFollowUp).length,
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

export function getFollowUpBadge(conversation) {
  const followUpAt = getFollowUpAt(conversation);
  if (!followUpAt) return null;

  const date = new Date(followUpAt);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const sameDay = (left, right) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

  const time = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const day = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });

  if (sameDay(date, today)) {
    return {
      label: `Retorno hoje ${time}`,
      isDue: true,
    };
  }

  if (sameDay(date, tomorrow)) {
    return {
      label: `Retorno amanhã ${time}`,
      isDue: false,
    };
  }

  return {
    label: `Retorno ${day} ${time}`,
    isDue: date < today,
  };
}

export function prependAgentName(message, user = {}) {
  const content = String(message || '').trim();
  const agentName = String(user.available_name || user.name || '').trim();

  if (!agentName || !content) return message;

  const signature = `**${agentName}**`;
  if (content.startsWith(signature)) return content;

  return `${signature}\n\n${content}`;
}
