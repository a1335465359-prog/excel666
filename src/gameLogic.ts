export type AttackForm = 'wordart' | 'sparkline' | 'comment' | 'array';

export type SpecificUpgrade = 
  | 'wordart_size' | 'wordart_weight' | 'wordart_spread' | 'wordart_title' | 'wordart_ult'
  | 'sparkline_width' | 'sparkline_focus' | 'sparkline_bounce' | 'sparkline_rapid' | 'sparkline_ult'
  | 'comment_size' | 'comment_chain' | 'comment_residue' | 'comment_fast' | 'comment_ult'
  | 'array_count' | 'array_split' | 'array_track' | 'array_fast' | 'array_ult'
  | 'wordart_wide' | 'wordart_momentum' | 'wordart_shield' | 'wordart_stun' | 'wordart_quad' | 'wordart_pile_driver' | 'wordart_column_freeze' | 'wordart_afterimage'
  | 'array_overload' | 'array_rapid' | 'array_bounce' | 'array_pierce' | 'array_big' | 'array_spreadsheet' | 'array_cascade'
  | 'sparkline_freeze' | 'sparkline_cannon' | 'sparkline_reflect' | 'sparkline_overclock' | 'sparkline_burn_stack' | 'sparkline_overload' | 'sparkline_resonance' | 'sparkline_execute'
  | 'comment_triple' | 'comment_knockback' | 'comment_split' | 'comment_black' | 'comment_super' | 'comment_gravity_well' | 'comment_saturation';

export type GeneralUpgrade = 'bold' | 'underline' | 'highlight' | 'rand' | 'vlookup' | 'sum' | 'italic' | 'strikethrough' | 'ctrl_c' | 'ctrl_z' | 'format_painter' | 'conditional_format' | 'data_validation' | 'auto_fill';

export type Upgrade = SpecificUpgrade | GeneralUpgrade;

export const ATTACK_FORM_NAMES: Record<AttackForm, string> = {
  wordart: '艺术字 (WordArt)',
  sparkline: '迷你图 (Sparkline)',
  comment: '批注/报错框 (Comment)',
  array: '数组/自动填充 (Array)'
};

export const ATTACK_FORM_DESCS: Record<AttackForm, string> = {
  wordart: '发射巨大的文字推图机，缓慢推进并强制推走敌人，推到墙边直接秒杀',
  sparkline: '发射高频穿透地形的无限距离激光，无击退但可减速',
  comment: '投掷会爆炸的批注框，造成范围击退并留下持续伤害区域',
  array: '发射常规文字子弹，属性均衡，适合穿透和分裂'
};

