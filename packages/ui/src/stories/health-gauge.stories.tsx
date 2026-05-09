import type { Meta, StoryObj } from '@storybook/react';
import { HealthGauge } from '../components/health-gauge';

const meta = {
  title: 'Data Display/HealthGauge',
  component: HealthGauge,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    score: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    grade: { control: 'text' },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    showGrade: { control: 'boolean' },
  },
} satisfies Meta<typeof HealthGauge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { score: 75 },
};

export const HighScore: Story = {
  args: { score: 95, size: 'lg' },
};

export const LowScore: Story = {
  args: { score: 45 },
};

export const AllSizes: Story = {
  args: { score: 85 },
  render: () => (
    <div className="flex items-end gap-6">
      <HealthGauge score={85} size="sm" />
      <HealthGauge score={85} size="md" />
      <HealthGauge score={85} size="lg" />
    </div>
  ),
};

export const GradeVariations: Story = {
  args: { score: 95 },
  render: () => (
    <div className="flex items-center gap-6">
      <HealthGauge score={95} size="md" />
      <HealthGauge score={82} size="md" />
      <HealthGauge score={71} size="md" />
      <HealthGauge score={55} size="md" />
      <HealthGauge score={40} size="md" />
    </div>
  ),
};

export const WithoutGrade: Story = {
  args: { score: 80, showGrade: false },
};

export const CustomGrade: Story = {
  args: { score: 88, grade: 'A-' },
};
