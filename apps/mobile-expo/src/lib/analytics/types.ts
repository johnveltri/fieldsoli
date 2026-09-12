export type AnalyticsValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | string[]
  | number[]
  | boolean[]
  | Record<string, unknown>;

export type AnalyticsProperties = Record<string, AnalyticsValue>;

export type AnalyticsScreenName =
  | 'sign_in'
  | 'home'
  | 'jobs'
  | 'job_detail'
  | 'earnings'
  | 'inbox'
  | 'profile';

export type AnalyticsEventName =
  | 'app_opened'
  | 'app_became_active'
  | 'auth_screen_viewed'
  | 'auth_mode_changed'
  | 'sign_in_submitted'
  | 'sign_in_succeeded'
  | 'sign_in_failed'
  | 'sign_up_submitted'
  | 'sign_up_succeeded'
  | 'sign_up_failed'
  | 'profile_viewed'
  | 'profile_edit_opened'
  | 'profile_trade_picker_opened'
  | 'profile_saved'
  | 'profile_save_failed'
  | 'feedback_prompt_shown'
  | 'feedback_prompt_dismissed'
  | 'feedback_prompt_check_failed'
  | 'feedback_composer_opened'
  | 'feedback_composer_failed'
  | 'password_change_submitted'
  | 'password_change_succeeded'
  | 'password_change_failed'
  | 'password_reset_requested'
  | 'password_reset_request_failed'
  | 'signed_out'
  | 'account_delete_requested'
  | 'account_delete_confirmed'
  | 'account_delete_succeeded'
  | 'account_delete_failed'
  | 'screen_viewed'
  | 'shell_tab_selected'
  | 'profile_opened_from_home'
  | 'job_detail_opened'
  | 'job_detail_closed'
  | 'inbox_opened'
  | 'inbox_closed'
  | 'earnings_opened'
  | 'jobs_list_loaded'
  | 'jobs_list_load_failed'
  | 'jobs_tab_changed'
  | 'jobs_search_started'
  | 'jobs_search_submitted'
  | 'jobs_search_cleared'
  | 'jobs_pagination_loaded'
  | 'jobs_pagination_failed'
  | 'job_create_started'
  | 'job_created'
  | 'job_create_failed'
  | 'job_edit_opened'
  | 'job_saved'
  | 'job_save_failed'
  | 'job_status_changed'
  | 'job_status_change_failed'
  | 'job_deleted'
  | 'job_delete_failed'
  | 'home_loaded'
  | 'home_load_failed'
  | 'home_quick_actions_opened'
  | 'home_quick_action_selected'
  | 'home_job_card_pressed'
  | 'home_needs_attention_expanded'
  | 'home_needs_attention_summary_pressed'
  | 'home_jobs_open_pressed'
  | 'home_earnings_pressed'
  | 'session_start_requested'
  | 'live_session_started'
  | 'live_session_start_failed'
  | 'live_session_viewed'
  | 'live_session_minimized'
  | 'live_session_reopened'
  | 'live_session_edit_opened'
  | 'live_session_start_time_changed'
  | 'live_session_ended'
  | 'live_session_end_failed'
  | 'live_session_deleted'
  | 'live_session_delete_failed'
  | 'manual_session_create_opened'
  | 'manual_session_created'
  | 'manual_session_create_failed'
  | 'manual_session_updated'
  | 'manual_session_update_failed'
  | 'session_deleted'
  | 'session_delete_failed'
  | 'note_create_opened'
  | 'note_created'
  | 'note_create_failed'
  | 'note_updated'
  | 'note_update_failed'
  | 'note_deleted'
  | 'note_delete_failed'
  | 'material_create_opened'
  | 'material_created'
  | 'material_create_failed'
  | 'material_updated'
  | 'material_update_failed'
  | 'material_deleted'
  | 'material_delete_failed'
  | 'other_cost_deleted'
  | 'other_cost_delete_failed'
  | 'no_materials_confirmed'
  | 'no_materials_confirmation_undone'
  | 'no_materials_confirmation_failed'
  | 'inbox_loaded'
  | 'inbox_load_failed'
  | 'inbox_tab_changed'
  | 'inbox_item_selected'
  | 'inbox_assign_sheet_opened'
  | 'inbox_assign_jobs_loaded'
  | 'inbox_assign_jobs_load_failed'
  | 'inbox_item_assigned_to_job'
  | 'inbox_item_assign_failed'
  | 'earnings_loaded'
  | 'earnings_load_failed'
  | 'earnings_window_changed'
  | 'outstanding_payment_card_pressed'
  | 'earnings_ranked_job_pressed'
  | 'api_request_failed'
  | 'supabase_not_configured_seen'
  | 'stale_auth_session_detected'
  | 'unexpected_error_seen'
  | 'analytics_event_dropped';

export type AnalyticsEventPayloads = {
  [Name in AnalyticsEventName]: AnalyticsProperties;
};

export type AnalyticsUserTraits = AnalyticsProperties;

export type AnalyticsAdapter = {
  name: string;
  capture: (event: AnalyticsEventName, properties: AnalyticsProperties) => void;
  identify: (userId: string, traits: AnalyticsUserTraits) => void;
  reset: () => void;
  screen: (name: AnalyticsScreenName, properties: AnalyticsProperties) => void;
};