export const UPGRADE_NAMES: Record<Upgrade, string> = {
  wordart_size: '字号 (Size)',
  wordart_weight: '字重 (Weight)',
  wordart_spread: '段落扩散 (Spread)',
  wordart_title: '标题编排 (Title)',
  wordart_ult: 'WordArt (终极)',
  sparkline_width: '线宽 (Width)',
  sparkline_focus: '聚焦 (Focus)',
  sparkline_bounce: '折线 (Bounce)',
  sparkline_rapid: '连续扫射 (Rapid)',
  sparkline_ult: 'SPARKLINE (终极)',
  comment_size: '大气泡 (Large Bubble)',
  comment_chain: '连环批注 (Chain)',
  comment_residue: '高亮残留 (Residue)',
  comment_fast: '快速批注 (Fast)',
  comment_ult: '#VALUE! (终极)',
  array_count: '扩列 (Expand)',
  array_split: '自动填充 (AutoFill)',
  array_track: '智能填充 (SmartFill)',
  array_fast: '高速填充 (FastFill)',
  array_ult: 'RANDARRAY (终极)',
  wordart_wide: '啊啊啊啊啊',
  wordart_momentum: '动量',
  wordart_shield: '文字护盾',
  wordart_stun: '震慑排版',
  wordart_quad: '四面大字',
  wordart_pile_driver: '打桩机',
  wordart_column_freeze: '列冻结',
  wordart_afterimage: '残影',
  array_overload: '过载',
  array_rapid: '高速填充',
  array_bounce: '墙体反弹',
  array_pierce: '无限穿透',
  array_big: '大号单元格',
  array_spreadsheet: '电子表格',
  array_cascade: '级联引用',
  sparkline_freeze: '冻结射线',
  sparkline_cannon: '激光炮',
  sparkline_reflect: '反射',
  sparkline_overclock: '超频',
  sparkline_burn_stack: '灼烧叠加',
  sparkline_overload: '过载',
  sparkline_resonance: '共鸣',
  sparkline_execute: '立即执行',
  comment_triple: '三连投',
  comment_knockback: '强力击飞',
  comment_split: '分裂炸弹',
  comment_black: '炸黑了',
  comment_super: '超级炸弹',
  comment_gravity_well: '引力井',
  comment_saturation: '饱和打击',
  bold: '加粗 (Bold)',
  italic: '斜体 (Italic)',
  underline: '下划线 (Underline)',
  strikethrough: '删除线 (Strikethrough)',
  highlight: '高亮 (Highlight)',
  rand: '=RAND() 随机数',
  vlookup: '=VLOOKUP() 查找',
  sum: '=SUM() 求和',
  ctrl_c: 'Ctrl+C 复制',
  ctrl_z: 'Ctrl+Z 撤销',
  format_painter: '格式刷 (Format Painter)',
  conditional_format: '条件格式 (Conditional Format)',
  data_validation: '数据验证 (Data Validation)',
  auto_fill: '自动填充 (Auto Fill)'
};

