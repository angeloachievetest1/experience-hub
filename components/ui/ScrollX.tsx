'use client';

import { useEffect, useRef, useState } from 'react';

// Sideways-scrolling area with a second scrollbar on top that moves together
// with the one at the bottom, so a wide table can be scrolled without going
// to its end. The top one only shows when the content is wider than the box.
export function ScrollX({ children }: { children: React.ReactNode }) {
  const top = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const box = body.current;
    if (!box) return;
    const update = () => {
      setContentWidth(box.scrollWidth);
      setOverflows(box.scrollWidth > box.clientWidth + 1);
    };
    update();
    // Columns resized, rows filtered, window resized: all change the width.
    const observer = new ResizeObserver(update);
    observer.observe(box);
    if (box.firstElementChild) observer.observe(box.firstElementChild);
    return () => observer.disconnect();
  }, []);

  // Setting the same position again fires no further event, so this can't loop.
  const follow = (from: HTMLDivElement | null, to: HTMLDivElement | null) => {
    if (from && to && to.scrollLeft !== from.scrollLeft) to.scrollLeft = from.scrollLeft;
  };

  return (
    <>
      <div ref={top} onScroll={() => follow(top.current, body.current)} aria-hidden="true" tabIndex={-1}
        className={`${overflows ? 'block' : 'hidden'} overflow-x-auto overflow-y-hidden border-b border-lilac-50`}>
        <div style={{ width: contentWidth, height: 1 }} />
      </div>
      <div ref={body} onScroll={() => follow(body.current, top.current)} className="overflow-x-auto">
        {children}
      </div>
    </>
  );
}
