import type { Preview } from '@storybook/react';
import '../src/lib/tokens.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    backgrounds: {
      default: 'canvas',
      values: [
        { name: 'canvas', value: '#FAFAF7' },
        { name: 'surface', value: '#FFFFFF' },
        { name: 'dark', value: '#14141A' },
      ],
    },
    a11y: {
      element: '#storybook-root',
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'landmark-one-main', enabled: false },
        ],
      },
    },
  },
};

export default preview;