export const UPGRADE_DESCS: Record<Upgrade, string> = {
  wordart_size: '大标题宽度 +50%，伤害 +25%',
  wordart_weight: '大标题推进速度加快，推力更强',
  wordart_spread: '大标题命中敌人时，有概率向两侧发射小号文字',
  wordart_title: '每第3发变成超宽大标题，伤害2.5倍，无限穿透',
  wordart_ult: '每20秒全屏发射巨型大标题清场，伤害150，对精英1.5倍伤害',
  sparkline_width: '激光加粗，伤害 +20%',
  sparkline_focus: '激光附带强力减速效果',
  sparkline_bounce: '激光命中第一个敌人时会折射出一条新的激光',
  sparkline_rapid: '激光发射频率大幅提升',
  sparkline_ult: '每次发射3道激光，主激光极宽',
  comment_size: '爆炸半径 +30%，伤害 +20%',
  comment_chain: '敌人被爆炸击杀时，有50%概率触发二次爆炸',
  comment_residue: '爆炸后留下的持续伤害区域范围变大，伤害提升',
  comment_fast: '投掷频率加快，飞行速度提升',
  comment_ult: '每第4次爆炸变成大崩溃爆炸，范围极大',
  array_count: '子弹数 +2，扇形角度 +6°',
  array_split: '每发子弹在命中或飞行结束时分裂成3个小碎片',
  array_track: '获得轻度追踪，追踪半径160',
  array_fast: '冷却 -18%，飞行速度 +15%',
  array_ult: '每3秒向四周发射一圈子弹(16发)',
  wordart_wide: '【啊啊啊啊啊】推出去的文字横向变宽',
  wordart_momentum: '【动量】大字推着敌人移动时，每推行100px，该次攻击伤害+15%（上限+60%）',
  wordart_shield: '【文字护盾】大字可抵挡敌方子弹，射速-20%，移速额外-10%',
  wordart_stun: '【震慑排版】未击杀目标时50%概率眩晕1秒',
  wordart_quad: '【四面大字】每20秒向四个方向各发射一个大字',
  wordart_pile_driver: '【打桩机】大字推到墙边时造成额外巨量伤害',
  wordart_column_freeze: '【列冻结】大字推过的区域会暂时减速敌人',
  wordart_afterimage: '【残影】大字飞过的路径留下持续1.2秒的易伤区域，区域内受到所有伤害+35%',
  array_overload: '【过载】同一帧内命中同一个敌人的子弹≥3发时，触发小爆炸',
  array_rapid: '【高速填充】射速 x1.5',
  array_bounce: '【墙体反弹】子弹碰到墙壁可反弹1次',
  array_pierce: '【无限穿透】子弹获得无限穿透',
  array_big: '【大号单元格】子弹体积 x2',
  array_spreadsheet: '【电子表格】子弹命中后有概率生成一个电子表格区域，持续伤害',
  array_cascade: '【级联引用】子弹击杀敌人时，在击杀位置沿相同方向再射出一颗相同属性的子弹',
  sparkline_freeze: '【冻结射线】命中时5%概率冰冻敌人',
  sparkline_cannon: '【激光炮】每30秒发射极粗激光秒杀非BOSS，随后1.5秒无法发射普通激光',
  sparkline_reflect: '【反射】激光击中墙壁后反射1次',
  sparkline_overclock: '【超频】激光射速 x2',
  sparkline_burn_stack: '【灼烧叠加】激光命中会叠加灼烧层数，造成持续伤害',
  sparkline_overload: '【过载】激光伤害大幅提升，但会消耗自身少量生命值',
  sparkline_resonance: '【共鸣】激光命中已处于减速状态的敌人时，伤害×1.8',
  sparkline_execute: '【立即执行】激光对HP低于25%的非Boss敌人造成3倍伤害',
  comment_triple: '【三连投】一次扔出3颗炸弹，攻速降低20%',
  comment_knockback: '【强力击飞】炸弹击飞距离增加100%',
  comment_split: '【分裂炸弹】碰到敌人后分裂成3颗炸弹',
  comment_black: '【炸黑了】爆炸后把地面炸黑(视觉效果)',
  comment_super: '【超级炸弹】每30秒扔出巨大炸弹，秒杀普通/精英怪，并附加减速和灼烧',
  comment_gravity_well: '【引力井】爆炸中心会吸引周围的敌人',
  comment_saturation: '【饱和打击】1秒内在同一200px范围内爆炸2颗及以上，每颗额外+40%伤害',
  bold: '直接伤害 +30%，击退 +6px',
  italic: '飞行速度 +15%，射速 +10%',
  underline: '攻击留下1.4秒拖尾/残痕，伤害7/s',
  strikethrough: '穿透 +1，直接秒杀生命值低于20%的非Boss敌人 (斩杀)',
  highlight: '命中后生成50px高亮区，持续2.5秒，区域内敌人受到伤害增加50% (易伤)',
  rand: '15%概率暴击，暴击倍率2.4x',
  vlookup: '对精英/Boss伤害+15%，投射物获得轻度追踪，激光对目标有轻微吸附',
  sum: '每10击杀+3%伤害，上限+24%(8层)，每个stage结束清零',
  ctrl_c: '每次攻击有20%概率额外发射一团乱码(多重射击)',
  ctrl_z: '受到致命伤时免死，恢复30%血量并无敌2秒 (每局限1次)',
  format_painter: '击中敌人时，有20%概率在敌人脚下生成一个格式刷区域，减速并造成持续伤害',
  conditional_format: '对HP低于30%的敌人，所有伤害来源+60%',
  data_validation: '每个敌人首次被命中时获得"待验证"标记（持续4秒）。标记存在时，下一次命中该敌人+100%伤害并消耗标记。',
  auto_fill: '击杀敌人时，30%概率在击杀位置免费发射一次当前武器攻击'
};

