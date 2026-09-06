class AutoAssignment::AssignmentService
  pattr_initialize [:inbox!]

  BOT_IDLE_HANDOFF_AFTER = 5.minutes
  PLATFORM_LABELS = %w[scorm score scores plataforma plataformas].freeze
  PLATFORM_AGENT_EMAIL = 'agendamento@mfjtreinamentos.com.br'

  def perform_bulk_assignment(limit: 100)
    return 0 unless inbox.auto_assignment_v2_enabled?
    return 0 unless assignment_enabled?

    assigned_count = 0

    unassigned_conversations(limit).each do |conversation|
      assigned_count += 1 if perform_for_conversation(conversation)
    end

    assigned_count
  end

  private

  def perform_for_conversation(conversation)
    return false unless assignable?(conversation)

    agent = find_available_agent(conversation)
    return false unless agent

    assign_conversation(conversation, agent)
  end

  def assignable?(conversation)
    conversation.status == 'open' &&
      conversation.assignee_id.nil?
  end

  def unassigned_conversations(limit)
    scope = inbox.conversations.unassigned.open
    scope = if inbox.enable_auto_assignment?
              scope.where('assignee_agent_bot_id IS NULL OR last_activity_at <= ?', BOT_IDLE_HANDOFF_AFTER.ago)
            else
              scope.where(disabled_assignment_handoff_query, BOT_IDLE_HANDOFF_AFTER.ago, *platform_label_patterns)
            end

    # Apply conversation priority using assignment policy if available
    policy = inbox.assignment_policy
    scope = if policy&.longest_waiting?
              scope.reorder(last_activity_at: :asc, created_at: :asc)
            else
              scope.reorder(created_at: :asc)
            end

    scope.limit(limit)
  end

  def find_available_agent(conversation = nil)
    platform_agent = preferred_platform_agent(conversation)
    return platform_agent if platform_agent

    agents = filter_agents_by_team(agent_pool, conversation)
    return nil if agents.nil?

    agents = filter_agents_by_rate_limit(agents)
    return nil if agents.empty?

    round_robin_selector.select_agent(agents)
  end

  def preferred_platform_agent(conversation)
    return unless platform_conversation?(conversation)

    platform_agent_members.find { |agent_member| platform_agent?(agent_member.user) }&.user
  end

  def platform_agent_members
    inbox.inbox_members.includes(:user)
  end

  def assignment_enabled?
    inbox.enable_auto_assignment? || idle_bot_conversations? || platform_conversations?
  end

  def idle_bot_conversations?
    inbox.conversations.unassigned.open
         .where.not(assignee_agent_bot_id: nil)
         .where('last_activity_at <= ?', BOT_IDLE_HANDOFF_AFTER.ago)
         .exists?
  end

  def platform_conversations?
    inbox.conversations.unassigned.open
         .where(platform_label_query, *platform_label_patterns)
         .exists?
  end

  def agent_pool
    return inbox.available_agents if inbox.enable_auto_assignment?

    inbox.inbox_members.includes(:user)
  end

  def disabled_assignment_handoff_query
    "(assignee_agent_bot_id IS NOT NULL AND last_activity_at <= ?) OR #{platform_label_query}"
  end

  def platform_label_query
    PLATFORM_LABELS.map { "LOWER(COALESCE(cached_label_list, '')) LIKE ?" }.join(' OR ')
  end

  def platform_label_patterns
    PLATFORM_LABELS.map { |label| "%#{label}%" }
  end

  def platform_conversation?(conversation)
    conversation&.label_list&.any? { |label| PLATFORM_LABELS.include?(normalize_label(label)) }
  end

  def platform_agent?(agent)
    agent.email.to_s.casecmp?(PLATFORM_AGENT_EMAIL) ||
      I18n.transliterate(agent.name.to_s).downcase.include?('kauan')
  end

  def normalize_label(label)
    I18n.transliterate(label.to_s).downcase.tr('-', '_')
  end

  def filter_agents_by_team(agents, conversation)
    return agents if conversation&.team_id.blank?

    team = conversation.team
    return nil if team.blank? || team.allow_auto_assign.blank?

    team_member_ids = team.members.ids
    agents.where(user_id: team_member_ids)
  end

  def filter_agents_by_rate_limit(agents)
    agents.select do |agent_member|
      rate_limiter = build_rate_limiter(agent_member.user)
      rate_limiter.within_limit?
    end
  end

  def assign_conversation(conversation, agent)
    Current.executed_by = inbox.assignment_policy || inbox
    conversation.update!(assignee: agent)
    Current.executed_by = nil

    rate_limiter = build_rate_limiter(agent)
    rate_limiter.track_assignment(conversation)

    dispatch_assignment_event(conversation, agent)
    true
  ensure
    Current.executed_by = nil
  end

  def dispatch_assignment_event(conversation, agent)
    Rails.configuration.dispatcher.dispatch(
      Events::Types::ASSIGNEE_CHANGED,
      Time.zone.now,
      conversation: conversation,
      user: agent
    )
  end

  def build_rate_limiter(agent)
    AutoAssignment::RateLimiter.new(inbox: inbox, agent: agent)
  end

  def round_robin_selector
    @round_robin_selector ||= AutoAssignment::RoundRobinSelector.new(inbox: inbox)
  end
end

AutoAssignment::AssignmentService.prepend_mod_with('AutoAssignment::AssignmentService')
