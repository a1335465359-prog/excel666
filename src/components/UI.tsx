import React, { useState } from 'react';
import { AttackForm, Upgrade, ATTACK_FORM_NAMES, ATTACK_FORM_DESCS, UPGRADE_NAMES, UPGRADE_DESCS } from '../gameLogic';

export const GameOver: React.FC<{ survivalSeconds: number; onRestart: () => void }> = ({ survivalSeconds, onRestart }) => (
  <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
    <div className="bg-white p-8 border border-[#c8c6c4] shadow-xl flex flex-col items-center max-w-md w-full">
      <div className="text-4xl mb-4">⚠️</div>
      <h2 className="text-2xl font-bold text-[#e81123] mb-2">#VALUE! (你死了)</h2>
      <p className="text-gray-600 mb-6 text-center">你的单元格已被清空。生存时间: {Math.floor(survivalSeconds / 60)}分{survivalSeconds % 60}秒</p>
      <button 
        className="px-6 py-2 bg-[#217346] text-white font-bold hover:bg-[#1e603b] transition-colors"
        onClick={onRestart}
      >
        重新开始
      </button>
    </div>
  </div>
);

export const FormSelection: React.FC<{
  formChoices: AttackForm[];
  onSelect: (form: AttackForm) => void;
}> = ({ formChoices, onSelect }) => {
  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 p-4">
      <div className="bg-white p-6 rounded shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <h2 className="text-2xl font-bold mb-2 text-gray-800 shrink-0">选择你的攻击形态</h2>
        <p className="text-gray-600 mb-6 shrink-0">一局内无法更换，请谨慎选择</p>
        
        <div className="grid grid-cols-1 gap-4 overflow-y-auto flex-1 pr-2">
          {formChoices.map(form => (
            <button 
              key={form}
              onClick={() => onSelect(form)}
              className="flex flex-col items-start p-4 border border-gray-300 hover:border-[#217346] hover:bg-green-50 transition-colors text-left"
            >
              <span className="font-bold text-lg text-[#217346]">{ATTACK_FORM_NAMES[form]}</span>
              <span className="text-gray-600 mt-1">{ATTACK_FORM_DESCS[form]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const UpgradeSelection: React.FC<{
  stage: number;
  upgradeChoices: Upgrade[];
  upgradesToChoose: number;
  onSelect: (upgrade: Upgrade) => void;
}> = ({ stage, upgradeChoices, upgradesToChoose, onSelect }) => {
  const [selectedPending, setSelectedPending] = useState<Upgrade[]>([]);

  const handleSelect = (upgrade: Upgrade) => {
    if (selectedPending.includes(upgrade)) return;
    setSelectedPending(prev => [...prev, upgrade]);
    onSelect(upgrade);
  };

  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 p-4">
      <div className="bg-white p-6 rounded shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <h2 className="text-2xl font-bold mb-2 text-gray-800 shrink-0">格式化完成！选择新能力</h2>
        <p className="text-gray-600 mb-6 shrink-0">准备进入第 {stage + 1} 关 (还可选择 {upgradesToChoose} 项)</p>
        
        <div className="grid grid-cols-1 gap-4 overflow-y-auto flex-1 pr-2">
          {upgradeChoices.map(upgrade => {
            const isSelected = selectedPending.includes(upgrade);
            return (
              <button 
                key={upgrade}
                onClick={() => handleSelect(upgrade)}
                disabled={isSelected}
                className={`flex flex-col items-start p-4 border transition-colors text-left ${isSelected ? 'border-gray-400 bg-gray-100 opacity-50' : 'border-gray-300 hover:border-[#217346] hover:bg-green-50'}`}
              >
                <span className={`font-bold text-lg ${isSelected ? 'text-gray-500' : 'text-[#217346]'}`}>{UPGRADE_NAMES[upgrade]}</span>
                <span className="text-gray-600 mt-1">{UPGRADE_DESCS[upgrade]}</span>
              </button>
            );
          })}
          {upgradeChoices.length === 0 && (
            <button 
              onClick={() => onSelect('bold')}
              className="p-4 border border-[#217346] bg-green-50 font-bold text-[#217346]"
            >
              能力已满，继续下一关！
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const GridToolOverlay: React.FC<{ charges: number }> = ({ charges }) => (
  <div className="absolute top-4 right-4 bg-white/90 p-3 rounded shadow-md text-xs border-l-4 border-green-500 pointer-events-none z-10 flex flex-col items-end">
    <div className="font-bold text-green-700 mb-1">网格工具 (Grid Tool)</div>
    <div className="text-gray-700 font-bold text-lg">
      可用次数: {charges}
    </div>
    {charges > 0 && (
      <div className="text-green-600 mt-1 font-bold animate-pulse">
        按 [空格键] 激活时间暂停！
      </div>
    )}
  </div>
);

export const SumSkillOverlay: React.FC<{ sumStacks: number; knockbackMult: number; sizeMult: number; eliteDamageMult: number }> = ({ sumStacks, knockbackMult, sizeMult, eliteDamageMult }) => (
  <div className="absolute top-4 left-4 bg-white/90 p-3 rounded shadow-md text-xs border-l-4 border-blue-500 pointer-events-none z-10">
    <div className="font-bold text-blue-700 mb-1">=SUM() 叠加层数: {sumStacks || 0}</div>
    <div className="text-gray-700">
      攻击力加成: +{sumStacks <= 20 ? sumStacks : 20 + Math.floor(Math.sqrt(Math.max(0, sumStacks - 20)) * 2)}
    </div>
    {sumStacks > 20 && (
      <div className="text-orange-600 mt-2 pt-2 border-t border-orange-200">
        <div className="font-bold mb-1">溢出转化生效中!</div>
        <div className="flex justify-between gap-4"><span>击退:</span> <span>+{Math.floor((knockbackMult - 1) * 100)}%</span></div>
        <div className="flex justify-between gap-4"><span>字号:</span> <span>+{Math.floor((sizeMult - 1) * 100)}%</span></div>
        <div className="flex justify-between gap-4"><span>对精英伤害:</span> <span>+{Math.floor((eliteDamageMult - 1) * 100)}%</span></div>
      </div>
    )}
  </div>
);

export const GridMenu: React.FC<{ pos: { x: number; y: number }; onAction: (action: string) => void; onCancel: () => void }> = ({ pos, onAction, onCancel }) => {
  const menuWidth = 150;
  const menuHeight = 160;
  return (
    <div 
      id="grid-menu"
      className="fixed bg-white border border-gray-300 shadow-lg py-1 flex flex-col text-sm z-10"
      style={{ 
        maxWidth: 'calc(100vw - 40px)',
        left: `clamp(10px, ${pos.x}px, calc(100vw - ${menuWidth}px - 10px))`,
        top: `clamp(10px, ${pos.y}px, calc(100vh - ${menuHeight}px - 10px))`
      }}
    >
      <button className="px-4 py-1 hover:bg-gray-100 text-left" onClick={() => onAction('area')}>删除选区 (Delete Area)</button>
      <button className="px-4 py-1 hover:bg-gray-100 text-left" onClick={() => onAction('row')}>删除行 (Delete Row)</button>
      <button className="px-4 py-1 hover:bg-gray-100 text-left" onClick={() => onAction('col')}>删除列 (Delete Column)</button>
      <div className="h-px bg-gray-200 my-1"></div>
      <button className="px-4 py-1 hover:bg-gray-100 text-left text-gray-500" onClick={onCancel}>取消</button>
    </div>
  );
};
