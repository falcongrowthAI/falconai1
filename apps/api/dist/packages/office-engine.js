import {
  AgentOperationalState,
  OFFICIAL_FALCON_AGENTS,
  OFFICIAL_OFFICE_SECTORS,
  OfficeSectorId,
  OfficialAgentSlug,
                             
} from './contracts.js';

// ============================================================================
// 1. TIPOS DE GRID, TILES E MOBILIÁRIO (Adaptado de Pixel Agents v1.6.0)
// ============================================================================

export const TILE_SIZE = 16;

export const TileType = {
  WALL: 0,
  FLOOR_1: 1,
  FLOOR_2: 2,
  FLOOR_3: 3,
  FLOOR_4: 4,
  FLOOR_5: 5,
  FLOOR_6: 6,
  FLOOR_7: 7,
  FLOOR_8: 8,
  FLOOR_9: 9,
  VOID: 255,
}         ;
                                                                

export const Direction = {
  DOWN: 0,
  LEFT: 1,
  RIGHT: 2,
  UP: 3,
}         ;
                                                                   

                            
              
              
 

                               
           
            
                 
                        
             
           
               

                              
                    
                    
                      
                        
                   
                
                               
                
                   
                   

                                       
               
                
                              
                     
                     
                  
                              
                          
                         
                                  
                       
 

                                        
              
               
              
              
                         
                           
                                  
                       
                       
 

                                 
                           
                
                   
                   
                
                 
                      
                      
                       
 

                                  
                  
                  
                  
                       
                         
                            
                           
                                              
 

                                      
                      
                   
                       
                         
                    
                                                                 
                                                            
 

                                     
                  
                      
               
               
               
                    
                          
                                     
                                                                  
                                
 

// ============================================================================
// 2. CATÁLOGO OFICIAL DE MOBILIÁRIO E OBJETOS INTERATIVOS (Seções 13.4 e 14)
// ============================================================================

export const FALCON_FURNITURE_CATALOG           
                                      
  = {
  'desk-exec-down': {
    type: 'desk-exec-down',
    label: 'Mesa Executiva (Sul)',
    category: 'desks',
    footprintW: 2,
    footprintH: 1,
    isDesk: true,
    canPlaceOnSurfaces: false,
    blocksMovement: true,
    orientation: Direction.DOWN,
    rotatedType: 'desk-exec-right',
  },
  'desk-exec-right': {
    type: 'desk-exec-right',
    label: 'Mesa Executiva (Leste)',
    category: 'desks',
    footprintW: 1,
    footprintH: 2,
    isDesk: true,
    canPlaceOnSurfaces: false,
    blocksMovement: true,
    orientation: Direction.RIGHT,
    rotatedType: 'desk-exec-down',
  },
  'chair-ergonomic-up': {
    type: 'chair-ergonomic-up',
    label: 'Cadeira Ergonômica (Norte)',
    category: 'chairs',
    footprintW: 1,
    footprintH: 1,
    isDesk: false,
    canPlaceOnSurfaces: false,
    blocksMovement: false,
    orientation: Direction.UP,
    rotatedType: 'chair-ergonomic-left',
  },
  'chair-ergonomic-left': {
    type: 'chair-ergonomic-left',
    label: 'Cadeira Ergonômica (Oeste)',
    category: 'chairs',
    footprintW: 1,
    footprintH: 1,
    isDesk: false,
    canPlaceOnSurfaces: false,
    blocksMovement: false,
    orientation: Direction.LEFT,
    rotatedType: 'chair-ergonomic-down',
  },
  'chair-ergonomic-down': {
    type: 'chair-ergonomic-down',
    label: 'Cadeira Ergonômica (Sul)',
    category: 'chairs',
    footprintW: 1,
    footprintH: 1,
    isDesk: false,
    canPlaceOnSurfaces: false,
    blocksMovement: false,
    orientation: Direction.DOWN,
    rotatedType: 'chair-ergonomic-right',
  },
  'chair-ergonomic-right': {
    type: 'chair-ergonomic-right',
    label: 'Cadeira Ergonômica (Leste)',
    category: 'chairs',
    footprintW: 1,
    footprintH: 1,
    isDesk: false,
    canPlaceOnSurfaces: false,
    blocksMovement: false,
    orientation: Direction.RIGHT,
    rotatedType: 'chair-ergonomic-up',
  },
  'workstation-pc': {
    type: 'workstation-pc',
    label: 'Monitor Ultrawide & Estação IA',
    category: 'electronics',
    footprintW: 1,
    footprintH: 1,
    isDesk: false,
    canPlaceOnSurfaces: true,
    blocksMovement: false,
    orientation: Direction.DOWN,
  },
  // Objetos Interativos Oficiais da Seção 13.4 do Documento Mestre:
  'mesa-head-marketing': {
    type: 'mesa-head-marketing',
    label: 'Mesa de Comando do Head de Marketing',
    category: 'interactive_totems',
    footprintW: 2,
    footprintH: 1,
    isDesk: true,
    canPlaceOnSurfaces: false,
    blocksMovement: true,
    orientation: Direction.DOWN,
    linkedModule: 'FALCON_COMMAND',
  },
  'quadro-planejamento': {
    type: 'quadro-planejamento',
    label: 'Quadro de Planejamento & Pautas',
    category: 'interactive_totems',
    footprintW: 2,
    footprintH: 1,
    isDesk: false,
    canPlaceOnSurfaces: false,
    blocksMovement: true,
    orientation: Direction.DOWN,
    linkedModule: 'PROJECTS_TASKS',
  },
  'painel-aprovacoes': {
    type: 'painel-aprovacoes',
    label: 'Painel Central de Aprovações',
    category: 'interactive_totems',
    footprintW: 2,
    footprintH: 1,
    isDesk: false,
    canPlaceOnSurfaces: false,
    blocksMovement: true,
    orientation: Direction.DOWN,
    linkedModule: 'FALCON_APPROVALS',
  },
  'tela-performance-tv': {
    type: 'tela-performance-tv',
    label: 'Tela Executiva de Resultados & ROI',
    category: 'interactive_totems',
    footprintW: 2,
    footprintH: 1,
    isDesk: false,
    canPlaceOnSurfaces: false,
    blocksMovement: true,
    orientation: Direction.DOWN,
    linkedModule: 'FALCON_PERFORMANCE',
  },
  'bancada-design-studio': {
    type: 'bancada-design-studio',
    label: 'Bancada Criativa de Design & Carrosséis',
    category: 'interactive_totems',
    footprintW: 2,
    footprintH: 1,
    isDesk: true,
    canPlaceOnSurfaces: false,
    blocksMovement: true,
    orientation: Direction.DOWN,
    linkedModule: 'FALCON_STUDIO',
  },
  'ilha-edicao-video': {
    type: 'ilha-edicao-video',
    label: 'Ilha de Edição Audiovisual & Reels',
    category: 'interactive_totems',
    footprintW: 2,
    footprintH: 1,
    isDesk: true,
    canPlaceOnSurfaces: false,
    blocksMovement: true,
    orientation: Direction.DOWN,
    linkedModule: 'FALCON_STUDIO',
  },
  'central-trafego-ads': {
    type: 'central-trafego-ads',
    label: 'Central de Operações de Tráfego Pago',
    category: 'interactive_totems',
    footprintW: 2,
    footprintH: 1,
    isDesk: true,
    canPlaceOnSurfaces: false,
    blocksMovement: true,
    orientation: Direction.DOWN,
    linkedModule: 'FALCON_ADS',
  },
  'totem-brand-intelligence': {
    type: 'totem-brand-intelligence',
    label: 'Totem da Memória Viva da Marca',
    category: 'interactive_totems',
    footprintW: 1,
    footprintH: 1,
    isDesk: false,
    canPlaceOnSurfaces: false,
    blocksMovement: true,
    orientation: Direction.DOWN,
    linkedModule: 'FALCON_BRAND_INTELLIGENCE',
  },
  'terminal-crm-pipeline': {
    type: 'terminal-crm-pipeline',
    label: 'Terminal Comercial & Funil CRM',
    category: 'interactive_totems',
    footprintW: 1,
    footprintH: 1,
    isDesk: false,
    canPlaceOnSurfaces: false,
    blocksMovement: true,
    orientation: Direction.DOWN,
    linkedModule: 'FALCON_CRM',
  },
  'mesa-reuniao-central': {
    type: 'mesa-reuniao-central',
    label: 'Mesa de Reuniões Multidisciplinares',
    category: 'meeting',
    footprintW: 3,
    footprintH: 2,
    isDesk: true,
    canPlaceOnSurfaces: false,
    blocksMovement: true,
    orientation: Direction.DOWN,
    linkedModule: 'FALCON_APPROVALS',
  },
  'planta-decorativa': {
    type: 'planta-decorativa',
    label: 'Planta Arquitetônica',
    category: 'decor',
    footprintW: 1,
    footprintH: 1,
    isDesk: false,
    canPlaceOnSurfaces: false,
    blocksMovement: true,
    orientation: Direction.DOWN,
  },
};

