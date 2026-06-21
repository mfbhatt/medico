import { useState, useEffect, useRef } from 'react';
import { DOSE_OPTIONS, FREQ_OPTIONS, TIMING_OPTIONS } from '../constants';

// ─── Sig Selector (structured dosage instructions) ────────────────────────────

export function SigSelector({ form, value, onChange }: { form: string; value: string; onChange: (sig: string) => void }) {
  const doses = DOSE_OPTIONS[form.toLowerCase()] ?? ['1 unit', '2 units'];
  const [dose, setDose] = useState(doses[0]);
  const [freq, setFreq] = useState('twice daily');
  const [timing, setTiming] = useState('after food');

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!value) {
      onChangeRef.current(`Take ${doses[0]} twice daily after food`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = (d: string, f: string, t: string) =>
    onChange(`Take ${d} ${f}${t ? ' ' + t : ''}`);

  return (
    <div className="flex items-center gap-0.5 flex-1 min-w-0">
      <select
        value={dose}
        onChange={(e) => { const v = e.target.value; setDose(v); emit(v, freq, timing); }}
        className="input text-[10px] py-0 h-6 px-1 min-w-0 flex-1"
        title="Dose"
      >
        {doses.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <select
        value={freq}
        onChange={(e) => { const v = e.target.value; setFreq(v); emit(dose, v, timing); }}
        className="input text-[10px] py-0 h-6 px-1 min-w-0 flex-[1.4]"
        title="Frequency"
      >
        {FREQ_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
      <select
        value={timing}
        onChange={(e) => { const v = e.target.value; setTiming(v); emit(dose, freq, v); }}
        className="input text-[10px] py-0 h-6 px-1 min-w-0 flex-[1.2]"
        title="Timing"
      >
        {TIMING_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
    </div>
  );
}
