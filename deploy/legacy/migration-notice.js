(() => {
  const ready = () => {
    if (document.documentElement.dataset.cardStartup !== 'complete' || document.getElementById('card-migration-notice')) return;
    try { if (sessionStorage.getItem('card-migration252-dismissed')) return; } catch {}

    const aside = document.createElement('aside');
    aside.id = 'card-migration-notice';
    aside.setAttribute('aria-label', '独立角色卡迁移说明');
    Object.assign(aside.style, { position: 'fixed', bottom: '8px', right: '8px', maxWidth: '340px', padding: '12px', background: '#e5e5e5', color: '#292a2d', border: '4px solid #50525b', zIndex: '1000', font: '13px/1.6 system-ui', boxShadow: '0 3px 15px #0004' });

    const heading = document.createElement('strong');
    heading.textContent = '网址搬迁了！请在下方前往新站';
    Object.assign(heading.style, { position: 'fixed', top: '0', left: '0', display: 'block', boxSizing: 'border-box', width: 'max-content', maxWidth: 'calc(100vw - 24px)', padding: '10px 16px', border: '3px solid #50525b', borderRadius: '4px', background: '#e5e5e5', color: '#292a2d', font: '700 20px/1.4 system-ui', textAlign: 'center', pointerEvents: 'none', zIndex: '1001', willChange: 'transform' });
    aside.append(heading);

    const text = document.createElement('p');
    text.textContent = '旧站仍可读取、保存和导出。迁移前，请在“导入 / 导出”选择“全部可见角色”并下载 JSON，再到新站批量导入并核对五页与资源。存档不会自动跨域搬运。';
    aside.append(text);
    const link = document.createElement('a');
    link.href = 'https://dnd.center/card/'; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = '打开新站（先导出旧站备份）'; aside.append(link);
    const help = document.createElement('a');
    help.href = 'https://dnd.center/library/'; help.target = '_blank'; help.rel = 'noopener noreferrer'; help.textContent = '迁移说明'; help.style.marginLeft = '10px'; aside.append(help);
    const close = document.createElement('button');
    close.textContent = '暂时收起'; close.style.marginLeft = '10px'; aside.append(close);
    document.body.append(aside);

    let x = 12, y = 12, vx = 148, vy = 112, previous = 0, frame = 0;
    const viewport = window.visualViewport;
    const bounds = () => {
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      heading.style.maxWidth = Math.max(1, width - 24) + 'px';
      const rect = heading.getBoundingClientRect();
      const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
      return { left, top, right: left + Math.max(0, width - rect.width), bottom: top + Math.max(0, height - rect.height) };
    };
    let limit = bounds();
    const paint = () => { heading.style.transform = `translate3d(${x}px, ${y}px, 0)`; };
    const resize = () => {
      limit = bounds();
      x = Math.max(limit.left, Math.min(x, limit.right));
      y = Math.max(limit.top, Math.min(y, limit.bottom));
      paint();
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
    };
    const tick = time => {
      if (!heading.isConnected) { stop(); return; }
      const delta = previous ? Math.min((time - previous) / 1000, 0.05) : 0;
      previous = time;
      x += vx * delta; y += vy * delta;
      if (x > limit.right) { x = Math.max(limit.left, 2 * limit.right - x); vx = -Math.abs(vx); }
      else if (x < limit.left) { x = Math.min(limit.right, 2 * limit.left - x); vx = Math.abs(vx); }
      if (y > limit.bottom) { y = Math.max(limit.top, 2 * limit.bottom - y); vy = -Math.abs(vy); }
      else if (y < limit.top) { y = Math.min(limit.bottom, 2 * limit.top - y); vy = Math.abs(vy); }
      paint();
      frame = requestAnimationFrame(tick);
    };
    close.onclick = () => { stop(); aside.remove(); try { sessionStorage.setItem('card-migration252-dismissed', '1'); } catch {} };
    window.addEventListener('resize', resize);
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    resize();
    frame = requestAnimationFrame(tick);
  };
  window.addEventListener('dnd-card-startup', ready);
  ready();
})();