export function getCatalogItem(type        )                                   {
  return FALCON_FURNITURE_CATALOG[type];
}

// ============================================================================
// 3. PATHFINDING BFS 4-WAY E MAPA DE COLISÃO (Adaptado de tileMap.ts)
// ============================================================================

export function getBlockedTileSet(
  furniture                                  ,
  excludeUid         ,
)              {
  const blocked = new Set        ();
  for (const item of furniture) {
    if (item.uid === excludeUid) continue;
    const entry = getCatalogItem(item.type);
    if (!entry || !entry.blocksMovement) continue;
    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        blocked.add(`${item.col + dc},${item.row + dr}`);
      }
    }
  }
  return blocked;
}

export function isTileWalkable(
  col        ,
  row        ,
  layout                                                     ,
  blockedTiles             ,
)          {
  if (col < 0 || row < 0 || col >= layout.cols || row >= layout.rows) {
    return false;
  }
  const t = layout.tiles[row * layout.cols + col];
  if (t === TileType.WALL || t === TileType.VOID || t === undefined) {
    return false;
  }
  if (blockedTiles.has(`${col},${row}`)) {
    return false;
  }
  return true;
}

/**
 * BFS 4-conectado sobre o grid do escritório (adaptado de Pixel Agents `tileMap.ts`).
 * Retorna o caminho passo a passo (excluindo a posição inicial, incluindo o destino).
 */
