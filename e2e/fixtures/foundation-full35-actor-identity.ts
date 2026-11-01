import { canonicalizeJson, type JsonValue } from "../../ingestion/usda/foundation/canonical-json";
import { fixtureHash } from "./foundation-full35-reprojection";

export type ActorQuery = (sql: string, user?: string) => string;
export const identityGovernor = "full35_identity_governor_test";
export const identityReviewer = "full35_identity_reviewer_test";
export const actorInput = (value: unknown) => `'${canonicalizeJson(value as JsonValue).replaceAll("'", "''")}'::json`;
export function installIdentityControllers(query: ActorQuery, password: string) {
  query(`create role ${identityGovernor} login password '${password}'; create role ${identityReviewer} login password '${password}';
    grant ingestion_identity_governor to ${identityGovernor}; grant ingestion_identity_reviewer to ${identityReviewer};`);
}
export type PrincipalFixture = {principalId: string; subjectHash: string; authority: "operator" | "approver"; bindingId: string; requestId: string};
export function proposeActorBinding(query: ActorQuery, datasetId: string, login: string, authority: "operator" | "approver",
  options: {principal?: PrincipalFixture; action?: "enroll" | "rebind" | "revoke"; evidenceHash?: string; reference?: string} = {}) {
  const prior = options.principal ? query(`select binding_id from ingestion.mapping_actor_current_bindings
    where principal_id='${options.principal.principalId}' and dataset_id='${datasetId}' and environment='local'`) : null;
  const subjectHash = options.principal?.subjectHash ?? fixtureHash(`synthetic-only-subject:${login}`);
  const request = {action: options.action ?? (options.principal ? "rebind" : "enroll"), principal_id: options.principal?.principalId ?? null,
    subject_hash: subjectHash, authority, dataset_id: datasetId, environment: "local", login_name: login, prior_binding_id: prior,
    evidence_hash: options.evidenceHash ?? fixtureHash(`synthetic-independent-continuity:${login}:${prior ?? "initial"}`),
    approval_reference: options.reference ?? "synthetic independently verified continuity",
    not_before: new Date(Date.now() - 60_000).toISOString(), expires_at: new Date(Date.now() + 3_600_000).toISOString()};
  const requestId = query(`select ingestion.request_foundation_actor_binding_v1(${actorInput(request)})`, identityGovernor);
  if (query(`select ingestion.request_foundation_actor_binding_v1(${actorInput(request)})`, identityGovernor) !== requestId) throw new Error("Binding proposal retry changed identity.");
  return {request, requestId, subjectHash};
}
export function approveActorBinding(query: ActorQuery, proposal: ReturnType<typeof proposeActorBinding>): PrincipalFixture {
  const reviewed = JSON.parse(query(`select ingestion.get_foundation_actor_binding_request_v1('${proposal.requestId}')`, identityReviewer));
  const hash = reviewed.body_hash as string;
  const bindingId = query(`select ingestion.approve_foundation_actor_binding_v1('${proposal.requestId}','${hash}')`, identityReviewer);
  if (query(`select ingestion.approve_foundation_actor_binding_v1('${proposal.requestId}','${hash}')`, identityReviewer) !== bindingId) throw new Error("Binding decision retry changed identity.");
  const principalId = reviewed.body.principal_id as string;
  return {principalId, subjectHash: proposal.subjectHash, authority: proposal.request.authority, bindingId, requestId: proposal.requestId};
}
export function bindActor(query: ActorQuery, datasetId: string, login: string, authority: "operator" | "approver", principal?: PrincipalFixture) {
  return approveActorBinding(query, proposeActorBinding(query, datasetId, login, authority, {principal}));
}
