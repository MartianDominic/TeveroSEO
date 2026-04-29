import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from '../components/empty-state';
import { Inbox } from 'lucide-react';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No items" />);
    expect(screen.getByRole('heading', { name: 'No items' })).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="No items" description="Add some items to get started" />);
    expect(screen.getByText('Add some items to get started')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(<EmptyState title="No items" icon={Inbox} />);
    // Lucide icons render as SVG
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('renders primary action button', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="No items"
        action={{ label: 'Add Item', onClick }}
      />
    );
    expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument();
  });

  it('calls onClick when primary action is clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <EmptyState
        title="No items"
        action={{ label: 'Add Item', onClick }}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Add Item' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders secondary action', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="No items"
        secondaryAction={{ label: 'Learn more', onClick }}
      />
    );
    expect(screen.getByRole('button', { name: 'Learn more' })).toBeInTheDocument();
  });

  it('calls onClick when secondary action is clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <EmptyState
        title="No items"
        secondaryAction={{ label: 'Learn more', onClick }}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Learn more' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