export function findPath(
  startCol        ,
  startRow        ,
  endCol        ,
  endRow        ,
  layout                                                     ,
  blockedTiles             ,
)              {
  if (startCol === endCol && startRow === endRow) return [];

  const startKey = `${startCol},${startRow}`;
  const endKey = `${endCol},${endRow}`;

  // Se o próprio destino estiver bloqueado (ex: clicou sobre uma mesa interativa),
  // busca o tile caminhável adjacente mais próximo!
  let targetCol = endCol;
  let targetRow = endRow;
  let targetKey = endKey;

  if (!isTileWalkable(targetCol, targetRow, layout, blockedTiles)) {
    const neighbors              = [
      { col: endCol, row: endRow + 1 },
      { col: endCol, row: endRow - 1 },
      { col: endCol - 1, row: endRow },
      { col: endCol + 1, row: endRow },
    ];
    const validNeighbor = neighbors.find((n) =>
      isTileWalkable(n.col, n.row, layout, blockedTiles),
    );
    if (!validNeighbor) return [];
    targetCol = validNeighbor.col;
    targetRow = validNeighbor.row;
    targetKey = `${targetCol},${targetRow}`;
    if (targetKey === startKey) return [];
  }

  const visited = new Set        ([startKey]);
  const parent = new Map                ();
  const queue              = [{ col: startCol, row: startRow }];

  const dirs              = [
    { col: 0, row: -1 },
    { col: 0, row: 1 },
    { col: -1, row: 0 },
    { col: 1, row: 0 },
  ];

  while (queue.length > 0) {
    const curr = queue.shift() ;
    const currKey = `${curr.col},${curr.row}`;

    if (currKey === targetKey) {
      const path              = [];
      let k = targetKey;
      while (k !== startKey) {
        const [c, r] = k.split(',').map(Number);
        path.unshift({ col: c, row: r });
        k = parent.get(k) ;
      }
      return path;
    }

    for (const d of dirs) {
      const nc = curr.col + d.col;
      const nr = curr.row + d.row;
      const nKey = `${nc},${nr}`;
      if (visited.has(nKey)) continue;
      if (!isTileWalkable(nc, nr, layout, blockedTiles)) continue;
      visited.add(nKey);
      parent.set(nKey, currKey);
      queue.push({ col: nc, row: nr });
    }
  }

  return [];
}

// ============================================================================
// 4. PAREAMENTO DE ESTAÇÕES DE TRABALHO (Adaptado de workstations.ts)
// ============================================================================

const DIR_VECTORS                                                = {
  [Direction.DOWN]: { dc: 0, dr: 1 },
  [Direction.UP]: { dc: 0, dr: -1 },
  [Direction.LEFT]: { dc: -1, dr: 0 },
  [Direction.RIGHT]: { dc: 1, dr: 0 },
};

export function pairWorkstations(layout                    )                    {
  const chairs = layout.furniture.filter(
    (f) => getCatalogItem(f.type)?.category === 'chairs',
  );
  const desks = layout.furniture.filter((f) => getCatalogItem(f.type)?.isDesk);
  const electronics = layout.furniture.filter(
    (f) => getCatalogItem(f.type)?.category === 'electronics',
  );

  // Mapa reverso seatUid -> agentSlug
  const seatToAgent = new Map                           ();
  for (const [agentSlug, seatUid] of Object.entries(layout.seatAssignments)) {
    seatToAgent.set(seatUid, agentSlug                     );
  }

  return chairs.map((chair) => {
    const entry = getCatalogItem(chair.type) ;
    const facing = entry.orientation;
    const vec = DIR_VECTORS[facing];
    const targetCol = chair.col + vec.dc;
    const targetRow = chair.row + vec.dr;

    // Procura mesa imediatamente à frente da cadeira
    const pairedDesk =
      desks.find((d) => {
        const dEntry = getCatalogItem(d.type) ;
        return (
          targetCol >= d.col &&
          targetCol < d.col + dEntry.footprintW &&
          targetRow >= d.row &&
          targetRow < d.row + dEntry.footprintH
        );
      }) ?? null;

    // Procura eletrônicos sobre a mesa pareada
    const pairedElectronics = pairedDesk
      ? electronics
          .filter((e) => {
            const dEntry = getCatalogItem(pairedDesk.type) ;
            return (
              e.col >= pairedDesk.col &&
              e.col < pairedDesk.col + dEntry.footprintW &&
              e.row >= pairedDesk.row &&
              e.row < pairedDesk.row + dEntry.footprintH
            );
          })
          .map((e) => e.uid)
      : [];

    return {
      seatUid: chair.uid,
      seatCol: chair.col,
      seatRow: chair.row,
      facingDir: facing,
      deskUid: pairedDesk?.uid ?? null,
      electronicsUids: pairedElectronics,
      sectorId: chair.sectorId,
      assignedAgentSlug: seatToAgent.get(chair.uid) ?? null,
    };
  });
}

// ============================================================================
// 5. TEMPLATES PRONTOS DO ESCRITÓRIO VIRTUAL 3D (9 SETORES OFICIAIS — Seção 13.1)
// ============================================================================

