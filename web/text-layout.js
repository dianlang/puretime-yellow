import { normalizePresentation, textBoxHeight } from './presentation-settings.js';

// Keep WebGAL's own small / medium / large inline font sizes and pagination.
// Only measure the rendered lines and give both textbox layers enough room.
export function watchTextBox(config) {
  let box, content, observer, previousText = '', queued = false;
  const resize = new ResizeObserver(schedule);
  function measure() {
    queued = false;
    const nextBox = document.getElementById('textBoxMain');
    if (nextBox !== box) {
      observer?.disconnect();
      resize.disconnect();
      box = nextBox;
      content = undefined;
      if (!box) return;
      observer = new MutationObserver(schedule);
      observer.observe(box, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style'] });
    }
    if (!box) return;
    // Pinned WebGAL renders the dialogue as the final direct div in textBoxMain.
    const nextContent = box.lastElementChild;
    if (!nextContent || nextContent.id === 'miniAvatar') return;
    if (content !== nextContent) {
      resize.disconnect();
      content = nextContent;
      resize.observe(content);
    }
    const text = content.textContent;
    if (text !== previousText) { content.scrollTop = 0; previousText = text; }
    // Child line blocks retain their intrinsic height even when their flex parent
    // has spare space. scrollHeight alone would prevent shrinking after a long page.
    const height = [...content.children].reduce((sum, line) => sum + line.offsetHeight, 0);
    const value = `${textBoxHeight(config, height)}px`;
    if (document.documentElement.style.getPropertyValue('--pt-current-box-height') !== value) {
      document.documentElement.style.setProperty('--pt-current-box-height', value);
    }
  }
  function schedule() {
    if (!queued) { queued = true; requestAnimationFrame(measure); }
  }
  // Stage mounts/unmounts need discovery; text changes are handled by the scoped observer.
  const mounts = new MutationObserver(() => {
    if (document.getElementById('textBoxMain') !== box) schedule();
  });
  mounts.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true });
  document.fonts?.addEventListener('loadingdone', schedule);
  window.addEventListener('resize', schedule, { passive: true });
  document.fonts?.ready.then(schedule);
  schedule();
}

fetch('./game/presentation.json').then(response => {
  if (!response.ok) throw new Error('无法读取文字配置');
  return response.json();
}).then(config => watchTextBox(normalizePresentation(config))).catch(error => console.error('文字布局：', error));
