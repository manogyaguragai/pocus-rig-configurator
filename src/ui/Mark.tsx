/** Dovetail profile: the rail that joins every part to the wall plate. One flat colour. */
export function Mark({ className = 'mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M3 17h5L5 5h14l-3 12h5v4H3z" />
    </svg>
  );
}