export interface Player {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  angle: number;
  isShooting: boolean;
  keys: { w: boolean; a: boolean; s: boolean; d: boolean };
  attackForm: AttackForm | null;
  specificUpgrades: SpecificUpgrade[];
  generalUpgrades: GeneralUpgrade[];
  lastShot: number;
  lastLaser: number;
  lastWordart?: number;
  lastWordartUlt?: number;
  lastWordartQuad?: number;
  lastArrayUlt?: number;
  lastCommentUlt?: number;
  lastCommentSuper?: number;
  sparklineVacuumUntil?: number;
  lastSparklineCannon?: number;
  kills: number;
  sumKills: number;
  deaths: number;
  readyForNextStage: boolean;
  invincibleUntil: number;
  sumStacks?: number;
  knockbackMult?: number;
  sizeMult?: number;
  eliteDamageMult?: number;
  wordartCounter: number;
  commentCounter: number;
  ctrlZUsed?: boolean;
  gridToolCharges?: number;
  upgradesToChoose?: number;
  slowUntil?: number;
  slowFactor?: number;
}

export interface AoeWarning {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'rect' | 'row' | 'col';
  life: number;
  maxLife: number;
}

export type EnemyType = 'Minion' | 'Elite' | 'MiniBoss' | 'EliteBoss' | 'Value' | 'FormatBrush' | 'FreezeCell' | 'ProtectedView' | 'MergedCell' | 'SplitCell' | 'REF' | 'VLOOKUP' | 'MACRO' | 'MINION';

export interface Enemy {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  type: EnemyType;
  vx: number;
  vy: number;
  knockbackX: number;
  knockbackY: number;
  text: string;
  width: number;
  height: number;
  speed: number;
  weight: number;
  state?: 'idle' | 'warning' | 'dashing' | 'aiming' | 'firing' | 'stunned';
  stateTimer?: number;
  dashTargetX?: number;
  dashTargetY?: number;
  facingAngle?: number;
  lastAttack?: number;
  isBuffed?: boolean;
  crushCooldown?: number;
  crushCount?: number;
  pushedDistance?: number;
  pushDamageCount?: number;
  lastPushedBy?: number; // Bullet ID
  spawnedBy?: number;
  validationMark?: number;
}

export interface EnemyBullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  life: number;
  size: number;
  type: 'value' | 'row' | 'col' | 'ref' | 'vlookup';
}

export interface Puddle {
  id: number;
  x: number;
  y: number;
  radius: number;
  type: 'formatPaint' | 'freeze' | 'highlight' | 'explosion' | 'blacken' | 'burn_slow' | 'vulnerable' | 'afterimage' | 'slow_zone';
  life: number;
  maxLife: number;
  damage?: number;
  owner?: string;
  damageMult?: number;
}

export interface Bullet {
  id: number;
  owner: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  life: number;
  maxLife: number;
  size: number;
  pierce: number;
  type: string;
  isCrit?: boolean;
  knockback?: number;
  knockbackMult?: number;
  isTitle?: boolean;
  eliteDamageMult?: number;
  explosionRadius?: number;
  isUlt?: boolean;
  splitsLeft?: number;
  trackRadius?: number;
  leavesResidue?: boolean;
  isHighlight?: boolean;
  enemyBouncesLeft?: number;
  wallBouncesLeft?: number;
  isItalic?: boolean;
  isStrikethrough?: boolean;
  isBlacken?: boolean;
  chainDepth?: number;
  isBulldozer?: boolean;
  hitTargets?: Set<number>;
  angle?: number;
  width?: number;
  height?: number;
  isShield?: boolean;
  stunChance?: number;
  isSuper?: boolean;
  isCascade?: boolean;
  isAutoFill?: boolean;
  momentumBonus?: number;
  distancePushed?: number;
  leavesAfterimage?: boolean;
}

export interface Laser {
  id: number;
  owner: string;
  x: number;
  y: number;
  angle: number;
  damage: number;
  width: number;
  range: number;
  life: number;
  maxLife: number;
  type: string;
  isCrit?: boolean;
  isStrikethrough?: boolean;
  eliteDamageMult?: number;
  enemyBouncesLeft?: number;
  wallBouncesLeft?: number;
  hasHit?: boolean;
  isHighlight?: boolean;
  isSlow?: boolean;
  stunChance?: number;
  leavesResidue?: boolean;
  hitTargets?: Set<number>;
  isCannon?: boolean;
}

