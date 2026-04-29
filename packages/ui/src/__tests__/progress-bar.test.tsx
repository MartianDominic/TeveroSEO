import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../components/progress-bar';

describe('ProgressBar', () => {
  it('renders with value prop', () => {
    render(<ProgressBar value={50} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('sets correct aria-valuenow', () => {
    render(<ProgressBar value={75} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
  });

  it('clamps value to 100 maximum', () => {
    render(<ProgressBar value={150} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('clamps value to 0 minimum', () => {
    render(<ProgressBar value={-20} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('shows label when showLabel is true', () => {
    render(<ProgressBar value={75} showLabel />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('does not show label by default', () => {
    render(<ProgressBar value={75} />);
    expect(screen.queryByText('75%')).not.toBeInTheDocument();
  });

  it('has aria-valuemin and aria-valuemax attributes', () => {
    render(<ProgressBar value={50} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
  });

  it('rounds displayed percentage', () => {
    render(<ProgressBar value={33.7} showLabel />);
    expect(screen.getByText('34%')).toBeInTheDocument();
  });
});
