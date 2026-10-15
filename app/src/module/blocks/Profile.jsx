// Profile — header card for one record + tabs of sections (HR Employee Profile pattern). Used by detail pages with `kind: profile`.
import { useState } from 'react';
import { Segmented, Button } from 'antd';
import StatusBadge from '../../components/StatusBadge';
import ProfileAvatar from '../../components/ProfileAvatar';
import { CARD } from '../Charts';

export default function Profile({ row, entity, spec, actions = [], onAction, renderSections }) {
  const [tab, setTab] = useState(spec.tabs[0].label);
  const t = spec.tabs.find((x) => x.label === tab) ?? spec.tabs[0];
  return (
    <div className="space-y-5" data-os-profile>
      <div className={`${CARD} p-6 flex flex-col sm:flex-row sm:items-center gap-5`}>
        <ProfileAvatar name={row[spec.title_column]} size={64} editable={false} />
        <div className="flex-1 min-w-0">
          <h2 className="text-[19px] font-semibold text-ink truncate">{row[spec.title_column]}</h2>
          <p className="text-sm text-gray-500">{(spec.subtitle ?? []).map((c) => row[c]).filter(Boolean).join(' · ')}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap"><span className="text-[12px] text-ink-3 tabular">{row[entity.id.column]}</span>{entity.status && <StatusBadge status={row[entity.status.column]} />}</div>
        </div>
        <div className="flex gap-2 flex-wrap">{actions.map((m) => <Button key={m.id} data-os-action={m.id} onClick={() => onAction(m)}>{m.title}</Button>)}</div>
      </div>
      <div className="max-w-full overflow-x-auto custom-scrollbar" data-os-tabstrip><Segmented options={spec.tabs.map((x) => x.label)} value={tab} onChange={setTab} /></div>
      {renderSections(t.sections ?? [])}
    </div>
  );
}