export interface MapDef {
  width: number;
  height: number;
  obstacles: { x: number, y: number, w: number, h: number }[];
  bushes: { x: number, y: number, w: number, h: number }[];
  spawners: { x: number, y: number }[];
  playerSpawn: { x: number, y: number };
}

export const MAPS: MapDef[] = [
  // Map 1: 空旷训练场
  {
    width: 3000, height: 3000,
    obstacles: [
      { x: 200, y: 200, w: 200, h: 200 },
      { x: 2600, y: 200, w: 200, h: 200 },
      { x: 200, y: 2600, w: 200, h: 200 },
      { x: 2600, y: 2600, w: 200, h: 200 },
    ],
    bushes: [],
    spawners: [
      { x: 150, y: 150 }, { x: 2850, y: 150 }, { x: 150, y: 2850 }, { x: 2850, y: 2850 }
    ],
    playerSpawn: { x: 1500, y: 1500 }
  },
  // Map 2: 十字走廊
  {
    width: 3000, height: 3000,
    obstacles: [
      { x: 150, y: 150, w: 1050, h: 1050 },
      { x: 1800, y: 150, w: 1050, h: 1050 },
      { x: 150, y: 1800, w: 1050, h: 1050 },
      { x: 1800, y: 1800, w: 1050, h: 1050 },
    ],
    bushes: [],
    spawners: [
      { x: 1500, y: 150 }, { x: 1500, y: 2850 }, { x: 150, y: 1500 }, { x: 2850, y: 1500 }
    ],
    playerSpawn: { x: 1500, y: 1500 }
  },
  // Map 3: 环形岛
  {
    width: 3000, height: 3000,
    obstacles: [
      { x: 800, y: 800, w: 500, h: 500 },
      { x: 1700, y: 800, w: 500, h: 500 },
      { x: 800, y: 1700, w: 500, h: 500 },
      { x: 1700, y: 1700, w: 500, h: 500 },
    ],
    bushes: [],
    spawners: [
      { x: 150, y: 150 }, { x: 2850, y: 150 }, { x: 150, y: 2850 }, { x: 2850, y: 2850 },
      { x: 1500, y: 150 }, { x: 1500, y: 2850 }, { x: 150, y: 1500 }, { x: 2850, y: 1500 }
    ],
    playerSpawn: { x: 1500, y: 1500 }
  },
  // Map 4: 蜂窝
  {
    width: 3000, height: 3000,
    obstacles: [
      { x: 825, y: 825, w: 150, h: 150 },
      { x: 1425, y: 825, w: 150, h: 150 },
      { x: 2025, y: 825, w: 150, h: 150 },
      { x: 825, y: 1425, w: 150, h: 150 },
      { x: 2025, y: 1425, w: 150, h: 150 },
      { x: 825, y: 2025, w: 150, h: 150 },
      { x: 1425, y: 2025, w: 150, h: 150 },
      { x: 2025, y: 2025, w: 150, h: 150 },
    ],
    bushes: [],
    spawners: [
      { x: 150, y: 1500 }, { x: 2850, y: 1500 }, { x: 1000, y: 150 }, { x: 2000, y: 150 }, { x: 1000, y: 2850 }, { x: 2000, y: 2850 }
    ],
    playerSpawn: { x: 1500, y: 1500 }
  },
  // Map 5: 迷宫一
  {
    width: 3000, height: 3000,
    obstacles: [
      { x: 800, y: 800, w: 1400, h: 100 },
      { x: 800, y: 800, w: 100, h: 1400 },
      { x: 2100, y: 1500, w: 100, h: 700 },
      { x: 1500, y: 2100, w: 700, h: 100 },
    ],
    bushes: [],
    spawners: [
      { x: 150, y: 150 }, { x: 2850, y: 150 }, { x: 150, y: 2850 }, { x: 2850, y: 2850 },
      { x: 1500, y: 150 }, { x: 1500, y: 2850 }
    ],
    playerSpawn: { x: 1500, y: 1500 }
  },
  // Map 6: 对称双室
  {
    width: 3000, height: 3000,
    obstacles: [
      { x: 1450, y: 150, w: 100, h: 900 },
      { x: 1450, y: 1350, w: 100, h: 300 },
      { x: 1450, y: 1950, w: 100, h: 900 },
    ],
    bushes: [],
    spawners: [
      { x: 150, y: 500 }, { x: 150, y: 1500 }, { x: 150, y: 2500 },
      { x: 2850, y: 500 }, { x: 2850, y: 1500 }, { x: 2850, y: 2500 }
    ],
    playerSpawn: { x: 750, y: 1500 }
  },
  // Map 7: 阶梯
  {
    width: 3000, height: 3000,
    obstacles: [
      { x: 600, y: 600, w: 200, h: 80 },
      { x: 1000, y: 1000, w: 200, h: 80 },
      { x: 1400, y: 1400, w: 200, h: 80 },
      { x: 1800, y: 1800, w: 200, h: 80 },
      { x: 2200, y: 2200, w: 200, h: 80 },
    ],
    bushes: [],
    spawners: [
      { x: 150, y: 150 }, { x: 2850, y: 150 }, { x: 150, y: 2850 }, { x: 2850, y: 2850 }
    ],
    playerSpawn: { x: 1200, y: 1600 }
  },
  // Map 8: 竞技场
  {
    width: 3000, height: 3000,
    obstacles: [
      { x: 500, y: 500, w: 800, h: 100 },
      { x: 1700, y: 500, w: 800, h: 100 },
      { x: 500, y: 2400, w: 800, h: 100 },
      { x: 1700, y: 2400, w: 800, h: 100 },
      { x: 500, y: 600, w: 100, h: 700 },
      { x: 500, y: 1700, w: 100, h: 700 },
      { x: 2400, y: 600, w: 100, h: 700 },
      { x: 2400, y: 1700, w: 100, h: 700 },
    ],
    bushes: [],
    spawners: [
      { x: 1500, y: 200 }, { x: 1500, y: 2800 }, { x: 200, y: 1500 }, { x: 2800, y: 1500 }
    ],
    playerSpawn: { x: 1500, y: 1500 }
  },
  // Map 9: 星型
  {
    width: 3000, height: 3000,
    obstacles: [
      { x: 1300, y: 500, w: 400, h: 400 },
      { x: 1300, y: 2100, w: 400, h: 400 },
      { x: 500, y: 1300, w: 400, h: 400 },
      { x: 2100, y: 1300, w: 400, h: 400 },
    ],
    bushes: [],
    spawners: [
      { x: 150, y: 150 }, { x: 2850, y: 150 }, { x: 150, y: 2850 }, { x: 2850, y: 2850 }
    ],
    playerSpawn: { x: 1500, y: 1500 }
  },
  // Map 10: 压缩通道
  {
    width: 3000, height: 3000,
    obstacles: [
      { x: 150, y: 800, w: 1700, h: 100 },
      { x: 2150, y: 800, w: 700, h: 100 },
      { x: 150, y: 1600, w: 500, h: 100 },
      { x: 950, y: 1600, w: 1900, h: 100 },
      { x: 150, y: 2400, w: 1700, h: 100 },
      { x: 2150, y: 2400, w: 700, h: 100 },
    ],
    bushes: [],
    spawners: [
      { x: 500, y: 150 }, { x: 1500, y: 150 }, { x: 2500, y: 150 },
      { x: 500, y: 2850 }, { x: 1500, y: 2850 }, { x: 2500, y: 2850 }
    ],
    playerSpawn: { x: 1500, y: 1200 }
  },
  // Map 11: 孤岛群
  {
    width: 3000, height: 3000,
    obstacles: [
      { x: 800, y: 800, w: 100, h: 100 },
      { x: 2200, y: 800, w: 100, h: 100 },
      { x: 800, y: 2200, w: 100, h: 100 },
      { x: 2200, y: 2200, w: 100, h: 100 },
      { x: 1500, y: 800, w: 100, h: 100 },
      { x: 800, y: 1500, w: 100, h: 100 },
      { x: 2200, y: 1500, w: 100, h: 100 },
    ],
    bushes: [],
    spawners: [
      { x: 150, y: 150 }, { x: 2850, y: 150 }, { x: 150, y: 2850 }, { x: 2850, y: 2850 }
    ],
    playerSpawn: { x: 1500, y: 1500 }
  },
  // Map 12: 回字形
  {
    width: 3000, height: 3000,
    obstacles: [
      { x: 500, y: 500, w: 2000, h: 100 },
      { x: 500, y: 2400, w: 2000, h: 100 },
      { x: 500, y: 600, w: 100, h: 1800 },
      { x: 2400, y: 600, w: 100, h: 1800 },
      { x: 1000, y: 1000, w: 400, h: 100 },
      { x: 1600, y: 1000, w: 400, h: 100 },
      { x: 1000, y: 1900, w: 400, h: 100 },
      { x: 1600, y: 1900, w: 400, h: 100 },
      { x: 1000, y: 1100, w: 100, h: 300 },
      { x: 1000, y: 1600, w: 100, h: 300 },
      { x: 1900, y: 1100, w: 100, h: 300 },
      { x: 1900, y: 1600, w: 100, h: 300 },
    ],
    bushes: [],
    spawners: [
      { x: 750, y: 750 }, { x: 2250, y: 750 }, { x: 750, y: 2250 }, { x: 2250, y: 2250 }
    ],
    playerSpawn: { x: 1500, y: 1500 }
  },
  // Map 13: 工厂
  {
    width: 3000, height: 3000,
    obstacles: [
      { x: 660, y: 660, w: 80, h: 80 }, { x: 1060, y: 660, w: 80, h: 80 }, { x: 1460, y: 660, w: 80, h: 80 }, { x: 1860, y: 660, w: 80, h: 80 }, { x: 2260, y: 660, w: 80, h: 80 },
      { x: 660, y: 1060, w: 80, h: 80 }, { x: 1060, y: 1060, w: 80, h: 80 }, { x: 1460, y: 1060, w: 80, h: 80 }, { x: 1860, y: 1060, w: 80, h: 80 }, { x: 2260, y: 1060, w: 80, h: 80 },
      { x: 660, y: 1460, w: 80, h: 80 }, { x: 1060, y: 1460, w: 80, h: 80 }, { x: 1860, y: 1460, w: 80, h: 80 }, { x: 2260, y: 1460, w: 80, h: 80 },
      { x: 660, y: 1860, w: 80, h: 80 }, { x: 1060, y: 1860, w: 80, h: 80 }, { x: 1460, y: 1860, w: 80, h: 80 }, { x: 1860, y: 1860, w: 80, h: 80 }, { x: 2260, y: 1860, w: 80, h: 80 },
      { x: 660, y: 2260, w: 80, h: 80 }, { x: 1060, y: 2260, w: 80, h: 80 }, { x: 1460, y: 2260, w: 80, h: 80 }, { x: 1860, y: 2260, w: 80, h: 80 }, { x: 2260, y: 2260, w: 80, h: 80 },
    ],
    bushes: [],
    spawners: [
      { x: 150, y: 150 }, { x: 2850, y: 150 }, { x: 150, y: 2850 }, { x: 2850, y: 2850 }
    ],
    playerSpawn: { x: 1500, y: 1500 }
  },
  // Map 14: 混沌
  {
    width: 3000, height: 3000,
    obstacles: [
      { x: 400, y: 400, w: 200, h: 150 }, { x: 800, y: 500, w: 100, h: 300 }, { x: 1800, y: 400, w: 300, h: 100 }, { x: 2400, y: 600, w: 150, h: 200 },
      { x: 500, y: 1200, w: 250, h: 100 }, { x: 1000, y: 1000, w: 150, h: 150 }, { x: 2000, y: 1100, w: 100, h: 250 }, { x: 2500, y: 1300, w: 200, h: 150 },
      { x: 400, y: 1800, w: 100, h: 200 }, { x: 900, y: 1900, w: 300, h: 100 }, { x: 1800, y: 1800, w: 150, h: 150 }, { x: 2300, y: 2000, w: 200, h: 100 },
      { x: 600, y: 2400, w: 200, h: 200 }, { x: 1200, y: 2500, w: 150, h: 100 }, { x: 1900, y: 2400, w: 250, h: 150 }
    ],
    bushes: [],
    spawners: [
      { x: 150, y: 150 }, { x: 1500, y: 150 }, { x: 2850, y: 150 },
      { x: 150, y: 1500 }, { x: 2850, y: 1500 },
      { x: 150, y: 2850 }, { x: 1500, y: 2850 }, { x: 2850, y: 2850 }
    ],
    playerSpawn: { x: 1500, y: 1500 }
  },
  // Map 15: 最终竞技场
  {
    width: 3000, height: 3000,
    obstacles: [],
    bushes: [
      { x: 200, y: 200, w: 50, h: 50 },
      { x: 2750, y: 200, w: 50, h: 50 },
      { x: 200, y: 2750, w: 50, h: 50 },
      { x: 2750, y: 2750, w: 50, h: 50 },
    ],
    spawners: [
      { x: 150, y: 150 }, { x: 1500, y: 150 }, { x: 2850, y: 150 },
      { x: 150, y: 1500 }, { x: 2850, y: 1500 },
      { x: 150, y: 2850 }, { x: 1500, y: 2850 }, { x: 2850, y: 2850 }
    ],
    playerSpawn: { x: 1500, y: 1500 }
  }
];

