const LINK = { target: '_blank', rel: 'noopener noreferrer' } as const;

export function Credit() {
  return (
    <footer className="credit">
      <p>
        Built by{' '}
        <a href="https://www.linkedin.com/in/mandeep-guragai-280589117/" {...LINK}>
          Dr. Mandeep Guragai
        </a>{' '}
        and{' '}
        <a href="https://www.linkedin.com/in/manogya-guragai/" {...LINK}>
          Manogya Guragai
        </a>
      </p>
      <p>
        Free for non-commercial use,{' '}
        <a href="https://creativecommons.org/licenses/by-nc/4.0/" {...LINK}>
          CC BY-NC 4.0
        </a>
      </p>
    </footer>
  );
}