export function createDefaultAgencyOfficeLayout(
  companyName = 'FALCON GROWTH HQ',
  templateKey 
                           
                                
                                   = 'falcon-agency-hq-v1',
)                     {
  const cols = templateKey === 'falcon-enterprise-floor-v1' ? 38 : 32;
  const rows = templateKey === 'falcon-compact-studio-v1' ? 18 : 22;
  const tiles             = new Array(cols * rows).fill(TileType.FLOOR_1);

  // Paredes perimetrais
  for (let c = 0; c < cols; c++) {
    tiles[0 * cols + c] = TileType.WALL;
    tiles[(rows - 1) * cols + c] = TileType.WALL;
  }
  for (let r = 0; r < rows; r++) {
    tiles[r * cols + 0] = TileType.WALL;
    tiles[r * cols + (cols - 1)] = TileType.WALL;
  }

  // Os 9 Ambientes Oficiais da Seção 13.1 do Documento Mestre distribuídos espacialmente
  const zones                   = [
    {
      sectorId: OfficeSectorId.RECEPTION,
      label: '1. Recepção & Identidade da Marca',
      colStart: 1,
      rowStart: 1,
      width: 9,
      height: 6,
      floorTile: TileType.FLOOR_1,
      accentColor: '#f59e0b',
      linkedModule: 'BRAND_INTELLIGENCE',
    },
    {
      sectorId: OfficeSectorId.HEAD_OFFICE,
      label: '2. Sala do Head de Marketing',
      colStart: 10,
      rowStart: 1,
      width: 11,
      height: 6,
      floorTile: TileType.FLOOR_2,
      accentColor: '#3b82f6',
      linkedModule: 'COMMAND',
    },
    {
      sectorId: OfficeSectorId.STRATEGY_PLANNING,
      label: '3. Estratégia & Planejamento',
      colStart: 21,
      rowStart: 1,
      width: 10,
      height: 6,
      floorTile: TileType.FLOOR_3,
      accentColor: '#8b5cf6',
      linkedModule: 'PROJECTS',
    },
    {
      sectorId: OfficeSectorId.SOCIAL_MEDIA_AREA,
      label: '4. Conteúdo, Copy & Social Media',
      colStart: 1,
      rowStart: 7,
      width: 10,
      height: 7,
      floorTile: TileType.FLOOR_4,
      accentColor: '#10b981',
      linkedModule: 'SOCIAL',
    },
    {
      sectorId: OfficeSectorId.MEETING_ROOM,
      label: '8. Sala de Reuniões & Aprovações',
      colStart: 11,
      rowStart: 7,
      width: 10,
      height: 7,
      floorTile: TileType.FLOOR_8,
      accentColor: '#eab308',
      linkedModule: 'APPROVALS',
    },
    {
      sectorId: OfficeSectorId.DESIGN_BRANDING_AREA,
      label: '5. Estúdio de Design & Branding',
      colStart: 21,
      rowStart: 7,
      width: 10,
      height: 7,
      floorTile: TileType.FLOOR_5,
      accentColor: '#ec4899',
      linkedModule: 'STUDIO',
    },
    {
      sectorId: OfficeSectorId.AUDIOVISUAL_STUDIO,
      label: '6. Estúdio Audiovisual & Vídeo',
      colStart: 1,
      rowStart: 14,
      width: 10,
      height: 7,
      floorTile: TileType.FLOOR_6,
      accentColor: '#ef4444',
      linkedModule: 'STUDIO',
    },
    {
      sectorId: OfficeSectorId.PAID_TRAFFIC_AREA,
      label: '7. Operações de Tráfego Pago',
      colStart: 11,
      rowStart: 14,
      width: 10,
      height: 7,
      floorTile: TileType.FLOOR_7,
      accentColor: '#06b6d4',
      linkedModule: 'ADS',
    },
    {
      sectorId: OfficeSectorId.PERFORMANCE_RESULTS_AREA,
      label: '9. Performance, Qualidade & CRM',
      colStart: 21,
      rowStart: 14,
      width: 10,
      height: 7,
      floorTile: TileType.FLOOR_9,
      accentColor: '#6366f1',
      linkedModule: 'PERFORMANCE',
    },
  ];

  // Aplica o piso de cada zona no array de tiles
  for (const zone of zones) {
    for (let r = zone.rowStart; r < zone.rowStart + zone.height && r < rows - 1; r++) {
      for (let c = zone.colStart; c < zone.colStart + zone.width && c < cols - 1; c++) {
        tiles[r * cols + c] = zone.floorTile;
      }
    }
  }

  // Coordenadas das 11 estações de trabalho dos 11 agentes oficiais dentro de seus respectivos setores
  const agentStationCoords         
                      
                                                          
    = {
    [OfficialAgentSlug.HEAD_MARKETING]: {
      col: 14,
      row: 3,
      sectorId: OfficeSectorId.HEAD_OFFICE,
    },
    [OfficialAgentSlug.HEAD_CREATIVE]: {
      col: 24,
      row: 3,
      sectorId: OfficeSectorId.STRATEGY_PLANNING,
    },
    [OfficialAgentSlug.SOCIAL_MEDIA]: {
      col: 3,
      row: 9,
      sectorId: OfficeSectorId.SOCIAL_MEDIA_AREA,
    },
    [OfficialAgentSlug.COPYWRITER]: {
      col: 7,
      row: 9,
      sectorId: OfficeSectorId.SOCIAL_MEDIA_AREA,
    },
    [OfficialAgentSlug.PUBLISHING_AGENT]: {
      col: 5,
      row: 12,
      sectorId: OfficeSectorId.SOCIAL_MEDIA_AREA,
    },
    [OfficialAgentSlug.BRANDING_DESIGNER]: {
      col: 23,
      row: 9,
      sectorId: OfficeSectorId.DESIGN_BRANDING_AREA,
    },
    [OfficialAgentSlug.ART_CAROUSEL_DESIGNER]: {
      col: 27,
      row: 9,
      sectorId: OfficeSectorId.DESIGN_BRANDING_AREA,
    },
    [OfficialAgentSlug.VIDEO_EDITOR]: {
      col: 4,
      row: 17,
      sectorId: OfficeSectorId.AUDIOVISUAL_STUDIO,
    },
    [OfficialAgentSlug.PAID_TRAFFIC_MANAGER]: {
      col: 15,
      row: 17,
      sectorId: OfficeSectorId.PAID_TRAFFIC_AREA,
    },
    [OfficialAgentSlug.PERFORMANCE_ANALYST]: {
      col: 23,
      row: 17,
      sectorId: OfficeSectorId.PERFORMANCE_RESULTS_AREA,
    },
    [OfficialAgentSlug.QUALITY_REVIEWER]: {
      col: 27,
      row: 17,
      sectorId: OfficeSectorId.PERFORMANCE_RESULTS_AREA,
    },
  };

  const furniture                          = [];
  const seatAssignments                         = {};

  for (const agent of OFFICIAL_FALCON_AGENTS) {
    const pos = agentStationCoords[agent.slug];
    const deskUid = `desk-${agent.slug}`;
    const pcUid = `pc-${agent.slug}`;
    const seatUid = `seat-${agent.slug}`;

    const deskType =
      agent.slug === OfficialAgentSlug.HEAD_MARKETING
        ? 'mesa-head-marketing'
        : 'desk-exec-down';

    furniture.push({
      uid: deskUid,
      type: deskType,
      col: pos.col,
      row: pos.row - 1,
      orientation: Direction.DOWN,
      sectorId: pos.sectorId,
      customLabel: `Estação ${agent.name}`,
      linkedModule:
        agent.slug === OfficialAgentSlug.HEAD_MARKETING
          ? 'FALCON_COMMAND'
          : undefined,
    });

    furniture.push({
      uid: pcUid,
      type: 'workstation-pc',
      col: pos.col,
      row: pos.row - 1,
      orientation: Direction.DOWN,
      sectorId: pos.sectorId,
    });

    furniture.push({
      uid: seatUid,
      type: 'chair-ergonomic-up',
      col: pos.col,
      row: pos.row,
      orientation: Direction.UP,
      sectorId: pos.sectorId,
      customLabel: `Assento ${agent.roleTitle}`,
    });

    seatAssignments[agent.slug] = seatUid;
  }

  // Objetos interativos oficiais da agência (Seção 13.4)
  furniture.push(
    {
      uid: 'obj-totem-brand',
      type: 'totem-brand-intelligence',
      col: 4,
      row: 3,
      orientation: Direction.DOWN,
      sectorId: OfficeSectorId.RECEPTION,
      linkedModule: 'FALCON_BRAND_INTELLIGENCE',
      customLabel: 'Totem FALCON BRAND INTELLIGENCE',
    },
    {
      uid: 'obj-quadro-planejamento',
      type: 'quadro-planejamento',
      col: 27,
      row: 2,
      orientation: Direction.DOWN,
      sectorId: OfficeSectorId.STRATEGY_PLANNING,
      linkedModule: 'PROJECTS_TASKS',
      customLabel: 'Quadro de Planejamento & Pautas',
    },
    {
      uid: 'obj-mesa-reuniao',
      type: 'mesa-reuniao-central',
      col: 14,
      row: 10,
      orientation: Direction.DOWN,
      sectorId: OfficeSectorId.MEETING_ROOM,
      linkedModule: 'FALCON_APPROVALS',
      customLabel: 'Mesa de Reuniões & Alinhamento',
    },
    {
      uid: 'obj-painel-aprovacoes',
      type: 'painel-aprovacoes',
      col: 18,
      row: 8,
      orientation: Direction.DOWN,
      sectorId: OfficeSectorId.MEETING_ROOM,
      linkedModule: 'FALCON_APPROVALS',
      customLabel: 'Central FALCON APPROVALS',
    },
    {
      uid: 'obj-bancada-design',
      type: 'bancada-design-studio',
      col: 25,
      row: 12,
      orientation: Direction.DOWN,
      sectorId: OfficeSectorId.DESIGN_BRANDING_AREA,
      linkedModule: 'FALCON_STUDIO',
      customLabel: 'Bancada FALCON STUDIO',
    },
    {
      uid: 'obj-ilha-video',
      type: 'ilha-edicao-video',
      col: 7,
      row: 15,
      orientation: Direction.DOWN,
      sectorId: OfficeSectorId.AUDIOVISUAL_STUDIO,
      linkedModule: 'FALCON_STUDIO',
      customLabel: 'Ilha de Edição Audiovisual',
    },
    {
      uid: 'obj-central-ads',
      type: 'central-trafego-ads',
      col: 12,
      row: 15,
      orientation: Direction.DOWN,
      sectorId: OfficeSectorId.PAID_TRAFFIC_AREA,
      linkedModule: 'FALCON_ADS',
      customLabel: 'Central FALCON ADS',
    },
    {
      uid: 'obj-tela-performance',
      type: 'tela-performance-tv',
      col: 24,
      row: 14,
      orientation: Direction.DOWN,
      sectorId: OfficeSectorId.PERFORMANCE_RESULTS_AREA,
      linkedModule: 'FALCON_PERFORMANCE',
      customLabel: 'Painel FALCON PERFORMANCE',
    },
    {
      uid: 'obj-terminal-crm',
      type: 'terminal-crm-pipeline',
      col: 29,
      row: 15,
      orientation: Direction.DOWN,
      sectorId: OfficeSectorId.PERFORMANCE_RESULTS_AREA,
      linkedModule: 'FALCON_CRM',
      customLabel: 'Terminal FALCON CRM',
    },
  );

  return {
    version: 1,
    templateKey,
    name: `Sede Virtual 3D — ${companyName}`,
    cols,
    rows,
    tiles,
    zones,
    furniture,
    seatAssignments,
    branding: {
      companyName,
      logoText: companyName.slice(0, 18).toUpperCase(),
      primaryColor: '#f59e0b',
      secondaryColor: '#3b82f6',
      wallColor: '#1e293b',
      floorStyle: 'executive-wood',
      lightingPreset: 'daylight',
    },
  };
}

