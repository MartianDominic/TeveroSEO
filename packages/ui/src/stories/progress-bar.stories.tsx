import type { Meta, StoryObj } from '@storybook/react';
import { ProgressBar } from '../components/progress-bar';

const meta = {
  title: 'Data Display/ProgressBar',
  component: ProgressBar,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    variant: { control: 'select', options: ['auto', 'default', 'success', 'warning', 'error'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    showLabel: { control: 'boolean' },
    labelPosition: { control: 'select', options: ['inside', 'outside'] },
  },
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { value: 65 },
};

export const Success: Story = {
  args: { value: 100, variant: 'success' },
};

export const Warning: Story = {
  args: { value: 85, variant: 'warning' },
};

export const WithLabel: Story = {
  args: { value: 75, showLabel: true },
};

export const AllSizes: Story = {
  args: { value: 60 },
  render: () => (
    <div className="space-y-4 w-64">
      <ProgressBar value={60} size="sm" />
      <ProgressBar value={60} size="md" />
      <ProgressBar value={60} size="lg" />
    </div>
  ),
};

export const AutoVariant: Story = {
  args: { value: 50 },
  render: () => (
    <div className="space-y-4 w-64">
      <ProgressBar value={50} variant="auto" showLabel />
      <ProgressBar value={85} variant="auto" showLabel />
      <ProgressBar value={100} variant="auto" showLabel />
    </div>
  ),
};
