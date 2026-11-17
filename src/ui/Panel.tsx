import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Ruler } from 'lucide-react';
import { PROBE_CLEARANCE, RANGES } from '../geometry/constants';
import { MOUNT_TYPES, PROBE_PRESETS, resolveProbe, type GloveMode, type MountType, type ProbePresetId } from '../geometry/params';
import { PART_META, type PartId } from '../geometry/types';
import { useConfigStore } from '../state/configStore';
import { useViewStore } from '../store/viewStore';
import { useRigStatus } from '../state/selectors';
import { formatLength, statusView } from './format';
import { ICON, Segmented, SelectField, Slider } from './Controls';

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

/** Settings section that sizes each part; selecting a part scrolls its section into view. */
const PART_SECTION: Record<PartId, string> = {
  holster: 'sec-probe',
  caddy: 'sec-gel',
  gloveTube: 'sec-gloves',
  gloveBox: 'sec-gloves',
  plate: 'sec-plate',
  vclamp: 'sec-plate',
  calibMale: 'sec-printer',
  calibFemaleLo: 'sec-printer',
  calibFemale: 'sec-printer',
  calibFemaleHi: 'sec-printer',
};

/** Scrolls the panel's scroll container so the selected part's section sits at the top. */
function useScrollToSelected(root: RefObject<HTMLDivElement | null>, selected: PartId | null) {
  useEffect(() => {
    const el = selected && root.current?.querySelector<HTMLElement>(`[aria-labelledby="${PART_SECTION[selected]}"]`);
    const box = el && (el.closest('.sheet-body') as HTMLElement | null);
    if (!el || !box) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const top = box.scrollTop + el.getBoundingClientRect().top - box.getBoundingClientRect().top;
    box.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
  }, [selected, root]);
}

type SectionProps = {
  id: string;
  /** The part this section sizes: its name and material swatch head the section. Omit for non-part settings. */
  part?: PartId;
  title?: string;
  /** Muted note after the title, e.g. a second part the section also covers */
  extra?: string;
  selected: boolean;
  children: ReactNode;
};

/** A settings group headed by the part it sizes, in the same name and colour as its chip and model. */
function PartSection({ id, part, title, extra, selected, children }: SectionProps) {
  return (
    <section aria-labelledby={id} className={selected ? 'on' : undefined}>
      <h2 id={id}>
        <span className="sec-mark" aria-hidden="true">
          {part ? <span className={`swatch ${PART_META[part].material}`} /> : <Ruler {...ICON} />}
        </span>
        <span>{title ?? (part ? PART_META[part].label : '')}</span>
        {extra && <span className="sec-extra">{extra}</span>}
        {selected && <span className="sr"> (selected)</span>}
      </h2>
      {children}
    </section>
  );
}

export function Panel() {
  const root = useRef<HTMLDivElement>(null);
  const selected = useViewStore((s) => s.selectedPart);
  useScrollToSelected(root, selected);
  const on = (id: string) => selected !== null && PART_SECTION[selected] === id;
  const params = useConfigStore((s) => s.params);
  const setParam = useConfigStore((s) => s.setParam);
  const reset = useConfigStore((s) => s.reset);
  const custom = params.probePreset === 'custom';
  const probe = resolveProbe(params);
  const preset = PROBE_PRESETS.find((x) => x.id === params.probePreset);
  const presetHelp = custom || !preset ? undefined : (
    <>
      {`Based on the manufacturer's published size plus ${formatLength(PROBE_CLEARANCE)} clearance. Check yours with calipers`}
      <span className="help-size">{`${probe.cradleW.toFixed(1)} × ${probe.cradleD.toFixed(1)} mm`}</span>
    </>
  );

  return (
    <div className="panel" ref={root}>
      <h1 className="title">Size the rig to your kit</h1>
      <p className="lead">A wall rig for a handheld probe, gel packets and gloves. Set the sizes, then download the print kit</p>

      <PartSection id="sec-printer" title="Printer" selected={on('sec-printer')}>
        <Slider
          label="Fit clearance"
          value={params.tolerance}
          {...RANGES.tolerance}
          decimals={2}
          onChange={(v) => setParam('tolerance', v)}
          help="Print the calibration piece first to check this value on your printer"
        />
      </PartSection>

      <PartSection id="sec-probe" part="holster" selected={on('sec-probe')}>
        <SelectField
          label="Probe"
          value={params.probePreset}
          options={PROBE_OPTIONS}
          onChange={(v: ProbePresetId) => setParam('probePreset', v)}
          help={presetHelp}
        />
        {custom && (
          <>
            <Slider label="Cradle width" value={params.cradleW} {...RANGES.cradleW} decimals={1} onChange={(v) => setParam('cradleW', v)} />
            <Slider label="Cradle depth" value={params.cradleD} {...RANGES.cradleD} decimals={1} onChange={(v) => setParam('cradleD', v)} />
          </>
        )}
        <Slider label="Holster height" value={params.holsterH} {...RANGES.holsterH} decimals={1} onChange={(v) => setParam('holsterH', v)} />
      </PartSection>

      <PartSection id="sec-gel" part="caddy" selected={on('sec-gel')}>
        <Slider label="Packet height" value={params.gelH} {...RANGES.gelH} decimals={1} onChange={(v) => setParam('gelH', v)} />
        <Slider label="Packet width" value={params.gelW} {...RANGES.gelW} decimals={1} onChange={(v) => setParam('gelW', v)} />
      </PartSection>

      <PartSection id="sec-gloves" part={params.gloveMode === 'tube' ? 'gloveTube' : 'gloveBox'} selected={on('sec-gloves')}>
        <Segmented label="Glove holder" value={params.gloveMode} options={GLOVE_OPTIONS} onChange={(v) => setParam('gloveMode', v)} />
        {params.gloveMode === 'tube' ? (
          <>
            <Slider label="Tube diameter" value={params.tubeD} {...RANGES.tubeD} decimals={1} onChange={(v) => setParam('tubeD', v)} />
            <Slider label="Tube height" value={params.tubeH} {...RANGES.tubeH} decimals={1} onChange={(v) => setParam('tubeH', v)} />
          </>
        ) : (
          <>
            <Slider label="Box width" value={params.gloveBoxW} {...RANGES.gloveBoxW} decimals={1} onChange={(v) => setParam('gloveBoxW', v)} />
            <Slider label="Box height" value={params.gloveBoxH} {...RANGES.gloveBoxH} decimals={1} onChange={(v) => setParam('gloveBoxH', v)} />
          </>
        )}
      </PartSection>

      <PartSection id="sec-plate" part="plate" extra={params.mount === 'ivpole' ? `+ ${PART_META.vclamp.label}` : undefined} selected={on('sec-plate')}>
        <SelectField label="Mount" value={params.mount} options={MOUNT_OPTIONS} onChange={(v) => setParam('mount', v)} />
        <Slider label="Plate width" value={params.plateW} {...RANGES.plateW} decimals={1} onChange={(v) => setParam('plateW', v)} />
        <Slider
          label="Plate height"
          value={params.plateH}
          {...RANGES.plateH}
          decimals={1}
          onChange={(v) => setParam('plateH', v)}
          help="Extra height is added at the top. Mount holes stay in place"
        />
      </PartSection>

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
        <span>
          {v.text}
          {' · '}
          <span className="num">{v.count}</span>
        </span>
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
