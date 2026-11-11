import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canTransitionOrganizationStatus,
  DEFAULT_PLAN_QUOTAS,
  OfficeSectorId,
  OFFICIAL_FALCON_AGENTS,
  OFFICIAL_OFFICE_SECTORS,
  ONBOARDING_STEPS_ORDERED,
  OrganizationStatus,
  PermissionAction,
  PlanTier,
  roleHasPermission,
  TenantRole,
} from './index.ts';

describe('@falcon/contracts', () => {
  it('defines all 11 official FALCON AI TEAM specialists with exactly 1 supervisor (Head de Marketing)', () => {
    assert.equal(OFFICIAL_FALCON_AGENTS.length, 11);
    const supervisors = OFFICIAL_FALCON_AGENTS.filter((a) => a.isSupervisor);
    assert.equal(supervisors.length, 1);
    assert.equal(supervisors[0].slug, 'head-de-marketing');
    assert.equal(supervisors[0].defaultSector, OfficeSectorId.HEAD_OFFICE);
  });

  it('defines all 9 official 3D Virtual Office environments and 11 Onboarding steps', () => {
    assert.equal(OFFICIAL_OFFICE_SECTORS.length, 9);
    assert.equal(ONBOARDING_STEPS_ORDERED.length, 11);
  });

  it('enforces valid organization lifecycle state transitions', () => {
    assert.equal(
      canTransitionOrganizationStatus(
        OrganizationStatus.LEAD,
        OrganizationStatus.COMMERCIAL_ONBOARDING,
      ),
      true,
    );
    // Um LEAD não pode pular direto para ACTIVE sem passar por PROVISIONING!
    assert.equal(
      canTransitionOrganizationStatus(
        OrganizationStatus.LEAD,
        OrganizationStatus.ACTIVE,
      ),
      false,
    );
    assert.equal(
      canTransitionOrganizationStatus(
        OrganizationStatus.PROVISIONING,
        OrganizationStatus.ACTIVE,
      ),
      true,
    );
  });

  it('enforces least-privilege RBAC permissions per tenant role', () => {
    assert.equal(
      roleHasPermission(
        TenantRole.OWNER,
        PermissionAction.AUTHORIZE_ADS_BUDGET,
      ),
      true,
    );
    assert.equal(
      roleHasPermission(
        TenantRole.MEMBER,
        PermissionAction.AUTHORIZE_ADS_BUDGET,
      ),
      false,
    );
    assert.equal(
      roleHasPermission(
        TenantRole.APPROVER,
        PermissionAction.APPROVE_DELIVERABLES,
      ),
      true,
    );
    assert.equal(
      roleHasPermission(
        TenantRole.VIEWER,
        PermissionAction.DELETE_TENANT_DATA,
      ),
      false,
    );
  });

  it('provides measurable plan quotas for Starter, Growth, and Premium', () => {
    assert.equal(DEFAULT_PLAN_QUOTAS[PlanTier.STARTER].allowPaidAdsModule, false);
    assert.equal(DEFAULT_PLAN_QUOTAS[PlanTier.PREMIUM].allowPaidAdsModule, true);
    assert.equal(DEFAULT_PLAN_QUOTAS[PlanTier.PREMIUM].maxActiveAgents, 11);
  });
});
