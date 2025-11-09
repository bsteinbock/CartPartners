/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';
export const deleteBackgroundColor = '#C03403';

export const iosKeyboardToolbarOffset = 84;

export const Colors = {
  light: {
    text: '#11181C',
    textDim: '#11181c89',
    placeHolderText: '#11181c7b',
    background: '#fff',
    backgroundWithAlpha: '#ffffffbb',
    tint: tintColorLight,
    border: tintColorLight,
    icon: '#687076',
    iconButton: '#007AFF',
    iconButtonDisabled: 'rgba(0,122,255,0.3)',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    errorText: '#B00020',
    disabledColor: 'rgba(209,209,214,1.0)',
  },
  dark: {
    text: '#ECEDEE',
    textDim: '#ecedee82',
    placeHolderText: '#ecedee77',
    background: '#151718',
    backgroundWithAlpha: '#151718b8',
    tint: tintColorDark,
    border: tintColorDark,
    icon: '#9BA1A6',
    iconButton: '#007AFF',
    iconButtonDisabled: 'rgba(0,122,255,0.3)',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    errorText: '#FF453A',
    disabledColor: 'rgba(58, 58, 60, 1.0)',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
