'use client';
// useNarrow — is the viewport a phone (< 640px)? Read after mount, never during render: the server renders every page
// once, so a value that differs by device would make the first client render disagree with the markup (React #418).
import { useEffect, useState } from 'react';
export function useNarrow(query = '(max-width: 639px)') {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => { const mq = window.matchMedia(query); const on = () => setNarrow(mq.matches); on(); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }, [query]);
  return narrow;
}
