class Api::V1::Accounts::Conversations::AssignmentsController < Api::V1::Accounts::Conversations::BaseController
  before_action :ensure_assignment_allowed

  # assigns agent/team to a conversation
  def create
    if params.key?(:assignee_id) || agent_bot_assignment?
      set_agent
    elsif params.key?(:team_id)
      set_team
    else
      render json: nil
    end
  end

  private

  def ensure_assignment_allowed
    return if Current.user.is_a?(AgentBot)
    return if Current.account_user&.administrator?
    return if permitted_agent_assignment?
    return if permitted_team_assignment?

    head :forbidden
  end

  def permitted_agent_assignment?
    return false unless params.key?(:assignee_id)
    return true if params[:assignee_id].blank?
    return false if agent_bot_assignment?

    params[:assignee_id].to_i == Current.user.id
  end

  def permitted_team_assignment?
    params.key?(:team_id) && params[:team_id].to_i.zero?
  end

  def set_agent
    resource = Conversations::AssignmentService.new(
      conversation: @conversation,
      assignee_id: params[:assignee_id],
      assignee_type: params[:assignee_type]
    ).perform

    render_agent(resource)
  end

  def render_agent(resource)
    case resource
    when User
      render partial: 'api/v1/models/agent', formats: [:json], locals: { resource: resource }
    when AgentBot
      render partial: 'api/v1/models/agent_bot_slim', formats: [:json], locals: { resource: resource }
    else
      render json: nil
    end
  end

  def set_team
    @team = Current.account.teams.find_by(id: params[:team_id])
    @conversation.update!(team: @team)
    render json: @team
  end

  def agent_bot_assignment?
    params[:assignee_type].to_s == 'AgentBot'
  end
end
