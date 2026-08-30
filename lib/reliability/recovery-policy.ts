export const recoveryPolicy = Object.freeze({
  invalidSession: Object.freeze({
    automaticMutationReplay: false,
    recovery: "sign_in_again",
  }),
  maintenance: Object.freeze({
    automaticMutationReplay: false,
    recovery: "wait_or_navigate_to_safe_route",
  }),
  mutationStatusUncertain: Object.freeze({
    automaticMutationReplay: false,
    recovery: "reload_and_review_current_state",
  }),
  readDependencyUnavailable: Object.freeze({
    automaticMutationReplay: false,
    recovery: "retry_read_after_dependency_restoration",
  }),
  renderFailure: Object.freeze({
    automaticMutationReplay: false,
    recovery: "reset_render_and_reload_current_state",
  }),
  versionMismatch: Object.freeze({
    automaticMutationReplay: false,
    recovery: "reload_application_before_new_submission",
  }),
});
