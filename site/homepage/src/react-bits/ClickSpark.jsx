'use client';

import { useRef, useEffect, useCallback } from 'react';

const ClickSpark = ({
  sparkColor = '#fff',
  sparkSize = 10,
  sparkRadius = 15,
  sparkCount = 8,
  duration = 400,
  easing = 'ease-out',
  extraScale = 1.0,
  targetSelector = null,
  children
}) => {
  const canvasRef = useRef(null);
  const sparksRef = useRef([]);
  const startTimeRef = useRef(null);
  const wakeRef = useRef(null);
  const dprRef = useRef(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    let resizeTimeout;

    const resizeCanvas = () => {
      const { width, height } = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1,2);dprRef.current = dpr;
      if (canvas.width !== Math.round(width*dpr) || canvas.height !== Math.round(height*dpr)) {
        canvas.width = Math.round(width*dpr);
        canvas.height = Math.round(height*dpr);
      }
    };

    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resizeCanvas, 100);
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(parent);

    resizeCanvas();

    return () => {
      ro.disconnect();
      clearTimeout(resizeTimeout);
    };
  }, []);

  const easeFunc = useCallback(
    t => {
      switch (easing) {
        case 'linear':
          return t;
        case 'ease-in':
          return t * t;
        case 'ease-in-out':
          return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        default:
          return t * (2 - t);
      }
    },
    [easing]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationId = 0;

    const draw = timestamp => {
      animationId = 0;
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }
      ctx.setTransform(dprRef.current,0,0,dprRef.current,0,0);
      ctx.clearRect(0, 0, canvas.width/dprRef.current, canvas.height/dprRef.current);
      ctx.lineCap = 'round';

      sparksRef.current = sparksRef.current.filter(spark => {
        const elapsed = timestamp - spark.startTime;
        if (elapsed >= duration) {
          return false;
        }

        const progress = elapsed / duration;
        const eased = easeFunc(progress);

        const distance = eased * sparkRadius * extraScale;
        const lineLength = sparkSize * (1 - eased);

        const x1 = spark.x + distance * Math.cos(spark.angle);
        const y1 = spark.y + distance * Math.sin(spark.angle);
        const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
        const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

        ctx.strokeStyle = sparkColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        return true;
      });

      if(sparksRef.current.length)animationId = requestAnimationFrame(draw);
    };

    wakeRef.current = ()=>{if(!animationId)animationId = requestAnimationFrame(draw)};

    return () => {
      cancelAnimationFrame(animationId);
      wakeRef.current = null;
    };
  }, [sparkColor, sparkSize, sparkRadius, sparkCount, duration, easeFunc, extraScale]);

  const handleClick = e => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const target = targetSelector && e.target instanceof Element ? e.target.closest(targetSelector) : null;
    const bounds = target?.getBoundingClientRect();
    const x = (e.detail === 0 && bounds ? bounds.left+bounds.width/2 : e.clientX) - rect.left;
    const y = (e.detail === 0 && bounds ? bounds.top+bounds.height/2 : e.clientY) - rect.top;

    const now = performance.now();
    const newSparks = Array.from({ length: sparkCount }, (_, i) => ({
      x,
      y,
      angle: (2 * Math.PI * i) / sparkCount,
      startTime: now
    }));

    sparksRef.current.push(...newSparks);
    wakeRef.current?.();
  };

  useEffect(()=>{
    if(!targetSelector)return;
    const click=event=>{if(event.target instanceof Element&&event.target.closest(targetSelector)&&document.body.dataset.intro==='complete')handleClick(event)};
    document.addEventListener('click',click,true);return()=>document.removeEventListener('click',click,true);
  },[targetSelector,sparkCount]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%'
      }}
      onClick={targetSelector ? undefined : handleClick}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="home-click-sparks"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          userSelect: 'none',
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none'
        }}
      />
      {children}
    </div>
  );
};

export default ClickSpark;
