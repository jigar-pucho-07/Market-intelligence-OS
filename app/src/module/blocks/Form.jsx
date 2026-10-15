// Form — a single-screen form bound to a flow action. Used on public pages (no login) and anywhere a stepper is too much.
import { useState } from 'react';
import { Button } from 'antd';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import Fields, { missingFields, missingText, startValue, useRelativeDefaults } from '../Fields';
import { useFieldErrors, focusField } from '../fieldErrors';
import { useT } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { runAction } from '../../utils/api';
import { CARD, SECTION_TITLE } from '../Charts';

export default function Form({ block, data, entity }) {
  const t = useT(); const { user } = useAuth(); const fe = useFieldErrors();
  const init = (defer = false) => Object.fromEntries((block.fields ?? []).map((f) => [f.key, startValue(f, entity, user, { defer }) ?? '']));
  const [values, setValues] = useState(() => init(true)); useRelativeDefaults(block.fields, entity, setValues);   // today / tomorrow defaults fill after mount (server and browser clocks differ) const [busy, setBusy] = useState(false); const [done, setDone] = useState(null);
  const submit = async () => {
    const miss = missingFields(block.fields, values); if (miss.length) { focusField(miss[0].key); return toast.error(missingText(miss, t)); }
    fe.reset(); setBusy(true);
    try { const res = await runAction(block, { ...(block.context ?? {}), ...values }); setDone(res ?? {}); toast.success(block.success ?? 'Submitted'); }
    catch (e) { const { rest } = fe.apply(e, block.fields); if (rest) toast.error(rest); } finally { setBusy(false); }
  };
  const ref = done && Object.entries(done).find(([k]) => /_ID$|_No$/.test(k));
  return (
    <div className={`${CARD} p-6 sm:p-8`} data-os-form-block>
      {done ? (
        <div className="text-center py-6 space-y-2">
          <CheckCircle2 className="w-12 h-12 text-ok mx-auto" />
          <p className="font-display text-lg font-semibold text-gray-900">{block.done ?? 'Thank you — we have received it.'}</p>
          {ref && <p className="font-mono text-primary-600">{ref[1]}</p>}
          <Button className="mt-2" onClick={() => { setDone(null); setValues(init()); }}>{block.again ?? 'Submit another'}</Button>
        </div>
      ) : (
        <div className="os-form" data-os-form>
          {block.title && <h3 className={`${SECTION_TITLE} mb-1`}>{block.title}</h3>}
          {block.intro && <p className="text-sm text-gray-600 mb-5">{block.intro}</p>}
          <Fields fields={block.fields} values={values} setValues={setValues} data={data} entity={entity} columns={block.columns ?? 1} errors={fe.errors} onClearError={fe.clear} />
          <div className="flex justify-end mt-6"><Button type="primary" size="large" loading={busy} onClick={submit} data-os-action={block.id}>{t(block.submit ?? 'Submit')}</Button></div>
        </div>
      )}
    </div>
  );
}
