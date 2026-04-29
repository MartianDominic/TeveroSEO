import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checklist, ChecklistItem } from '../components/checklist';

describe('Checklist', () => {
  it('renders title', () => {
    render(
      <Checklist title="Test Checklist">
        <ChecklistItem done={false} title="Item 1" />
      </Checklist>
    );
    expect(screen.getByText('Test Checklist')).toBeInTheDocument();
  });

  it('renders completion count badge', () => {
    render(
      <Checklist title="Tasks" completedCount={2} totalCount={5}>
        <ChecklistItem done title="Item 1" />
      </Checklist>
    );
    expect(screen.getByText('2/5 complete')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <Checklist title="Tasks" description="Complete all tasks">
        <ChecklistItem done={false} title="Item 1" />
      </Checklist>
    );
    expect(screen.getByText('Complete all tasks')).toBeInTheDocument();
  });
});

describe('ChecklistItem', () => {
  it('renders title', () => {
    render(<ChecklistItem done={false} title="Test Item" />);
    expect(screen.getByText('Test Item')).toBeInTheDocument();
  });

  it('renders description for incomplete items', () => {
    render(<ChecklistItem done={false} title="Item" description="Item description" />);
    expect(screen.getByText('Item description')).toBeInTheDocument();
  });

  it('hides description for done items', () => {
    render(<ChecklistItem done title="Item" description="Item description" />);
    expect(screen.queryByText('Item description')).not.toBeInTheDocument();
  });

  it('renders action link for incomplete items', () => {
    const onClick = vi.fn();
    render(
      <ChecklistItem
        done={false}
        title="Item"
        action={{ label: 'Do it', onClick }}
      />
    );
    expect(screen.getByRole('button', { name: 'Do it' })).toBeInTheDocument();
  });

  it('hides action link for done items', () => {
    const onClick = vi.fn();
    render(
      <ChecklistItem
        done
        title="Item"
        action={{ label: 'Do it', onClick }}
      />
    );
    expect(screen.queryByRole('button', { name: 'Do it' })).not.toBeInTheDocument();
  });

  it('calls onClick when action is clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ChecklistItem
        done={false}
        title="Item"
        action={{ label: 'Click me', onClick }}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Click me' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
