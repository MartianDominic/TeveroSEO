import type { Meta, StoryObj } from '@storybook/react';
import { Checklist, ChecklistItem } from '../components/checklist';

const meta = {
  title: 'Data Display/Checklist',
  component: Checklist,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    completedCount: { control: 'number' },
    totalCount: { control: 'number' },
  },
} satisfies Meta<typeof Checklist>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Getting Started',
    completedCount: 2,
    totalCount: 4,
  },
  render: (args) => (
    <Checklist {...args}>
      <ChecklistItem done title="Create your account" />
      <ChecklistItem done title="Verify email address" />
      <ChecklistItem
        done={false}
        title="Connect Google Search Console"
        description="Required for rank tracking"
        action={{ label: 'Connect', onClick: () => {} }}
      />
      <ChecklistItem
        done={false}
        title="Add your first client"
        action={{ label: 'Add Client', onClick: () => {} }}
      />
    </Checklist>
  ),
};

export const WithActionLinks: Story = {
  args: {
    title: 'Setup Tasks',
    completedCount: 1,
    totalCount: 3,
  },
  render: (args) => (
    <Checklist {...args}>
      <ChecklistItem done title="API credentials configured" />
      <ChecklistItem
        done={false}
        title="Configure DataForSEO"
        description="For keyword research and SERP analysis"
        action={{ label: 'Go to Settings', onClick: () => {} }}
      />
      <ChecklistItem
        done={false}
        title="Set up CMS integration"
        action={{ label: 'Connect CMS', onClick: () => {} }}
      />
    </Checklist>
  ),
};

export const AllComplete: Story = {
  args: {
    title: 'Onboarding Complete',
    completedCount: 3,
    totalCount: 3,
  },
  render: (args) => (
    <Checklist {...args}>
      <ChecklistItem done title="Account created" />
      <ChecklistItem done title="GSC connected" />
      <ChecklistItem done title="First audit run" />
    </Checklist>
  ),
};