// ============================================================================
// 6. SIMULAÇÃO ESPACIAL EM TEMPO REAL (Movimentação Livre do Usuário + Agentes Reais)
// ============================================================================

                                      
                 
                      
              
              
            
            
                 
                    
                                  
 

                                     
                          
               
                    
                     
                        
                  
              
              
            
            
                 
                    
                         
                                  
                                          
                               
                          
                      
 

export class FalconVirtualOfficeWorld {
  layout                    ;
           player                     ;
           agents = new Map                                       ();
          blockedTiles             ;
          workstations                   ;

  constructor(params   
                                
                    
                             
   ) {
    this.layout =
      params.layout ?? createDefaultAgencyOfficeLayout('FALCON GROWTH HQ');
    this.blockedTiles = getBlockedTileSet(this.layout.furniture);
    this.workstations = pairWorkstations(this.layout);

    // Posiciona o avatar do usuário na Recepção inicialmente
    const startCol = 5;
    const startRow = 5;
    this.player = {
      userId: params.userId ?? 'user-owner',
      displayName: params.userDisplayName ?? 'Diretor(a)',
      col: startCol,
      row: startRow,
      x: startCol * TILE_SIZE + TILE_SIZE / 2,
      y: startRow * TILE_SIZE + TILE_SIZE / 2,
      dir: Direction.DOWN,
      path: [],
      currentSectorId: OfficeSectorId.RECEPTION,
    };

    this.initializeAgentsAtWorkstations();
  }

