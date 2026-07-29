/** GifMaker barrel exports.
 *
 * Usage in a parent app:
 * ```tsx
 * import { GifMaker } from './components/GifMaker';
 *
 * <GifMaker apiBaseUrl={process.env.REACT_APP_API_URL} maxFrames={30} />
 * ```
 */

export { GifMaker, type GifMakerProps } from './GifMaker';
export type { Frame, GifSettings, GifResult } from './types';
export {
  DEFAULT_SETTINGS,
  SETTINGS_LIMITS,
  OPTIMIZE_LABELS,
  OPTIMIZE_DESCRIPTIONS,
} from './types';
