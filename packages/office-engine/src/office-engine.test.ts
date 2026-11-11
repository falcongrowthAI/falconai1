import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentOperationalState,
  OfficeSectorId,
  OfficialAgentSlug,
} from '@falcon/contracts';
import {
  createDefaultAgencyOfficeLayout,
  FalconVirtualOfficeWorld,
  OfficeBuilderController,
  pairWorkstations,
} from './index.ts';

describe('@falcon/office-engine — 3D Virtual Office Spatial Engine, Pixel Agents Adaptation & Office Builder', () => {
  it('1. Generates the 9 official agency sectors and pairs all 11 specialist agent workstations with desks and PCs', () => {
    const layout = createDefaultAgencyOfficeLayout('Alpha Growth HQ');
    assert.equal(layout.zones.length, 9);

    const paired = pairWorkstations(layout);
    assert.equal(paired.length, 11);

    for (const ws of paired) {
      assert.ok(ws.assignedAgentSlug);
      assert.ok(ws.deskUid, `Expected seat ${ws.seatUid} to be paired with a desk`);
      assert.equal(
        ws.electronicsUids.length,
        1,
        `Expected seat ${ws.seatUid} to have 1 paired PC monitor`,
      );
    }
  });

  it('2. Supports free user movement (keyboard delta with collision + click-to-move 4-way BFS pathfinding across sectors)', () => {
    const world = new FalconVirtualOfficeWorld({
      userId: 'user-ceo',
      userDisplayName: 'CEO Alpha',
    });

    // Starts in RECEPTION at (5, 5)
    assert.equal(world.player.currentSectorId, OfficeSectorId.RECEPTION);

    // Move right by keyboard delta
    const stepRight = world.movePlayerByDelta(1, 0);
    assert.equal(stepRight.moved, true);
    assert.equal(world.player.col, 6);
    assert.equal(world.player.row, 5);

    // Attempting to walk into top perimeter wall (row 0) is blocked by collision
    world.player.col = 2;
    world.player.row = 1;
    const wallBlocked = world.movePlayerByDelta(0, -1);
    assert.equal(wallBlocked.moved, false);
    assert.equal(world.player.row, 1);

    // Click-to-move BFS navigation from RECEPTION (2, 1) to PERFORMANCE_RESULTS_AREA (26, 19)
    const path = world.navigatePlayerToTile(26, 19);
    assert.ok(path.length > 15);
    assert.equal(world.player.col, 26);
    assert.equal(world.player.row, 19);
    assert.equal(
      world.player.currentSectorId,
      OfficeSectorId.PERFORMANCE_RESULTS_AREA,
    );
  });

  it('3. Binds interactive office objects to their real SaaS modules and navigates user avatar to them', () => {
    const world = new FalconVirtualOfficeWorld({});

    const commandInteraction = world.interactWithFurniture(
      'desk-head-de-marketing',
    );
    assert.equal(commandInteraction.linkedModule, 'FALCON_COMMAND');

    const approvalsInteraction = world.interactWithFurniture(
      'obj-painel-aprovacoes',
    );
    assert.equal(approvalsInteraction.linkedModule, 'FALCON_APPROVALS');
    assert.equal(world.player.currentSectorId, OfficeSectorId.MEETING_ROOM);

    const crmInteraction = world.interactWithFurniture('obj-terminal-crm');
    assert.equal(crmInteraction.linkedModule, 'FALCON_CRM');
  });

  it('4. Synchronizes agent spatial avatars strictly with real backend events (never simulating fake tasks)', () => {
    const world = new FalconVirtualOfficeWorld({});

    const copyAvatar = world.agents.get(OfficialAgentSlug.COPYWRITER)!;
    assert.equal(copyAvatar.operationalState, AgentOperationalState.AVAILABLE);
    assert.equal(copyAvatar.isPcActive, false);

    // Backend emits EXECUTING state for Copywriter
    world.applyRealtimeBackendEvent({
      eventId: 'ev-1',
      organizationId: 'org-1',
      type: 'agent.state_changed',
      timestamp: new Date().toISOString(),
      payload: {
        agentSlug: OfficialAgentSlug.COPYWRITER,
        operationalState: AgentOperationalState.EXECUTING,
        currentTaskId: 'task-copy-123456',
      },
    });

    assert.equal(copyAvatar.operationalState, AgentOperationalState.EXECUTING);
    assert.equal(copyAvatar.isPcActive, true);
    assert.ok(copyAvatar.statusBadgeText.includes('task-c'));

    // Backend emits REVIEWING state for Quality Reviewer -> routes avatar to MEETING_ROOM
    const qaAvatar = world.agents.get(OfficialAgentSlug.QUALITY_REVIEWER)!;
    world.applyRealtimeBackendEvent({
      eventId: 'ev-2',
      organizationId: 'org-1',
      type: 'agent.state_changed',
      timestamp: new Date().toISOString(),
      payload: {
        agentSlug: OfficialAgentSlug.QUALITY_REVIEWER,
        operationalState: AgentOperationalState.REVIEWING,
        currentTaskId: 'task-copy-123456',
      },
    });

    assert.equal(qaAvatar.operationalState, AgentOperationalState.REVIEWING);
    assert.equal(qaAvatar.currentSectorId, OfficeSectorId.MEETING_ROOM);
    assert.ok(qaAvatar.path.length > 0);
  });

  it('5. Supports free construction in OfficeBuilderController with surface riders, rotation, branding, and Undo/Redo', () => {
    const initial = createDefaultAgencyOfficeLayout('Vanguard HQ');
    const builder = new OfficeBuilderController(initial);

    // Move Head Creative's desk (`desk-head-criativo` at col 24, row 2) one tile right to (25, 2)
    // and verify its surface rider (`pc-head-criativo`) automatically rides along!
    const pcBefore = builder
      .getLayout()
      .furniture.find((f) => f.uid === 'pc-head-criativo')!;
    assert.equal(pcBefore.col, 24);
    assert.equal(pcBefore.row, 2);

    builder.moveFurniture('desk-head-criativo', 25, 2);

    const pcAfter = builder
      .getLayout()
      .furniture.find((f) => f.uid === 'pc-head-criativo')!;
    assert.equal(pcAfter.col, 25);
    assert.equal(pcAfter.row, 2);

    // Place a decorative plant at free tile (2, 2) in RECEPTION
    builder.placeFurniture({
      uid: 'custom-plant-1',
      type: 'planta-decorativa',
      col: 2,
      row: 2,
      sectorId: OfficeSectorId.RECEPTION,
    });
    assert.ok(
      builder.getLayout().furniture.some((f) => f.uid === 'custom-plant-1'),
    );

    // Customize branding theme
    builder.updateBranding({
      primaryColor: '#10b981',
      floorStyle: 'tech-dark',
    });
    assert.equal(builder.getLayout().branding.primaryColor, '#10b981');

    // Undo branding change and plant placement
    builder.undo();
    assert.equal(builder.getLayout().branding.primaryColor, '#f59e0b');
    builder.undo();
    assert.equal(
      builder.getLayout().furniture.some((f) => f.uid === 'custom-plant-1'),
      false,
    );

    // Redo plant placement
    builder.redo();
    assert.equal(
      builder.getLayout().furniture.some((f) => f.uid === 'custom-plant-1'),
      true,
    );
  });
});