          initializeAgentsAtWorkstations()       {
    const wsBySeat = new Map(this.workstations.map((w) => [w.seatUid, w]));
    for (const blueprint of OFFICIAL_FALCON_AGENTS) {
      const seatUid = this.layout.seatAssignments[blueprint.slug] ?? null;
      const ws = seatUid ? wsBySeat.get(seatUid) : undefined;
      const col = ws ? ws.seatCol : 10;
      const row = ws ? ws.seatRow : 5;
      const dir = ws ? ws.facingDir : Direction.DOWN;

      this.agents.set(blueprint.slug, {
        slug: blueprint.slug,
        name: blueprint.name,
        roleTitle: blueprint.roleTitle,
        department: blueprint.department,
        isSupervisor: blueprint.isSupervisor,
        palette: blueprint.defaultPaletteIndex,
        col,
        row,
        x: col * TILE_SIZE + TILE_SIZE / 2,
        y: row * TILE_SIZE + TILE_SIZE / 2,
        dir,
        path: [],
        seatUid,
        currentSectorId: blueprint.defaultSector,
        operationalState: AgentOperationalState.AVAILABLE,
        currentTaskId: null,
        statusBadgeText: 'Disponível na estação',
        isPcActive: false,
      });
    }
  }

  /**
   * Movimentação Livre do Usuário por Teclado (WASD / Setas — Seção 5 e Seção 13.2).
   */
  movePlayerByDelta(dc        , dr        )   
                   
                
                
                             
    {
    const targetCol = this.player.col + dc;
    const targetRow = this.player.row + dr;

    if (dc > 0) this.player.dir = Direction.RIGHT;
    else if (dc < 0) this.player.dir = Direction.LEFT;
    else if (dr > 0) this.player.dir = Direction.DOWN;
    else if (dr < 0) this.player.dir = Direction.UP;

    if (!isTileWalkable(targetCol, targetRow, this.layout, this.blockedTiles)) {
      return {
        moved: false,
        col: this.player.col,
        row: this.player.row,
        sectorId: this.player.currentSectorId,
      };
    }

    this.player.col = targetCol;
    this.player.row = targetRow;
    this.player.x = targetCol * TILE_SIZE + TILE_SIZE / 2;
    this.player.y = targetRow * TILE_SIZE + TILE_SIZE / 2;
    this.player.path = [];
    this.player.currentSectorId = this.resolveSectorAt(targetCol, targetRow);

    return {
      moved: true,
      col: this.player.col,
      row: this.player.row,
      sectorId: this.player.currentSectorId,
    };
  }

  /**
   * Movimentação Livre do Usuário por Clique ou Toque no Piso (BFS Pathfinding — Seção 13.2).
   */
  navigatePlayerToTile(targetCol        , targetRow        )              {
    const path = findPath(
      this.player.col,
      this.player.row,
      targetCol,
      targetRow,
      this.layout,
      this.blockedTiles,
    );
    this.player.path = path;
    if (path.length > 0) {
      const dest = path[path.length - 1];
      this.player.col = dest.col;
      this.player.row = dest.row;
      this.player.x = dest.col * TILE_SIZE + TILE_SIZE / 2;
      this.player.y = dest.row * TILE_SIZE + TILE_SIZE / 2;
      this.player.currentSectorId = this.resolveSectorAt(dest.col, dest.row);
    }
    return path;
  }

  /**
   * Interação direta com objetos do Escritório Virtual (Seção 13.4).
   */
  interactWithFurniture(furnitureUid        )   
                                     
                                          
    {
    const item = this.layout.furniture.find((f) => f.uid === furnitureUid);
    if (!item) {
      throw new Error(`Objeto '${furnitureUid}' não encontrado no escritório.`);
    }
    const catalogEntry = getCatalogItem(item.type);
    const linkedModule =
      item.linkedModule ?? catalogEntry?.linkedModule ?? null;

    // Move o avatar do usuário para perto do objeto clicado
    this.navigatePlayerToTile(item.col, item.row + 1);

    return { furniture: item, linkedModule };
  }

