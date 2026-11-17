import { RANGES } from '../geometry/constants';
import { MOUNT_TYPES, PRESET_HELPER_TEXT, PROBE_PRESETS, resolveProbe, type GloveMode, type MountType, type ProbePresetId } from '../geometry/params';
import { useConfigStore } from '../state/configStore';
import { useRigStatus } from '../state/selectors';
import { formatClearance, formatLength, statusView } from './format';
import { Segmented, SelectField, Slider } from './Controls';

const MOUNT_LABELS: Record<MountType, string> = {
  tape: 'Adhesive tape',
  vesa: 'Screws or VESA',
  amps: 'RAM AMPS',
  magnets: 'Magnets',
  ivpole: 'IV pole clamp',
};
const MOUNT_OPTIONS = MOUNT_TYPES.map((m) => ({ value: m, label: MOUNT_LABELS[m] }));
const PROBE_OPTIONS = PROBE_PRESETS.map((p) => ({ value: p.id, label: p.label }));
const GLOVE_OPTIONS: { value: GloveMode; label: string }[] = [
  { value: 'tube', label: 'Rolled pairs' },
  { value: 'box', label: 'Glove box' },
];

export function Panel() {
  const params = useConfigStore((s) => s.params);
  const setParam = useConfigStore((s) => s.setParam);
  const reset = useConfigStore((s) => s.reset);
  const custom = params.probePreset === 'custom';
  const unverified = !resolveProbe(params).verified;

  return (
    <div className="panel">
      <h1 className="title">Size the rig to your kit</h1>
      <p className="lead">A wall rig for a handheld probe, gel packets and gloves. Every part prints without supports</p>

      <section aria-labelledby="sec-printer">
        <h2 id="sec-printer">Printer</h2>
        <Slider
          label="Fit clearance"
          value={params.tolerance}
          {...RANGES.tolerance}
          format={formatClearance}
          onChange={(v) => setParam('tolerance', v)}
          help="Print the calibration piece first to check it"
        />
      </section>

      <section aria-labelledby="sec-probe">
        <h2 id="sec-probe">Probe</h2>
        <SelectField
          label="Probe preset"
          hideLabel
          value={params.probePreset}
          options={PROBE_OPTIONS}
          onChange={(v: ProbePresetId) => setParam('probePreset', v)}
          help={unverified ? PRESET_HELPER_TEXT : undefined}
        />
        {custom && (
          <>
            <Slider label="Cradle width" value={params.cradleW} {...RANGES.cradleW} format={formatLength} onChange={(v) => setParam('cradleW', v)} />
            <Slider label="Cradle depth" value={params.cradleD} {...RANGES.cradleD} format={formatLength} onChange={(v) => setParam('cradleD', v)} />
          </>
        )}
        <Slider label="Holster height" value={params.holsterH} {...RANGES.holsterH} format={formatLength} onChange={(v) => setParam('holsterH', v)} />
      </section>

      <section aria-labelledby="sec-gel">
        <h2 id="sec-gel">Gel packets</h2>
        <Slider label="Packet height" value={params.gelH} {...RANGES.gelH} format={formatLength} onChange={(v) => setParam('gelH', v)} />
      </section>

      <section aria-labelledby="sec-gloves">
        <h2 id="sec-gloves">Gloves</h2>
        <Segmented label="Glove holder" value={params.gloveMode} options={GLOVE_OPTIONS} onChange={(v) => setParam('gloveMode', v)} />
      </section>

      <section aria-labelledby="sec-mount">
        <h2 id="sec-mount">Mount</h2>
        <SelectField label="Mount" hideLabel value={params.mount} options={MOUNT_OPTIONS} onChange={(v) => setParam('mount', v)} />
      </section>

      <button type="button" className="text-btn reset" onClick={reset}>
        Reset to defaults
      </button>
    </div>
  );
}

export function StatusRow() {
  const status = useRigStatus();
  const v = statusView(status);
  return (
    <div className={`status${v.warning ? ' warn' : ''}`} role="status">
      <div className="status-main">
        <span className="dot" aria-hidden="true" />
        <span>{v.text}</span>
        <span className="num status-count">{v.count}</span>
      </div>
      {v.details.length > 0 && (
        <ul className="status-list">
          {v.details.map((d) => (
            <li key={d} className="num">
              {d}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