export interface Room {
  id: string;
  players: Record<string, Player>;
  enemies: Enemy[];
  bullets: Bullet[];
  enemyBullets: EnemyBullet[];
  puddles: Puddle[];
  aoeWarnings: AoeWarning[];
  lasers: Laser[];
  items: any[];
  stage: number;
  stageTimer: number;
  isSelectingSkill: boolean;
  isSelectingForm: boolean;
  skillChoices: Upgrade[];
  formChoices: AttackForm[];
  bulletTime: number;
  enemyIdCounter: number;
  bulletIdCounter: number;
  enemyBulletIdCounter: number;
  puddleIdCounter: number;
  aoeIdCounter: number;
  itemIdCounter: number;
  margin: number;
  dynamicObstacles: {x: number, y: number, w: number, h: number}[];
  activeEvent: 'NONE' | 'DIV0' | 'OOM';
  eventTimer: number;
  skillPickCount: number;
  totalKills: number;
  startTime: number;
  endTime?: number;
  gameOver?: 'victory' | 'defeat';
  bossSpawned?: boolean;
  recentExplosions: {x: number, y: number, time: number}[];
}

export function createRoom(roomId: string): Room {
  return {
    id: roomId,
    players: {},
    enemies: [],
    bullets: [],
    enemyBullets: [],
    puddles: [],
    aoeWarnings: [],
    lasers: [],
    items: [],
    stage: 1,
    stageTimer: 0,
    isSelectingSkill: false,
    isSelectingForm: true,
    skillChoices: [],
    formChoices: ['wordart', 'sparkline', 'comment', 'array'],
    bulletTime: 0,
    enemyIdCounter: 0,
    bulletIdCounter: 0,
    enemyBulletIdCounter: 0,
    puddleIdCounter: 0,
    aoeIdCounter: 0,
    itemIdCounter: 0,
    margin: 0,
    dynamicObstacles: [],
    activeEvent: 'NONE',
    eventTimer: 0,
    skillPickCount: 1,
    totalKills: 0,
    startTime: Date.now(),
    recentExplosions: []
  };
}
