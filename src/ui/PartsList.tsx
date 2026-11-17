import { useEffect, useRef, useState } from 'react';
import { PART_META, type BBox, type PartId } from '../geometry/types';
import { formatBBoxDims } from './format';

type Props = {
  parts: readonly PartId[];
  boxes: Readonly<Partial<Record<PartId, BBox>>>;
  selected: PartId | null;
  onSelect: (id: PartId | null) => void;
};

/** One chip per active part. Pressing the selected chip again clears the selection. */
export function PartsList({ parts, boxes, selected, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setAtEnd(el.scrollWidth - el.clientWidth - el.scrollLeft <= 2);
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check);
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', check);
      ro?.disconnect();
    };
  }, [parts.length]);
  return (
    <div ref={ref} className={`chips${atEnd ? ' at-end' : ''}`} role="group" aria-label="Parts">
      {parts.map((id) => {
        const box = boxes[id];
        const on = id === selected;
        return (
          <button
            key={id}
            type="button"
            className="chip"
            aria-pressed={on}
            onClick={() => onSelect(on ? null : id)}
          >
            <span className="chip-name">
              <span className={`swatch ${PART_META[id].material}`} aria-hidden="true" />
              {PART_META[id].label}
            </span>
            <span className="num chip-dims">{box ? formatBBoxDims(box) : ''}</span>
          </button>
        );
      })}
    </div>
  );
}
