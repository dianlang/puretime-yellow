// Native WebGAL components remain responsible for navigation, saves and sound.
(() => {
  let knownTitle;
  let queued = false;

  function isTouchDevice() {
    return navigator.maxTouchPoints > 0 || matchMedia('(pointer:coarse)').matches;
  }

  function shouldGatePortrait() {
    return isTouchDevice() && window.innerHeight > window.innerWidth;
  }

  function ensureOrientationGate() {
    let gate = document.getElementById('puretime-orientation-gate');
    if (gate) return gate;

    gate = document.createElement('div');
    gate.id = 'puretime-orientation-gate';
    gate.className = 'puretime-orientation-gate';
    gate.hidden = true;
    gate.setAttribute('role', 'dialog');
    gate.setAttribute('aria-modal', 'true');
    gate.setAttribute('aria-label', '请横置手机');

    const card = document.createElement('div');
    card.className = 'puretime-orientation-card';

    const mark = document.createElement('div');
    mark.className = 'puretime-orientation-mark';
    mark.textContent = '↻';

    const title = document.createElement('div');
    title.className = 'puretime-orientation-title';
    title.textContent = '请横置手机';

    const copy = document.createElement('p');
    copy.className = 'puretime-orientation-copy';
    copy.textContent = '《PureTime·黄》以 16:9 横屏演出。将手机旋转至横屏即可继续；也可以尝试进入全屏并锁定横屏。';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'puretime-orientation-button';
    button.textContent = '尝试横屏全屏';
    button.addEventListener('click', async () => {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (error) {
        console.debug('Fullscreen request was not available', error);
      }
      try {
        if (screen.orientation?.lock) {
          await screen.orientation.lock('landscape');
        }
      } catch (error) {
        console.debug('Landscape lock was not available', error);
      }
      updateOrientationGate();
    });

    card.append(mark, title, copy, button);
    gate.append(card);
    document.body.append(gate);
    return gate;
  }

  function updateOrientationGate() {
    const gate = ensureOrientationGate();
    const active = shouldGatePortrait();
    document.body.classList.toggle('puretime-portrait', active);
    gate.hidden = !active;
    gate.setAttribute('aria-hidden', active ? 'false' : 'true');
  }

  function enhanceTitle() {
    if (knownTitle?.isConnected) return;
    const root = document.getElementById('root');
    if (!root) return;
    const title = [...root.querySelectorAll('div')].find(
      el => getComputedStyle(el).getPropertyValue('--puretime-title').trim() === '1'
    );
    if (!title) return;

    knownTitle = title;
    const column = [...title.querySelectorAll('div')].find(
      el => getComputedStyle(el).getPropertyValue('--puretime-column').trim() === '1'
    );
    for (const button of column?.children || []) {
      button.tabIndex = 0;
      button.setAttribute('role', 'button');
      button.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          button.click();
        }
      });
    }

    if (!title.querySelector('.puretime-subtitle')) {
      const subtitle = document.createElement('div');
      subtitle.className = 'puretime-subtitle';
      subtitle.textContent = '无始无终之地 · 黄昏';
      title.append(subtitle);
    }

    if (!title.querySelector('.puretime-credit')) {
      const link = document.createElement('a');
      link.className = 'puretime-credit';
      link.href = './credits.html';
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = '作品信息 / 操作说明';
      title.append(link);
    }
  }

  function enhanceControlPanel() {
    const auto = document.getElementById('Button_ControlPanel_auto');
    const panel = auto?.parentElement;
    if (!panel || panel.classList.contains('puretime-control-panel')) return;
    panel.classList.add('puretime-control-panel');
    for (const child of panel.children) child.classList.add('puretime-control-item');
  }

  const scheduleEnhance = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      enhanceTitle();
      enhanceControlPanel();
    });
  };

  new MutationObserver(scheduleEnhance).observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  updateOrientationGate();
  window.addEventListener('resize', updateOrientationGate, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(updateOrientationGate, 120));
  screen.orientation?.addEventListener?.('change', updateOrientationGate);
  scheduleEnhance();
})();