  /**
   * Sincroniza o estado visual e a posição do agente exclusivamente a partir de um evento real do backend.
   * Regra Inegociável (Seção 4 e 13.3): Nunca cria animações falsas para tarefas inexistentes!
   */
  applyRealtimeBackendEvent(event                       )       {
    if (event.type === 'agent.state_changed') {
      const payload = event.payload     
                                     
                                                
                                     
                                      
       ;

      const avatar = this.agents.get(payload.agentSlug);
      if (!avatar) return;

      avatar.operationalState = payload.operationalState;
      avatar.currentTaskId = payload.currentTaskId;

      const wsBySeat = new Map(this.workstations.map((w) => [w.seatUid, w]));
      const ownWs = avatar.seatUid ? wsBySeat.get(avatar.seatUid) : undefined;

      if (
        payload.operationalState === AgentOperationalState.IN_MEETING ||
        payload.operationalState === AgentOperationalState.REVIEWING
      ) {
        // Desloca o agente até a Sala de Reuniões usando BFS real
        const meetingCol = 15 + (avatar.palette % 3);
        const meetingRow = 12;
        avatar.path = findPath(
          avatar.col,
          avatar.row,
          meetingCol,
          meetingRow,
          this.layout,
          this.blockedTiles,
        );
        if (avatar.path.length > 0) {
          const dest = avatar.path[avatar.path.length - 1];
          avatar.col = dest.col;
          avatar.row = dest.row;
          avatar.x = dest.col * TILE_SIZE + TILE_SIZE / 2;
          avatar.y = dest.row * TILE_SIZE + TILE_SIZE / 2;
        }
        avatar.currentSectorId = OfficeSectorId.MEETING_ROOM;
        avatar.isPcActive = false;
        avatar.statusBadgeText =
          payload.operationalState === AgentOperationalState.REVIEWING
            ? 'Revisando qualidade da entrega'
            : 'Em reunião de alinhamento';
      } else {
        // Retorna ou permanece em sua estação de trabalho oficial
        if (ownWs && (avatar.col !== ownWs.seatCol || avatar.row !== ownWs.seatRow)) {
          avatar.path = findPath(
            avatar.col,
            avatar.row,
            ownWs.seatCol,
            ownWs.seatRow,
            this.layout,
            this.blockedTiles,
          );
          avatar.col = ownWs.seatCol;
          avatar.row = ownWs.seatRow;
          avatar.x = ownWs.seatCol * TILE_SIZE + TILE_SIZE / 2;
          avatar.y = ownWs.seatRow * TILE_SIZE + TILE_SIZE / 2;
          avatar.dir = ownWs.facingDir;
        }

        avatar.isPcActive =
          payload.operationalState === AgentOperationalState.EXECUTING ||
          payload.operationalState === AgentOperationalState.PLANNING ||
          payload.operationalState === AgentOperationalState.CREATING;

        avatar.statusBadgeText = this.describeAgentState(
          payload.operationalState,
          payload.currentTaskId,
        );
      }
    }
  }

          describeAgentState(
    state                       ,
    taskId               ,
  )         {
    switch (state) {
      case AgentOperationalState.PLANNING:
        return 'Planejando e distribuindo tarefas (DAG)';
      case AgentOperationalState.EXECUTING:
        return taskId ? `Executando tarefa #${taskId.slice(0, 6)}` : 'Executando tarefa';
      case AgentOperationalState.CREATING:
        return 'Criando peça criativa / roteiro';
      case AgentOperationalState.REVIEWING:
        return 'Auditando qualidade e Brand Intelligence';
      case AgentOperationalState.AWAITING_APPROVAL:
        return 'Aguardando aprovação do cliente';
      case AgentOperationalState.COMPLETED:
        return 'Entrega concluída';
      case AgentOperationalState.ERROR:
        return 'Erro operacional — requer atenção';
      default:
        return 'Disponível na estação';
    }
  }

  resolveSectorAt(col        , row        )                 {
    for (const z of this.layout.zones) {
      if (
        col >= z.colStart &&
        col < z.colStart + z.width &&
        row >= z.rowStart &&
        row < z.rowStart + z.height
      ) {
        return z.sectorId;
      }
    }
    return OfficeSectorId.RECEPTION;
  }

  updateLayout(nextLayout                    )       {
    this.layout = nextLayout;
    this.blockedTiles = getBlockedTileSet(this.layout.furniture);
    this.workstations = pairWorkstations(this.layout);
  }
}

// ============================================================================
// 7. FALCON BUILD MODE / OFFICE BUILDER (Adaptado de editorActions.ts)
// ============================================================================

/**
 * Controlador de Construção Livre e Personalização do Escritório (Seção 14).
 * Suporta posicionamento de móveis, "surface riders" (itens sobre mesas se movem junto com a mesa,
 * herdado de Pixel Agents `editorActions.ts`), rotação, pintura de pisos, personalização de marca
 * e pilhas completas de Undo/Redo.
 */
export class OfficeBuilderController {
          currentLayout                    ;
                   undoStack           = [];
                   redoStack           = [];

  constructor(initialLayout                    ) {
    this.currentLayout = structuredClone(initialLayout);
  }

  getLayout()                     {
    return this.currentLayout;
  }

  canUndo()          {
    return this.undoStack.length > 0;
  }

  canRedo()          {
    return this.redoStack.length > 0;
  }

          pushUndoSnapshot()       {
    this.undoStack.push(JSON.stringify(this.currentLayout));
    if (this.undoStack.length > 50) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  undo()                     {
    const prev = this.undoStack.pop();
    if (!prev) return this.currentLayout;
    this.redoStack.push(JSON.stringify(this.currentLayout));
    this.currentLayout = JSON.parse(prev)                      ;
    return this.currentLayout;
  }

  redo()                     {
    const next = this.redoStack.pop();
    if (!next) return this.currentLayout;
    this.undoStack.push(JSON.stringify(this.currentLayout));
    this.currentLayout = JSON.parse(next)                      ;
    return this.currentLayout;
  }

  canPlaceFurniture(
    type        ,
    col        ,
    row        ,
    excludeUids              ,
  )          {
    const entry = getCatalogItem(type);
    if (!entry) return false;

    if (
      col < 1 ||
      row < 1 ||
      col + entry.footprintW > this.currentLayout.cols - 1 ||
      row + entry.footprintH > this.currentLayout.rows - 1
    ) {
      return false;
    }

    // Verifica paredes/void
    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        const t =
          this.currentLayout.tiles[
            (row + dr) * this.currentLayout.cols + (col + dc)
          ];
        if (t === TileType.WALL || t === TileType.VOID) return false;
      }
    }

