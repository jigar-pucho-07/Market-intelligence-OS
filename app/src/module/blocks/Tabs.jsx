// Tabs — segmented tabs; each tab has `where` (filters this page's rows) and/or its own `blocks`.
import { useState } from 'react';
import { Segmented } from 'antd';
import { where } from '../formula';
import { useT } from '../../i18n';

export default function Tabs({ block, rows, renderBlocks, user }) {
  const t9 = useT();
  const [tab, setTab] = useState(block.tabs[0].label);
  const t = block.tabs.find((x) => x.label === tab) ?? block.tabs[0];
  const tabRows = t.where ? where(rows, t.where, user) : rows;
  return (
    <div className="space-y-4" data-os-tabs>
      <div className="max-w-full overflow-x-auto custom-scrollbar -mx-1 px-1" data-os-tabstrip><Segmented options={block.tabs.map((x) => ({ value: x.label, label: t9(x.label) }))} value={tab} onChange={setTab} /></div>
      {renderBlocks(t.blocks ?? block.blocks ?? [], tabRows)}
    </div>
  );
}
