import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HealthGauge } from '../components/health-gauge';

describe('HealthGauge', () => {
  it('renders with score', () => {
    render(<HealthGauge score={75} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('has accessible aria-label', () => {
    render(<HealthGauge score={85} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Health score: 85%');
  });

  it('clamps score to 100 maximum', () => {
    render(<HealthGauge score={150} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Health score: 100%');
  });

  it('clamps score to 0 minimum', () => {
    render(<HealthGauge score={-20} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Health score: 0%');
  });

  it('calculates grade A for score >= 90', () => {
    render(<HealthGauge score={95} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('calculates grade B+ for score >= 80', () => {
    render(<HealthGauge score={85} />);
    expect(screen.getByText('B+')).toBeInTheDocument();
  });

  it('calculates grade B for score >= 70', () => {
    render(<HealthGauge score={72} />);
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('calculates grade C for score >= 60', () => {
    render(<HealthGauge score={65} />);
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('calculates grade D for score < 60', () => {
    render(<HealthGauge score={45} />);
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('uses custom grade when provided', () => {
    render(<HealthGauge score={88} grade="A-" />);
    expect(screen.getByText('A-')).toBeInTheDocument();
  });

  it('hides grade when showGrade is false', () => {
    render(<HealthGauge score={95} showGrade={false} />);
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });
});