    // Se o item for de superfície (ex: monitor PC), pode ser colocado sobre uma mesa
    if (entry.canPlaceOnSurfaces) return true;

    for (const existing of this.currentLayout.furniture) {
      if (excludeUids?.has(existing.uid)) continue;
      const eEntry = getCatalogItem(existing.type);
      if (!eEntry || eEntry.canPlaceOnSurfaces) continue;

      const overlapsCols =
        col < existing.col + eEntry.footprintW &&
        col + entry.footprintW > existing.col;
      const overlapsRows =
        row < existing.row + eEntry.footprintH &&
        row + entry.footprintH > existing.row;
      if (overlapsCols && overlapsRows) {
        return false;
      }
    }

    return true;
  }

  placeFurniture(params   
                 
                 
                
                
                             
                         
                                    
   )                     {
    const entry = getCatalogItem(params.type);
    if (!entry) {
      throw new Error(`Tipo de mobília desconhecido: ${params.type}`);
    }
    if (!this.canPlaceFurniture(params.type, params.col, params.row)) {
      throw new Error(
        `Posição inválida ou ocupada em (${params.col}, ${params.row}) para '${params.type}'.`,
      );
    }

    this.pushUndoSnapshot();
    this.currentLayout.version += 1;
    this.currentLayout.furniture.push({
      uid: params.uid ?? `furn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: params.type,
      col: params.col,
      row: params.row,
      orientation: entry.orientation,
      sectorId: params.sectorId,
      customLabel: params.customLabel,
      linkedModule: params.linkedModule ?? entry.linkedModule,
    });
    return this.currentLayout;
  }

  /**
   * Move um móvel e automaticamente carrega seus "surface riders" (monitores/itens apoiados na mesa),
   * adaptado diretamente de `collectSurfaceRiders` do Pixel Agents (`editorActions.ts`).
   */
  moveFurniture(uid        , newCol        , newRow        )                     {
    const item = this.currentLayout.furniture.find((f) => f.uid === uid);
    if (!item) {
      throw new Error(`Mobília '${uid}' não encontrada.`);
    }
    const entry = getCatalogItem(item.type) ;
    const dc = newCol - item.col;
    const dr = newRow - item.row;
    if (dc === 0 && dr === 0) return this.currentLayout;

    // Coleta itens de superfície apoiados sobre esta mesa
    const riders = entry.isDesk
      ? this.currentLayout.furniture.filter((other) => {
          if (other.uid === uid) return false;
          const oEntry = getCatalogItem(other.type);
          if (!oEntry?.canPlaceOnSurfaces) return false;
          return (
            other.col >= item.col &&
            other.col < item.col + entry.footprintW &&
            other.row >= item.row &&
            other.row < item.row + entry.footprintH
          );
        })
      : [];

    const excludeSet = new Set        ([uid, ...riders.map((r) => r.uid)]);
    if (!this.canPlaceFurniture(item.type, newCol, newRow, excludeSet)) {
      throw new Error(
        `Não é possível mover '${uid}' para (${newCol}, ${newRow}): espaço ocupado ou fora dos limites.`,
      );
    }

    this.pushUndoSnapshot();
    this.currentLayout.version += 1;
    item.col = newCol;
    item.row = newRow;
    for (const rider of riders) {
      rider.col += dc;
      rider.row += dr;
    }

    return this.currentLayout;
  }

  rotateFurniture(uid        )                     {
    const item = this.currentLayout.furniture.find((f) => f.uid === uid);
    if (!item) {
      throw new Error(`Mobília '${uid}' não encontrada.`);
    }
    const entry = getCatalogItem(item.type);
    if (!entry?.rotatedType) {
      return this.currentLayout;
    }

    const rotatedEntry = getCatalogItem(entry.rotatedType) ;
    const excludeSet = new Set([uid]);
    if (!this.canPlaceFurniture(rotatedEntry.type, item.col, item.row, excludeSet)) {
      throw new Error(`Sem espaço livre para rotacionar '${uid}'.`);
    }

    this.pushUndoSnapshot();
    this.currentLayout.version += 1;
    item.type = rotatedEntry.type;
    item.orientation = rotatedEntry.orientation;
    return this.currentLayout;
  }

  removeFurniture(uid        )                     {
    const idx = this.currentLayout.furniture.findIndex((f) => f.uid === uid);
    if (idx === -1) return this.currentLayout;

    this.pushUndoSnapshot();
    this.currentLayout.version += 1;
    this.currentLayout.furniture.splice(idx, 1);
    return this.currentLayout;
  }

  updateBranding(brandingPatch                              )                     {
    this.pushUndoSnapshot();
    this.currentLayout.version += 1;
    this.currentLayout.branding = {
      ...this.currentLayout.branding,
      ...brandingPatch,
    };
    return this.currentLayout;
  }

  assignAgentToSeat(
    agentSlug                   ,
    seatUid        ,
  )                     {
    const seatExists = this.currentLayout.furniture.some(
      (f) => f.uid === seatUid && getCatalogItem(f.type)?.category === 'chairs',
    );
    if (!seatExists) {
      throw new Error(`Assento '${seatUid}' inválido ou inexistente.`);
    }
    this.pushUndoSnapshot();
    this.currentLayout.version += 1;
    this.currentLayout.seatAssignments[agentSlug] = seatUid;
    return this.currentLayout;
  }
}

export { OFFICIAL_OFFICE_SECTORS };
