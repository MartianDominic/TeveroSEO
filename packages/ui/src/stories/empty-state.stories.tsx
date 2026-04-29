import type { Meta, StoryObj } from '@storybook/react';
import { EmptyState } from '../components/empty-state';
import { Search, FolderOpen, Inbox, Filter } from 'lucide-react';

const meta = {
  title: 'Feedback/EmptyState',
  component: EmptyState,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'search', 'first-time', 'filtered'] },
    title: { control: 'text' },
    description: { control: 'text' },
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: Inbox,
    title: 'No items yet',
    description: 'Get started by creating your first item.',
    action: { label: 'Create Item', onClick: () => {} },
  },
};

export const SearchNoResults: Story = {
  args: {
    variant: 'search',
    icon: Search,
    title: 'No results found',
    description: 'Try adjusting your search terms or filters.',
    action: { label: 'Clear Search', onClick: () => {}, variant: 'ghost' },
  },
};

export const FirstTime: Story = {
  args: {
    variant: 'first-time',
    icon: FolderOpen,
    title: 'Welcome to TeveroSEO',
    description: 'Connect your first client to start optimizing their SEO.',
    action: { label: 'Add Client', onClick: () => {} },
    secondaryAction: { label: 'View Tutorial', onClick: () => {} },
  },
};

export const Filtered: Story = {
  args: {
    variant: 'filtered',
    icon: Filter,
    title: 'No matching items',
    description: 'No items match the current filters. Try adjusting your criteria.',
    action: { label: 'Clear Filters', onClick: () => {}, variant: 'ghost' },
  },
};

export const WithSecondaryAction: Story = {
  args: {
    icon: Inbox,
    title: 'No clients added',
    description: 'Add your first client to start managing their SEO campaigns.',
    action: { label: 'Add Client', onClick: () => {} },
    secondaryAction: { label: 'Import from CSV', onClick: () => {} },
  },
};
