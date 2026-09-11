// Shared by the build and the author preview. Coordinates are WebGAL design pixels.
export const textDefaults = Object.freeze({
  fontScale: 1, nameSize: 48, lineHeight: 1.55, letterSpacing: 0.035,
  boxHeight: 335, paddingX: 150, paddingTop: 82, paddingBottom: 58
});
export const textRanges = Object.freeze({
  fontScale: [0.75, 1.5, 0.01], nameSize: [28, 72, 1], lineHeight: [1.2, 2, 0.05],
  letterSpacing: [0, 0.15, 0.005], boxHeight: [280, 560, 5],
  paddingX: [60, 340, 5], paddingTop: [82, 130, 2], paddingBottom: [58, 100, 2]
});
export const playerFontSizes = Object.freeze({ small: 1.55, medium: 2.05, large: 2.3 });

export function normalizePresentation(input) {
  const config = structuredClone(input);
  config.figureScale ??= 1;
  config.text = { ...textDefaults, ...config.text };
  const number = (value, min, max, name) => {
    if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} 须在 ${min}–${max} 之间`);
  };
  number(config.figureScale, 0.6, 1.4, '全体立绘倍率');
  if (config.stage?.width !== 2560 || config.stage?.height !== 1440) throw new Error('当前引擎舞台须保持 2560 × 1440');
  number(config.stage.leftX, 300, 1200, '左侧位置');
  number(config.stage.rightX, 1360, 2260, '右侧位置');
  for (const [key, [min, max]] of Object.entries(textRanges)) number(config.text[key], min, max, key);
  for (const [id, profile] of Object.entries(config.characters ?? {})) {
    number(profile.scale, 0.4, 1.5, `${id} 立绘倍率`);
    number(profile.y, -200, 400, `${id} 纵向偏移`);
  }
  if (!config.characters || !Object.keys(config.characters).length) throw new Error('缺少角色配置');
  return config;
}

export function presentationVariables(config) {
  const text = config.text;
  return {
    '--pt-font-scale': text.fontScale,
    '--pt-name-size': `${text.nameSize}px`,
    '--pt-line-height': text.lineHeight,
    '--pt-letter-spacing': `${text.letterSpacing}em`,
    '--pt-box-height': `${text.boxHeight}px`,
    '--pt-padding-x': `${text.paddingX}px`,
    '--pt-padding-top': `${textTop(config)}px`,
    '--pt-padding-bottom': `${text.paddingBottom}px`
  };
}

// Leave room for punctuation and wide glyphs. Runtime measurement expands the
// box when a player selects a larger font or a font has different metrics.
export function pageLimit(config) {
  const largestFont = 25.6 * playerFontSizes.large * config.text.fontScale;
  const columns = Math.floor((config.stage.width - 2 * config.text.paddingX - largestFont) /
    (largestFont * (1 + config.text.letterSpacing)));
  return Math.min(76, Math.max(24, columns * 2 - 4));
}

export function textBoxHeight(config, measuredHeight) {
  const text = config.text;
  return Math.min(config.stage.height * 0.65,
    Math.max(text.boxHeight, Math.ceil(measuredHeight + textTop(config) + text.paddingBottom)));
}

export function textTop(config) {
  return Math.max(config.text.paddingTop, Math.ceil(config.text.nameSize * 1.1 + 24));
}

export function figureGeometry(config, character, size, side, active = false) {
  const profile = config.characters[character];
  const fit = Math.min(config.stage.width / size.width, config.stage.height / size.height);
  const scale = Number((profile.scale * config.figureScale * (active ? 1.025 : 1)).toFixed(4));
  return {
    width: size.width * fit * scale, height: size.height * fit * scale,
    x: side === 'left' ? config.stage.leftX : config.stage.rightX,
    y: config.stage.height / 2 + profile.y
  };
}
